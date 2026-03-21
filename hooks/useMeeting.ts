"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";

export type MeetingStep =
  | "lobby"
  | "delegating"
  | "select-slots"
  | "submitting"
  | "waiting"
  | "computing"
  | "result";

interface MeetingResult {
  slot: number;
  score: number;
  valid: boolean;
}

export function useMeeting(meetingId: string, walletAddress: string | null) {
  const [step, setStep] = useState<MeetingStep>("lobby");
  const [isHost, setIsHost] = useState(false);
  const [guestJoined, setGuestJoined] = useState(false);
  const [guestAddress, setGuestAddress] = useState<string | null>(null);
  const [guestReady, setGuestReady] = useState(false);
  const [result, setResult] = useState<MeetingResult | null>(null);

  // Track role for reconnection
  const roleRef = useRef<"host" | "guest" | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    const socket = getSocket();

    const onMeetingCreated = () => {
      setIsHost(true);
      roleRef.current = "host";
    };

    const onJoinerConnected = (data: { guestAddress: string }) => {
      console.log("[useMeeting] joiner_connected received:", data.guestAddress);
      setGuestJoined(true);
      setGuestAddress(data.guestAddress);
    };

    const onGuestReady = () => {
      console.log("[useMeeting] guest_ready received");
      setGuestReady(true);
    };

    const onMeetingResult = (data: MeetingResult) => {
      setResult(data);
      setStep("result");
    };

    const onJoinError = (data: { message: string }) => {
      console.error("[useMeeting] join error:", data.message);
    };

    // Re-register with server on reconnect so socket ID stays current
    const onReconnect = () => {
      console.log("[useMeeting] socket reconnected, re-registering...");
      if (roleRef.current === "host") {
        socket.emit("create_meeting", {
          meetingId,
          hostAddress: walletAddress,
        });
      } else if (roleRef.current === "guest") {
        socket.emit("join_meeting", {
          meetingId,
          guestAddress: walletAddress,
        });
      }
    };

    socket.on("meeting_created", onMeetingCreated);
    socket.on("joiner_connected", onJoinerConnected);
    socket.on("guest_ready", onGuestReady);
    socket.on("meeting_result", onMeetingResult);
    socket.on("join_error", onJoinError);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("meeting_created", onMeetingCreated);
      socket.off("joiner_connected", onJoinerConnected);
      socket.off("guest_ready", onGuestReady);
      socket.off("meeting_result", onMeetingResult);
      socket.off("join_error", onJoinError);
      socket.io.off("reconnect", onReconnect);
    };
  }, [walletAddress, meetingId]);

  const createMeeting = useCallback(() => {
    if (!walletAddress) return;
    const socket = getSocket();
    socket.emit("create_meeting", {
      meetingId,
      hostAddress: walletAddress,
    });
    setIsHost(true);
    roleRef.current = "host";
  }, [meetingId, walletAddress]);

  const joinMeeting = useCallback(() => {
    if (!walletAddress) return;
    const socket = getSocket();
    socket.emit("join_meeting", {
      meetingId,
      guestAddress: walletAddress,
    });
    setIsHost(false);
    roleRef.current = "guest";
  }, [meetingId, walletAddress]);

  const signalReady = useCallback(() => {
    const socket = getSocket();
    socket.emit("guest_ready", { meetingId });
  }, [meetingId]);

  const broadcastResult = useCallback(
    (slot: number, score: number, valid: boolean) => {
      const socket = getSocket();
      socket.emit("broadcast_result", { meetingId, slot, score, valid });
    },
    [meetingId]
  );

  return {
    step,
    setStep,
    isHost,
    guestJoined,
    guestAddress,
    guestReady,
    result,
    createMeeting,
    joinMeeting,
    signalReady,
    broadcastResult,
  };
}
