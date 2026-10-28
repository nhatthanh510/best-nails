"use server";

import { ApiError } from "@google/genai";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { askShop, type AskResult } from "@/lib/assistant/agent";

// Admin only: the answers come from customer data. The tools re-check with requireAdmin()
// on every read, so this is the first of two locks, not the only one.

const MAX_TURNS = 20;

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) }))
  .min(1)
  .refine((h) => h[0].role === "user" && h.at(-1)!.role === "user", "The conversation must start and end with a question.");

export async function askTheShop(history: unknown): Promise<AskResult> {
  await requireAdmin();
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { ok: false, message: "Type a question (up to 2,000 characters)." };
  // Older turns are dropped first, but the conversation still has to start with a question.
  let turns = parsed.data.slice(-MAX_TURNS);
  while (turns[0].role !== "user") turns = turns.slice(1);

  try {
    return await askShop(turns);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403)) {
      console.error("[ask]", error);
      return { ok: false, message: "Gemini refused the request. Check GEMINI_API_KEY in .env.local." };
    }
    // The free tier allows a limited number of requests per minute and per day.
    if (error instanceof ApiError && error.status === 429) return { ok: false, message: "Gemini's limit was reached. Wait a minute and try again." };
    // Every model was overloaded or too slow (the agent already tried the fallback).
    if (!(error instanceof ApiError) || error.status >= 500) {
      console.error("[ask]", error);
      return { ok: false, message: "Gemini is busy right now. Try again in a minute." };
    }
    console.error("[ask]", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
