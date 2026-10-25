"use client";

import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const keyBase =
  "flex min-h-14 items-center justify-center sm:min-h-17 lg:min-h-15 rounded-[20px] select-none transition-transform duration-75 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-kiosk-accent";

export function Numpad({
  onDigit,
  onClear,
  onBackspace,
}: {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  const digit = (d: string) => (
    <button
      key={d}
      type="button"
      onClick={() => onDigit(d)}
      className={`${keyBase} bg-kiosk-surface text-[40px] font-semibold text-kiosk-ink active:bg-kiosk-line`}
    >
      {d}
    </button>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-3.5">
      {KEYS.map(digit)}
      <button
        type="button"
        onClick={onClear}
        className={`${keyBase} border-2 border-kiosk-line text-[22px] font-bold text-kiosk-muted active:bg-kiosk-surface`}
      >
        Clear
      </button>
      {digit("0")}
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Delete last digit"
        className={`${keyBase} border-2 border-kiosk-line text-kiosk-muted active:bg-kiosk-surface`}
      >
        <Delete className="size-9" strokeWidth={2} />
      </button>
    </div>
  );
}
