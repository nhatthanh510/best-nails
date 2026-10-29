// Number-only text fields, without type="number" (which allows "e", "+" and "-", changes the value
// on scroll, and hides what was typed when it isn't a number). Spread onto an <input>:
// <Input {...numberInput("money")} />. Typing a character that doesn't fit is ignored (the cursor
// stays put); pasted text is cleaned. For a controlled field, also pass the new value through
// cleanNumber() in onChange.

export type NumberKind = "digits" | "money" | "phone";

const VALID: Record<NumberKind, RegExp> = {
  digits: /^[0-9]*$/,
  // Dollars and cents: one decimal point, at most two decimals.
  money: /^[0-9]*(\.[0-9]{0,2})?$/,
  // Local Australian numbers only (0412 345 678): no "+", the shop has no overseas customers.
  phone: /^[0-9()\s-]*$/,
};

/** `value` with everything that doesn't fit `kind` removed. */
export function cleanNumber(kind: NumberKind, value: string): string {
  if (kind === "digits") return value.replace(/[^0-9]/g, "");
  // A pasted or autofilled "+61 412…" (or "+61 (0) 412…") becomes the local "0412…".
  if (kind === "phone") return value.replace(/^\s*\+\s*61\s*(\(0\))?\s*/, "0").replace(/[^0-9()\s-]/g, "");
  const [whole, ...rest] = value.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function numberInput(kind: NumberKind) {
  return {
    inputMode: kind === "phone" ? ("tel" as const) : kind === "money" ? ("decimal" as const) : ("numeric" as const),
    onBeforeInput: (e: React.FormEvent<HTMLInputElement>) => {
      const data = (e.nativeEvent as InputEvent).data;
      if (data == null) return;
      const el = e.currentTarget;
      const next = el.value.slice(0, el.selectionStart ?? el.value.length) + data + el.value.slice(el.selectionEnd ?? el.value.length);
      if (!VALID[kind].test(next)) e.preventDefault();
    },
    // Pastes and autofill don't go through onBeforeInput's check.
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const clean = cleanNumber(kind, el.value);
      if (clean !== el.value) el.value = clean;
    },
  };
}
