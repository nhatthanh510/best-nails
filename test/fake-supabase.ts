import { vi } from "vitest";

type Result = { data: unknown; error: unknown };

/**
 * A stand-in for a Supabase client in Server Action tests. Every table query resolves to
 * `next.query` and every RPC to `next.rpc`; `calls` records what the action asked for.
 */
export function fakeSupabase() {
  const next: { query: Result; rpc: Result } = { query: { data: null, error: null }, rpc: { data: null, error: null } };
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "delete", "eq", "neq", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.single = async () => next.query;
    builder.maybeSingle = async () => next.query;
    // Awaiting the builder itself (e.g. `await supabase.from(t).update(x).eq(...)`).
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(next.query).then(resolve, reject);
    return builder;
  });

  const client = {
    from,
    rpc: vi.fn(async () => next.rpc),
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null as unknown })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  return { client, next, calls };
}

/** next/navigation's redirect() throws; this does the same so tests can assert where it went. */
export class Redirect extends Error {
  constructor(public readonly to: string) {
    super(`NEXT_REDIRECT ${to}`);
  }
}
