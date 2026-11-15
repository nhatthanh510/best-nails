/** A piece of text, and whether it's part of what the search matched. */
export type TextPart = { text: string; match: boolean };

/** `text` split around every case-insensitive occurrence of `needle` (nothing matches an empty needle). */
export function splitMatches(text: string, needle: string): TextPart[] {
  if (!needle || !text) return [{ text, match: false }];
  const parts: TextPart[] = [];
  const haystack = text.toLowerCase();
  const lower = needle.toLowerCase();
  let from = 0;
  for (let at = haystack.indexOf(lower); at !== -1; at = haystack.indexOf(lower, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + lower.length), match: true });
    from = at + lower.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

/** A search as the Gift cards list matches it: a code without spaces or dashes, or part of a name. */
export function giftCardSearchTerms(q: string) {
  const term = q.trim();
  return { code: term.toUpperCase().replace(/[^A-Z0-9]/g, ""), name: term };
}

/**
 * Whether a row could be a result of search `q`, from the codes and customer names it shows: for
 * filtering the rows on screen while the real search runs on the server (which also matches phone
 * numbers and customers who used a card, so it has the last word).
 */
export function matchesShown(codes: string, names: string, q: string) {
  const { code, name } = giftCardSearchTerms(q);
  if (!name) return true;
  return (!!code && codes.toUpperCase().includes(code)) || names.toLowerCase().includes(name.toLowerCase());
}
