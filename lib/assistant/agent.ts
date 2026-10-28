import "server-only";
import { ApiError, FinishReason, GoogleGenAI, type Content, type Part } from "@google/genai";
import { getSettings } from "@/lib/admin-data";
import { TOOL_DEFINITIONS, describeToolCall, runTool } from "@/lib/assistant/tools";

// "Ask the shop": an agent is a model in a loop with tools. This file is the loop (the
// "harness"), written by hand so each part is visible:
//   1. send the conversation and the tool list to the model;
//   2. if it asks for tools, run them here and send the results back;
//   3. repeat until it answers in plain text, or stop after MAX_STEPS.
// The model never touches the database: it can only ask for the tools in tools.ts. Only this
// file knows the AI provider (Google Gemini); the tools would work the same with another one.

/**
 * Tried in order: when one is overloaded (Gemini answers 503 "high demand", sometimes for a
 * while) or slow, the question moves on to the next. Both are on the free tier.
 */
const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash"];
/**
 * Per request. No retries of the same model (the SDK would otherwise retry for about a minute):
 * moving on to the next one is the retry. The timeout is generous because on the free tier a
 * busy model can take 20–30 s for even a small request; Gemini also gets it as the deadline.
 */
const HTTP_OPTIONS = { timeout: 45_000, retryOptions: { attempts: 1 } };
/** A model that was busy is skipped for this long, so the next questions don't wait for it again. */
const BUSY_FOR_MS = 2 * 60_000;
const busyUntil = new Map<string, number>();
/** A stopping rule: an answer that needs more lookups than this is cut short. */
const MAX_STEPS = 8;

/** Worth trying the next model: overloaded, rate limited, timed out or unreachable. A bad key or request isn't. */
function isBusy(error: unknown) {
  return !(error instanceof ApiError) || [429, 500, 502, 503, 504].includes(error.status);
}

/** Finish reasons where the model declined or was stopped by a safety filter. */
const BLOCKED = new Set<FinishReason | undefined>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AskResult = { ok: true; answer: string; lookups: string[] } | { ok: false; message: string };

function systemPrompt(timezone: string) {
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone });
  return `You answer questions from the owner of Best Nails, a nail salon in Hobart, about their loyalty program. Today is ${today} (${timezone}).

How the program works: customers check in on an iPad kiosk and get 1 point per visit (at most one check-in a day). Points buy rewards (e.g. 10 points = 10% off). Tiers come from lifetime points (all points ever earned): New, Regular, VIP. There's an optional birthday discount, and gift vouchers are prepaid credit spent over several visits. At most one discount per visit.

Use the tools to look things up; never guess numbers or names. If the tools can't answer something, say so plainly and suggest where in the admin to look. You can only read data: if asked to change something (add points, edit a customer, spend a voucher), explain which admin page does it.

Answer in plain text for a busy shop owner: short, friendly, Australian English. No markdown headings, tables or bold; use simple "- " lists when listing people or numbers.`;
}

export async function askShop(history: ChatTurn[]): Promise<AskResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "Ask the shop isn't set up yet: add GEMINI_API_KEY to .env.local and restart the server." };
  }
  const ai = new GoogleGenAI({ apiKey, httpOptions: HTTP_OPTIONS });
  const { timezone } = await getSettings();
  const config = {
    systemInstruction: systemPrompt(timezone),
    tools: [
      {
        functionDeclarations: TOOL_DEFINITIONS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })),
      },
    ],
  };

  // Gemini calls the assistant "model". Earlier turns go back as plain text; within this
  // answer, the model's own turns are appended unchanged (they carry its thought signatures).
  const contents: Content[] = history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] }));
  const lookups: string[] = [];

  // Stays on the model that answered, so one answer comes from one model.
  // The last model is always tried, even if it was busy a moment ago.
  let model = MODELS.findIndex((m, i) => i === MODELS.length - 1 || (busyUntil.get(m) ?? 0) < Date.now());
  const generate = async () => {
    for (;;) {
      try {
        return await ai.models.generateContent({ model: MODELS[model], contents, config });
      } catch (error) {
        if (model === MODELS.length - 1 || !isBusy(error)) throw error;
        console.warn(`[ask] ${MODELS[model]} unavailable, trying ${MODELS[model + 1]}`, error instanceof ApiError ? error.status : error);
        busyUntil.set(MODELS[model], Date.now() + BUSY_FOR_MS);
        model++;
      }
    }
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await generate();
    const candidate = response.candidates?.[0];

    if (response.promptFeedback?.blockReason || BLOCKED.has(candidate?.finishReason)) {
      return { ok: false, message: "That question couldn't be answered. Try asking it another way." };
    }

    const calls = response.functionCalls ?? [];
    if (calls.length === 0 || !candidate?.content) {
      const answer = (response.text ?? "").trim();
      if (candidate?.finishReason === FinishReason.MAX_TOKENS) return { ok: true, answer: `${answer}…`, lookups };
      return { ok: true, answer: answer || "I couldn't find an answer to that.", lookups };
    }

    // The model asked for one or more lookups: run them (together) and send every result back
    // in a single turn, each matched to its call by name (and id, when Gemini gives one).
    contents.push(candidate.content);
    lookups.push(...calls.map((c) => describeToolCall(c.name ?? "", c.args)));
    const results: Part[] = await Promise.all(
      calls.map(async (call) => {
        const result = await runTool(call.name ?? "", call.args);
        return {
          functionResponse: { id: call.id, name: call.name, response: result.ok ? { output: result.output } : { error: result.error } },
        };
      }),
    );
    contents.push({ role: "user", parts: results });
  }

  return { ok: false, message: "That needed too many lookups. Try a narrower question." };
}
