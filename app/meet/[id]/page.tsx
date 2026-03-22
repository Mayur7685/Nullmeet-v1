"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { NullmeetLogo } from "@/components/NullmeetLogo";
import { MeetingLobby } from "@/components/MeetingLobby";
import { SlotSelector } from "@/components/SlotSelector";
import { MeetingResult } from "@/components/MeetingResult";
import { useMeeting } from "@/hooks/useMeeting";
import { useNullmeet } from "@/hooks/useNullmeet";

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const meetingId = params.id as string;
  const isJoining = searchParams.get("join") === "1";

  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  const {
    step,
    setStep,
    isHost,
    guestJoined,
    guestReady,
    guestAddress,
    result,
    createMeeting,
    joinMeeting,
    signalReady,
    broadcastResult,
  } = useMeeting(meetingId, walletAddress);

  const {
    createAndSetupHost,
    setupMeetingPermission,
    joinAndSetupGuest,
    authenticateTee,
    prefetchTeeBlockhash,
    submitSlotsTee,
    computeResultTee,
  } = useNullmeet();

  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [computeTxHash, setComputeTxHash] = useState<string | null>(null);
  const [meetingAccount, setMeetingAccount] = useState<string | null>(null);
  const initRef = useRef(false);
  const delegatingRef = useRef(false);
  const submittingRef = useRef(false);
  const computingRef = useRef(false);

  const isUserRejection = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes("User rejected") ||
      msg.includes("user rejected") ||
      msg.includes("User denied") ||
      msg.includes("cancelled") ||
      msg.includes("canceled") ||
      msg.includes("Transaction was not confirmed")
    );
  };

  const handleError = (err: unknown, retry: () => void) => {
    console.error("Transaction error:", err);
    const msg = err instanceof Error ? err.message : "Transaction failed";
    if (isUserRejection(err)) {
      setErrorMsg("Transaction cancelled. Please try again.");
    } else {
      setErrorMsg(msg);
    }
    setRetryAction(() => retry);
  };

  const clearError = () => {
    setErrorMsg(null);
    setRetryAction(null);
  };

  // HOST: Create meeting + setup TEE in one transaction (1 popup)
  // GUEST: Join meeting + setup TEE in one transaction (1 popup)
  useEffect(() => {
    if (!connected || !walletAddress) return;
    if (initRef.current) return;

    const init = async () => {
      initRef.current = true;
      clearError();
      try {
        if (isJoining) {
          setStatus("Joining meeting & setting up TEE...");
          await joinAndSetupGuest(Number(meetingId));
          joinMeeting();

          setStatus("Authenticating with TEE enclave...");
          await authenticateTee();

          setStatus("");
          setStep("select-slots");
        } else {
          setStatus("Creating meeting & setting up TEE...");
          await createAndSetupHost(Number(meetingId));
          createMeeting();

          setStatus("Authenticating with TEE enclave...");
          await authenticateTee();

          setStatus("");
        }
      } catch (err) {
        setStatus("");
        handleError(err, () => {
          initRef.current = false;
          init();
        });
      }
    };

    init();
  }, [connected, walletAddress]);

  // HOST: When guest joins, create meeting permission (1 popup)
  useEffect(() => {
    if (!isHost || !guestJoined || !guestAddress) return;
    if (step !== "lobby") return;
    if (delegatingRef.current) return;

    const setupMeetingPerm = async () => {
      delegatingRef.current = true;
      clearError();
      try {
        setStep("delegating");
        setStatus("Guest joined! Approve the transaction to set up the private enclave.");
        await setupMeetingPermission(Number(meetingId), guestAddress);
        setStatus("");
        setStep("select-slots");
      } catch (err) {
        setStatus("");
        handleError(err, () => {
          delegatingRef.current = false;
          setupMeetingPerm();
        });
      }
    };

    setupMeetingPerm();
  }, [isHost, guestJoined, guestAddress, step, meetingId, setupMeetingPermission, setStep]);

  // Prefetch TEE blockhash when entering slot selection so wallet popup is instant
  useEffect(() => {
    if (step === "select-slots") {
      prefetchTeeBlockhash();
    }
  }, [step, prefetchTeeBlockhash]);

  const handleSubmitSlots = async (slots: number[]) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    clearError();
    try {
      setStep("submitting");
      setStatus("Submitting slots to TEE enclave...");

      await submitSlotsTee(Number(meetingId), slots);

      if (!isHost) {
        signalReady();
        setStep("waiting");
        setStatus("Waiting for host to calculate result...");
      } else {
        setStep("waiting");
        setStatus("");
      }
    } catch (err) {
      setStatus("");
      setStep("select-slots");
      submittingRef.current = false;
      handleError(err, () => handleSubmitSlots(slots));
    }
  };

  const handleComputeResult = async () => {
    if (computingRef.current) return;
    computingRef.current = true;
    clearError();
    try {
      setStep("computing");
      setStatus("Computing result inside TEE enclave...");

      const res = await computeResultTee(Number(meetingId));

      setComputeTxHash(res.txHash);
      setMeetingAccount(res.meetingAccount);
      broadcastResult(res.slot, res.score, res.valid);
      setStep("result");
    } catch (err) {
      setStatus("");
      setStep("waiting");
      computingRef.current = false;
      handleError(err, handleComputeResult);
    }
  };

  if (!connected) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-6">
          <NullmeetLogo size="md" className="justify-center" />
          <p className="text-[var(--muted)]">Connect your wallet to continue</p>
          <WalletMultiButton />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <NullmeetLogo size="sm" />
          <WalletMultiButton />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {["Lobby", "TEE", "Select", "Submit", "Wait", "Result"].map(
            (label, i) => {
              const steps: string[] = [
                "lobby",
                "delegating",
                "select-slots",
                "submitting",
                "waiting",
                "result",
              ];
              const currentIdx = steps.indexOf(step);
              const isActive = i <= currentIdx;
              return (
                <div
                  key={label}
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    isActive ? "bg-purple-500" : "bg-[var(--border)]"
                  }`}
                />
              );
            }
          )}
        </div>

        {/* Error banner with retry */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center space-y-3">
            <p className="text-[var(--error)] text-sm">{errorMsg}</p>
            {retryAction && (
              <button
                onClick={() => {
                  clearError();
                  retryAction();
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Content based on step */}
        {step === "lobby" && (
          <>
            {status && (
              <div className="text-center text-[var(--muted)] py-4">
                <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
                {status}
              </div>
            )}
            <MeetingLobby
              meetingId={meetingId}
              isHost={isHost}
              guestJoined={guestJoined}
              hostAddress={walletAddress || undefined}
            />
          </>
        )}

        {step === "delegating" && (
          <div className="text-center space-y-4 py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
            <div className="text-lg font-medium text-purple-500">
              Setting up Private Enclave
            </div>
            <div className="text-[var(--muted)] text-sm">{status}</div>
          </div>
        )}

        {step === "select-slots" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">
              Select Your Availability
            </h2>
            <p className="text-sm text-[var(--muted)] text-center">
              Your selections are encrypted inside the TEE enclave
            </p>
            <SlotSelector onSubmit={handleSubmitSlots} />
          </div>
        )}

        {step === "submitting" && (
          <div className="text-center space-y-4 py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
            <div className="text-[var(--muted)]">{status}</div>
          </div>
        )}

        {step === "waiting" && isHost && (
          <div className="text-center space-y-6 py-12">
            {!guestReady ? (
              <>
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
                <div className="text-[var(--warning)]">
                  Your slots are submitted. Waiting for guest to submit theirs...
                </div>
              </>
            ) : (
              <>
                <div className="text-[var(--success)] text-lg font-medium">
                  Both parties have submitted!
                </div>
                <p className="text-[var(--muted)] text-sm">
                  Click below to compute the best meeting time inside the TEE enclave.
                </p>
                <button
                  onClick={handleComputeResult}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Calculate Best Time
                </button>
              </>
            )}
          </div>
        )}

        {step === "waiting" && !isHost && (
          <div className="text-center space-y-4 py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
            <div className="text-[var(--muted)]">Waiting for host to calculate result...</div>
          </div>
        )}

        {step === "computing" && (
          <div className="text-center space-y-4 py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
            <div className="text-[var(--muted)]">{status}</div>
          </div>
        )}

        {step === "result" && result && (
          <MeetingResult
            resultSlot={result.slot}
            resultScore={result.score}
            validOverlap={result.valid}
            txHash={computeTxHash}
            meetingAccount={meetingAccount}
          />
        )}
      </div>
    </main>
  );
}
