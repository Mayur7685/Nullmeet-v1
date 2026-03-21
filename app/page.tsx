"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { NullmeetLogo } from "@/components/NullmeetLogo";

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();

  const handleStart = () => {
    const meetingId = Math.floor(Math.random() * 1_000_000_000);
    router.push(`/meet/${meetingId}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-lg text-center space-y-8">
        <NullmeetLogo size="lg" className="justify-center" />

        <p className="text-lg text-[var(--muted)] mx-auto">
          Find a common meeting time. Reveal nothing else.
        </p>
        <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
          Two people compute the best meeting slot from their private calendars.
          Neither party sees the other&apos;s availability. Only the result is
          public. Built on MagicBlock&apos;s Private Ephemeral Rollups (TEE) on
          Solana.
        </p>

        <div className="flex flex-col items-center gap-4">
          <WalletMultiButton />

          {connected && (
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 rounded-lg text-white font-medium transition-all cursor-pointer"
            >
              Start a Meeting
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-8 text-sm text-[var(--muted)]">
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <div className="font-medium text-[var(--foreground)] mb-1">Private</div>
            <div>Slots never leave the TEE enclave</div>
          </div>
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <div className="font-medium text-[var(--foreground)] mb-1">On-chain</div>
            <div>Result committed to Solana</div>
          </div>
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <div className="font-medium text-[var(--foreground)] mb-1">Fast</div>
            <div>No ZK proofs — TEE handles compute</div>
          </div>
        </div>
      </div>
    </main>
  );
}
