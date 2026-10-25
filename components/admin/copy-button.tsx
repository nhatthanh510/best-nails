"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** An icon button that copies `text` (e.g. a gift voucher code) and shows a tick for a moment. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (e.g. not a secure page): the code is on screen to copy by hand.
        }
      }}
      className={cn(
        "inline-flex size-9 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        copied && "text-success hover:text-success",
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  );
}
