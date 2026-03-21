"use client";

import { useCallback, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { BN, Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { PROGRAM_ID, TEE_RPC_URL, TEE_VALIDATOR } from "@/lib/constants";
import { getMeetingPda, getSlotRecordPda } from "@/lib/pda";
import idl from "@/lib/nullmeet.json";
import {
  getAuthToken,
  permissionPdaFromAccount,
  createDelegatePermissionInstruction,
  waitUntilPermissionActive,
  AUTHORITY_FLAG,
  TX_LOGS_FLAG,
} from "@magicblock-labs/ephemeral-rollups-sdk";

const TEE_URL = TEE_RPC_URL;
const TEE_WS_URL = TEE_RPC_URL.replace("https://", "wss://");

interface Member {
  flags: number;
  pubkey: PublicKey;
}

export function useNullmeet() {
  const wallet = useWallet();
  const { publicKey, signTransaction, signAllTransactions, signMessage } =
    wallet;
  const { connection } = useConnection();

  // Store TEE auth token and connection
  const authTokenRef = useRef<{ token: string; expiresAt: number } | null>(
    null
  );
  const teeConnectionRef = useRef<Connection | null>(null);

  const program = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;

    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: "confirmed" }
    );

    return new Program(idl as Idl, provider);
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  // Helper: sign and send a transaction on devnet
  const signAndSend = useCallback(
    async (tx: Transaction) => {
      if (!publicKey || !signTransaction)
        throw new Error("Wallet not connected");

      tx.feePayer = publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const signed = await signTransaction(tx);
      const txHash = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
      });
      await connection.confirmTransaction(txHash, "confirmed");
      return txHash;
    },
    [publicKey, signTransaction, connection]
  );

  // Helper: sign and send a transaction on TEE
  const signAndSendTee = useCallback(
    async (tx: Transaction) => {
      if (!publicKey || !signTransaction)
        throw new Error("Wallet not connected");
      const teeConn = teeConnectionRef.current;
      if (!teeConn) throw new Error("TEE connection not established");

      tx.feePayer = publicKey;
      tx.recentBlockhash = (
        await teeConn.getLatestBlockhash()
      ).blockhash;

      const signed = await signTransaction(tx);
      const txHash = await sendAndConfirmRawTransaction(
        teeConn,
        signed.serialize(),
        { skipPreflight: true, commitment: "confirmed" }
      );
      return txHash;
    },
    [publicKey, signTransaction]
  );

  // Host: create meeting + permissions + delegation in ONE transaction
  // Then authenticate with TEE (signMessage popup)
  const createAndSetupHost = useCallback(
    async (meetingId: number) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const meetingIdBn = new BN(meetingId);
      const [meetingPda] = getMeetingPda(meetingIdBn);
      const [hostSlotPda] = getSlotRecordPda(meetingIdBn, publicKey);

      // Create meeting instruction
      const createMeetingIx = await program.methods
        .createMeeting(meetingIdBn)
        .accounts({ host: publicKey })
        .instruction();

      // Host slot record permission (only host can see)
      const hostMembers: Member[] = [
        { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: publicKey },
      ];

      const createHostSlotPermIx = await program.methods
        .createPermission(
          { slotRecord: { meetingId: meetingIdBn, owner: publicKey } },
          hostMembers
        )
        .accountsPartial({
          payer: publicKey,
          permissionedAccount: hostSlotPda,
          permission: permissionPdaFromAccount(hostSlotPda),
        })
        .instruction();

      // Delegate host slot record permission to TEE
      const delegateHostSlotPermIx = createDelegatePermissionInstruction({
        payer: publicKey,
        validator: TEE_VALIDATOR,
        permissionedAccount: [hostSlotPda, false],
        authority: [publicKey, true],
      });

      // Delegate host slot record PDA to TEE
      const delegateHostSlotIx = await program.methods
        .delegatePda({
          slotRecord: { meetingId: meetingIdBn, owner: publicKey },
        })
        .accounts({
          payer: publicKey,
          validator: TEE_VALIDATOR,
          pda: hostSlotPda,
        })
        .instruction();

      // Single transaction: create + permissions + delegate
      const tx = new Transaction().add(
        createMeetingIx,
        createHostSlotPermIx,
        delegateHostSlotPermIx,
        delegateHostSlotIx
      );

      const txHash = await signAndSend(tx);
      console.log("[TEE] Host create+setup tx:", txHash);

      await waitUntilPermissionActive(TEE_URL, hostSlotPda);
      console.log("[TEE] Host slot record permission active");

      return txHash;
    },
    [program, publicKey, signAndSend]
  );

  // Host: after guest joins, create meeting permission + delegate meeting PDA
  const setupMeetingPermission = useCallback(
    async (meetingId: number, guestAddress: string) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const meetingIdBn = new BN(meetingId);
      const guestPubkey = new PublicKey(guestAddress);
      const [meetingPda] = getMeetingPda(meetingIdBn);

      // Meeting permission: both host and guest
      const meetingMembers: Member[] = [
        { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: publicKey },
        { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: guestPubkey },
      ];

      const createMeetingPermIx = await program.methods
        .createPermission(
          { meeting: { meetingId: meetingIdBn } },
          meetingMembers
        )
        .accountsPartial({
          payer: publicKey,
          permissionedAccount: meetingPda,
          permission: permissionPdaFromAccount(meetingPda),
        })
        .instruction();

      // Delegate meeting permission to TEE
      const delegateMeetingPermIx = createDelegatePermissionInstruction({
        payer: publicKey,
        validator: TEE_VALIDATOR,
        permissionedAccount: [meetingPda, false],
        authority: [publicKey, true],
      });

      // Delegate meeting PDA to TEE (MUST happen after permission exists)
      const delegateMeetingPdaIx = await program.methods
        .delegatePda({ meeting: { meetingId: meetingIdBn } })
        .accounts({
          payer: publicKey,
          validator: TEE_VALIDATOR,
          pda: meetingPda,
        })
        .instruction();

      const tx = new Transaction().add(
        createMeetingPermIx,
        delegateMeetingPermIx,
        delegateMeetingPdaIx
      );

      const txHash = await signAndSend(tx);
      console.log("[TEE] Meeting permission tx:", txHash);

      // Wait for the meeting permission to be active on TEE before proceeding
      await waitUntilPermissionActive(TEE_URL, meetingPda);
      console.log("[TEE] Meeting permission active on TEE");

      return txHash;
    },
    [program, publicKey, signAndSend]
  );

  // Guest: join meeting + permissions + delegation in ONE transaction
  const joinAndSetupGuest = useCallback(
    async (meetingId: number) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const meetingIdBn = new BN(meetingId);
      const [guestSlotPda] = getSlotRecordPda(meetingIdBn, publicKey);

      // Join meeting instruction
      const joinMeetingIx = await program.methods
        .joinMeeting(meetingIdBn)
        .accounts({ guest: publicKey })
        .instruction();

      // Guest slot record permission (only guest can see)
      const guestMembers: Member[] = [
        { flags: AUTHORITY_FLAG | TX_LOGS_FLAG, pubkey: publicKey },
      ];

      const createGuestSlotPermIx = await program.methods
        .createPermission(
          { slotRecord: { meetingId: meetingIdBn, owner: publicKey } },
          guestMembers
        )
        .accountsPartial({
          payer: publicKey,
          permissionedAccount: guestSlotPda,
          permission: permissionPdaFromAccount(guestSlotPda),
        })
        .instruction();

      // Delegate guest slot record permission to TEE
      const delegateGuestSlotPermIx = createDelegatePermissionInstruction({
        payer: publicKey,
        validator: TEE_VALIDATOR,
        permissionedAccount: [guestSlotPda, false],
        authority: [publicKey, true],
      });

      // Delegate guest slot record PDA to TEE
      // NOTE: Meeting PDA delegation moved to setupMeetingPermission (must happen AFTER permission exists)
      const delegateGuestSlotIx = await program.methods
        .delegatePda({
          slotRecord: { meetingId: meetingIdBn, owner: publicKey },
        })
        .accounts({
          payer: publicKey,
          validator: TEE_VALIDATOR,
          pda: guestSlotPda,
        })
        .instruction();

      // Single transaction: join + permissions + delegate guest slot only
      const tx = new Transaction().add(
        joinMeetingIx,
        createGuestSlotPermIx,
        delegateGuestSlotPermIx,
        delegateGuestSlotIx
      );

      const txHash = await signAndSend(tx);
      console.log("[TEE] Guest join+setup tx:", txHash);

      await waitUntilPermissionActive(TEE_URL, guestSlotPda);
      console.log("[TEE] Guest slot record permission active");

      return txHash;
    },
    [program, publicKey, signAndSend]
  );

  // Authenticate with TEE (signMessage popup)
  const authenticateTee = useCallback(async () => {
    if (!publicKey || !signMessage)
      throw new Error("Wallet not connected or signMessage not available");

    const authToken = await getAuthToken(TEE_URL, publicKey, signMessage);
    authTokenRef.current = authToken;

    teeConnectionRef.current = new Connection(
      `${TEE_URL}?token=${authToken.token}`,
      {
        wsEndpoint: `${TEE_WS_URL}?token=${authToken.token}`,
        commitment: "confirmed",
      }
    );

    console.log("[TEE] Authenticated, token expires:", authToken.expiresAt);
    return authToken;
  }, [publicKey, signMessage]);

  // 6. Submit slots via TEE RPC
  const submitSlotsTee = useCallback(
    async (meetingId: number, slots: number[]) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const meetingIdBn = new BN(meetingId);
      const slotsArray = Array.from({ length: 8 }, (_, i) => slots[i] || 0);

      const submitIx = await program.methods
        .submitSlots(meetingIdBn, Buffer.from(slotsArray))
        .accounts({ player: publicKey })
        .instruction();

      const tx = new Transaction().add(submitIx);
      const txHash = await signAndSendTee(tx);

      console.log("[TEE] submit_slots tx:", txHash);
      return txHash;
    },
    [program, publicKey, signAndSendTee]
  );

  // 7. Compute result via TEE RPC (host only)
  const computeResultTee = useCallback(
    async (meetingId: number) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");
      const teeConn = teeConnectionRef.current;
      if (!teeConn) throw new Error("TEE connection not established");

      const meetingIdBn = new BN(meetingId);
      const [meetingPda] = getMeetingPda(meetingIdBn);

      // Fetch meeting account from TEE to get host and guest addresses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meetingAccount: any = await (program.account as any)[
        "meeting"
      ].fetch(meetingPda, "confirmed", teeConn);

      const hostPubkey = meetingAccount.host as PublicKey;
      const guestPubkey = meetingAccount.guest as PublicKey;
      const [hostSlotPda] = getSlotRecordPda(meetingIdBn, hostPubkey);
      const [guestSlotPda] = getSlotRecordPda(meetingIdBn, guestPubkey);

      const computeIx = await program.methods
        .computeResult()
        .accountsPartial({
          meeting: meetingPda,
          hostSlotRecord: hostSlotPda,
          guestSlotRecord: guestSlotPda,
          permissionMeeting: permissionPdaFromAccount(meetingPda),
          permissionHost: permissionPdaFromAccount(hostSlotPda),
          permissionGuest: permissionPdaFromAccount(guestSlotPda),
          payer: publicKey,
        })
        .instruction();

      const tx = new Transaction().add(computeIx);
      const txHash = await signAndSendTee(tx);

      console.log("[TEE] compute_result tx:", txHash);

      // Read result from TEE
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await (program.account as any)["meeting"].fetch(
        meetingPda,
        "confirmed",
        teeConn
      );

      return {
        slot: result.resultSlot as number,
        score: result.resultScore as number,
        valid: result.validOverlap as boolean,
        txHash,
        meetingAccount: meetingPda.toBase58(),
      };
    },
    [program, publicKey, signAndSendTee]
  );

  // Fetch meeting account from devnet
  const fetchMeetingAccount = useCallback(
    async (meetingId: number) => {
      if (!program) return null;

      const meetingIdBn = new BN(meetingId);
      const [meetingPda] = getMeetingPda(meetingIdBn);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account: any = await (program.account as any)["meeting"].fetch(
          meetingPda
        );
        return {
          meetingId: (account.meetingId as BN).toNumber(),
          host: (account.host as PublicKey).toBase58(),
          guest: account.guest
            ? (account.guest as PublicKey).toBase58()
            : null,
          resultSlot: account.resultSlot ?? null,
          resultScore: account.resultScore ?? null,
          validOverlap: account.validOverlap as boolean,
          resolved: account.resolved as boolean,
        };
      } catch {
        return null;
      }
    },
    [program]
  );

  return {
    createAndSetupHost,
    setupMeetingPermission,
    joinAndSetupGuest,
    authenticateTee,
    submitSlotsTee,
    computeResultTee,
    fetchMeetingAccount,
  };
}
