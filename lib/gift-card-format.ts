"use client";

import { useSyncExternalStore } from "react";
import { isGiftCardFormat, type GiftCardFormat } from "@/lib/gift-card-sheet";

/**
 * The printed gift card format last picked (business card or A6), remembered on this device so
 * every Print and Download PDF in the admin uses it until someone picks the other one. Only a
 * convenience: without storage it's the business card.
 */

const KEY = "best-nails:gift-card-format";
const EVENT = "gift-card-format";

function read(): GiftCardFormat {
  try {
    const v = localStorage.getItem(KEY);
    return isGiftCardFormat(v) ? v : "business";
  } catch {
    return "business";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setGiftCardFormat(format: GiftCardFormat) {
  try {
    localStorage.setItem(KEY, format);
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
    memory = format;
  }
  window.dispatchEvent(new Event(EVENT));
}

let memory: GiftCardFormat | null = null;

export function useGiftCardFormat(): [GiftCardFormat, (format: GiftCardFormat) => void] {
  const format = useSyncExternalStore(subscribe, () => memory ?? read(), () => "business" as const);
  return [format, setGiftCardFormat];
}
