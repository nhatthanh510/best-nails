import { splitMatches } from "@/lib/highlight";

/** `text` with the part a search matched marked in soft gold (the text keeps its own colour). */
export function Highlight({ text, term }: { text: string; term?: string }) {
  return splitMatches(text, term ?? "").map((p, i) =>
    p.match ? (
      <mark key={i} className="rounded-sm bg-gold/35 text-inherit">
        {p.text}
      </mark>
    ) : (
      p.text
    ),
  );
}
