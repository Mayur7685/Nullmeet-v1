"use client";

import { useState } from "react";

const TIME_LABELS = [
  "9\u201310 AM",
  "10\u201311 AM",
  "11\u201312 PM",
  "12\u20131 PM",
  "1\u20132 PM",
  "2\u20133 PM",
  "3\u20134 PM",
  "4\u20135 PM",
];

const PREF_LABELS = ["\u2715", "1", "2", "3", "4"];

interface SlotSelectorProps {
  onSubmit: (slots: number[]) => void;
  disabled?: boolean;
}

export function SlotSelector({ onSubmit, disabled }: SlotSelectorProps) {
  const [slots, setSlots] = useState<number[]>(new Array(8).fill(0));

  const cycleSlot = (index: number) => {
    if (disabled) return;
    setSlots((prev) => {
      const next = [...prev];
      next[index] = (next[index] + 1) % 5;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--muted)] mb-2">
        Tap each slot to cycle preference (0 = unavailable, 4 = best)
      </div>
      <div className="grid grid-cols-1 gap-2">
        {TIME_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => cycleSlot(i)}
            disabled={disabled}
            style={{
              backgroundColor: `var(--slot-${slots[i]}-bg)`,
              color: `var(--slot-${slots[i]}-text)`,
            }}
            className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-80 active:scale-[0.97] cursor-pointer"
            }`}
          >
            <span className="font-medium">{label}</span>
            <span className="text-lg font-bold">{PREF_LABELS[slots[i]]}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSubmit(slots)}
        disabled={disabled || slots.every((s) => s === 0)}
        className="w-full mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:active:scale-100 rounded-lg text-white font-medium transition-all cursor-pointer"
      >
        Submit Availability
      </button>
    </div>
  );
}
