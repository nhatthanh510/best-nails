"use client";

import { Hand } from "lucide-react";

const button = "flex min-h-16 flex-1 items-center justify-center gap-2.5 rounded-2xl px-6 text-xl font-extrabold";

/**
 * The warning before the idle reset, as on self-order kiosks: the seconds left in a ring, and two
 * buttons. Only "I'm still here" or "Start over" close it; a tap anywhere else does nothing, so a
 * stray touch can't hide it. It covers the screen so a passer-by sees no more of the customer's
 * details than before.
 */
export function StillThere({
  secondsLeft,
  onStillHere,
  onStartOver,
}: {
  secondsLeft: number;
  onStillHere: () => void;
  onStartOver: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="still-there-title"
      aria-describedby="still-there-text"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border border-kiosk-line bg-kiosk-surface p-8 text-center text-kiosk-ink">
        <span
          role="timer"
          aria-label={`${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"} left`}
          className="flex size-24 items-center justify-center rounded-full border-4 border-kiosk-accent font-heading text-5xl font-bold lining-nums tabular-nums"
        >
          {secondsLeft}
        </span>
        <h2 id="still-there-title" className="font-heading text-4xl font-bold">
          Still there?
        </h2>
        <p id="still-there-text" className="text-lg text-kiosk-muted">
          Tap &ldquo;I&apos;m still here&rdquo; to keep going.
        </p>
        <div className="flex w-full gap-3">
          <button type="button" onClick={onStartOver} className={`${button} border-2 border-kiosk-line`}>
            Start over
          </button>
          <button type="button" autoFocus onClick={onStillHere} className={`${button} bg-gold-sheen bg-kiosk-accent text-kiosk-bg`}>
            <Hand className="size-6" aria-hidden="true" />
            I&apos;m still here
          </button>
        </div>
      </div>
    </div>
  );
}
