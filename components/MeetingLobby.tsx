"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface MeetingLobbyProps {
  meetingId: string;
  isHost: boolean;
  guestJoined: boolean;
  hostAddress?: string;
}

export function MeetingLobby({
  meetingId,
  isHost,
  guestJoined,
  hostAddress,
}: MeetingLobbyProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meet/${meetingId}?join=1&host=${hostAddress}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = joinUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isHost) {
    return (
      <div className="text-center space-y-4">
        <div className="text-2xl font-bold">Joining Meeting</div>
        <div className="text-[var(--muted)]">Meeting ID: {meetingId}</div>
        <div className="text-[var(--success)]">Connected! Waiting for host...</div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="text-2xl font-bold">Share this meeting</div>
      <div className="text-[var(--muted)]">Meeting ID: {meetingId}</div>

      <div className="flex justify-center">
        <div className="p-4 bg-white rounded-xl">
          <QRCodeSVG value={joinUrl} size={200} />
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-md mx-auto">
        <input
          readOnly
          value={joinUrl}
          className="flex-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--muted)] truncate"
        />
        <button
          onClick={copyLink}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 rounded-lg text-white text-sm transition-all cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {guestJoined ? (
        <div className="text-[var(--success)] font-medium">
          Guest connected! Both parties ready.
        </div>
      ) : (
        <div className="text-[var(--warning)] animate-pulse">
          Waiting for guest to join...
        </div>
      )}
    </div>
  );
}
