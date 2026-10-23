import "server-only";

// Fixed-window limiter kept in memory. Good enough for one shop with one or two kiosks;
// on a multi-instance deployment each instance keeps its own counts.
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
