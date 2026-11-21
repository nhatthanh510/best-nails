// Vietnamese narration from VieNeu (https://api.vieneu.io), cached by text + voice so re-recording
// a video doesn't pay for the same lines again.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.vieneu.io/api/v1/audio/speech";
export const CACHE_DIR = "scripts/onboarding-videos/.cache/tts";
export const DEFAULT_VOICE = "Ngọc Lan"; // female, soft and calm

export function audioDuration(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(out.toString().trim());
}

/** Returns { file, seconds } for one line of narration. speed: 1 = normal, e.g. 0.9 slower, 1.15 faster. */
export async function speak(text, voice = DEFAULT_VOICE, speed = 1) {
  const key = process.env.VNE_NEU_API_KEY;
  if (!key) throw new Error("VNE_NEU_API_KEY is missing from .env.local");
  mkdirSync(CACHE_DIR, { recursive: true });
  const hash = createHash("sha256").update(speed === 1 ? `${voice}\n${text}` : `${voice}\n${speed}\n${text}`).digest("hex").slice(0, 16);
  const file = path.join(CACHE_DIR, `${hash}.mp3`);
  if (!existsSync(file)) {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text, voice, response_format: "mp3", ...(speed === 1 ? {} : { speed }) }),
    });
    if (!res.ok) throw new Error(`VieNeu ${res.status}: ${await res.text()}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return { file, seconds: audioDuration(file) };
}
