import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "75K6oNA9gF2gArS4yySXF7cXQPjareTuthuLjeTsRa7P"
);

export const TEE_RPC_URL =
  process.env.NEXT_PUBLIC_TEE_RPC || "https://tee.magicblock.app";

export const TEE_VALIDATOR = new PublicKey(
  process.env.NEXT_PUBLIC_TEE_VALIDATOR ||
    "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA"
);

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3030";

export const MEETING_SEED = Buffer.from("meeting");
export const SLOT_RECORD_SEED = Buffer.from("slot_record");

export const TIME_LABELS = [
  "9–10 AM",
  "10–11 AM",
  "11–12 PM",
  "12–1 PM",
  "1–2 PM",
  "2–3 PM",
  "3–4 PM",
  "4–5 PM",
];
