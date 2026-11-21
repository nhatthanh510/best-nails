// Records one onboarding video: a Playwright walk-through of the local app, paced by the
// Vietnamese narration, with a visible cursor, highlights and captions drawn in the page, then
// muxed with the voice by ffmpeg into an .mp4 plus a .vi.srt.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_VOICE, speak } from "./tts.mjs";

const pick = (v) => Object.fromEntries(["voice", "speed", "captions"].filter((k) => v[k] !== undefined).map((k) => [k, v[k]]));

process.loadEnvFile(".env.local");

export const BASE_URL = process.env.ONBOARDING_BASE_URL ?? "http://localhost:3000";
const ADMIN_VIEWPORT = { width: 1280, height: 800 }; // admin on a PC
export const KIOSK_VIEWPORT = { width: 1180, height: 820 }; // the shop's iPad in landscape
let VIEWPORT = ADMIN_VIEWPORT;
const GAP = 0.45; // seconds of quiet after each line
const ADMIN = { email: process.env.ONBOARDING_ADMIN_EMAIL ?? "admin@gmail.com", password: process.env.ONBOARDING_ADMIN_PASSWORD ?? "12345678" };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cursor, click ripple, highlight ring and caption bar, re-added on every page load.
const OVERLAY = () => {
  const install = () => {
    if (document.getElementById("ob-style")) return;
    const style = document.createElement("style");
    style.id = "ob-style";
    style.textContent = `
      nextjs-portal { display: none !important; }
      #ob-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
        transform: translate(var(--x, -50px), var(--y, -50px)); transition: transform 40ms linear; }
      #ob-cursor svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
      .ob-ripple { position: fixed; z-index: 2147483646; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
        border: 3px solid rgba(138,105,20,.9); pointer-events: none; animation: ob-ripple .55s ease-out forwards; }
      @keyframes ob-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.6); opacity: 0 } }
      #ob-ring { position: fixed; z-index: 2147483645; pointer-events: none; border-radius: 14px; opacity: 0;
        box-shadow: 0 0 0 3px #c9a227, 0 0 0 9999px rgba(30,20,10,.28); transition: all .35s ease; }
      #ob-caption { position: fixed; z-index: 2147483647; left: 50%; bottom: 22px; transform: translateX(-50%);
        max-width: 960px; width: max-content; padding: 12px 22px; border-radius: 14px; pointer-events: none;
        background: rgba(35,25,15,.86); color: #fff; font: 600 21px/1.4 "Plus Jakarta Sans", system-ui, sans-serif;
        text-align: center; opacity: 0; transition: opacity .25s; }
    `;
    document.documentElement.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "ob-cursor";
    cursor.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6L9.5 20z" fill="#fff" stroke="#222" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    const ring = document.createElement("div");
    ring.id = "ob-ring";
    const caption = document.createElement("div");
    caption.id = "ob-caption";
    document.documentElement.append(cursor, ring, caption);
    const last = window.__obState ?? (window.__obState = {});
    addEventListener("mousemove", (e) => {
      cursor.style.setProperty("--x", `${e.clientX - 3}px`);
      cursor.style.setProperty("--y", `${e.clientY - 2}px`);
    }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.className = "ob-ripple";
      r.style.left = `${e.clientX}px`;
      r.style.top = `${e.clientY}px`;
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    if (last.caption) window.__obCaption(last.caption);
  };
  window.__obCaption = (text) => {
    const el = document.getElementById("ob-caption");
    if (!el) return;
    el.textContent = text ?? "";
    el.style.opacity = text ? "1" : "0";
  };
  window.__obRing = (rect) => {
    const el = document.getElementById("ob-ring");
    if (!el) return;
    if (!rect) return void (el.style.opacity = "0");
    const pad = 6;
    Object.assign(el.style, { left: `${rect.x - pad}px`, top: `${rect.y - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px`, opacity: "1" });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

/** Helpers a video script uses inside its steps. */
function helpers(page) {
  let mouse = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  const h = {
    page,
    sleep,
    async moveTo(locator, { steps = 28 } = {}) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error(`Not visible: ${locator}`);
      const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(target.x, target.y, { steps });
      mouse = target;
    },
    async click(locator) {
      await h.moveTo(locator);
      await sleep(250);
      await locator.click();
    },
    async type(locator, text, delay = 110) {
      await h.click(locator);
      await locator.pressSequentially(text, { delay });
    },
    async highlight(locator) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.evaluate((r) => window.__obRing?.(r), box);
    },
    async unhighlight() {
      await page.evaluate(() => window.__obRing?.(null));
    },
    async caption(text) {
      await page.evaluate((t) => {
        (window.__obState ??= {}).caption = t;
        window.__obCaption?.(t);
      }, text);
    },
    async scrollBy(dy) {
      await page.mouse.wheel(0, dy);
      await sleep(600);
    },
    get mouse() {
      return mouse;
    },
  };
  return h;
}

function srtTime(s) {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** --voice="Ngọc Lan" --speed=1.1 --captions=both on the command line override the video's own choice. */
function cliOptions() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(voice|speed|captions)=(.+)$/);
    if (m) out[m[1]] = m[1] === "speed" ? Number(m[2]) : m[2];
  }
  return out;
}

const CAPTION_MODES = ["both", "screen", "srt", "none"];

/**
 * video = { folder, file, title, warmUp: [paths], prepare?: async () => {}, start: path,
 *           voice?: VieNeu voice name, speed?: 1, captions?: "both" | "screen" | "srt" | "none",
 *           viewport?: KIOSK_VIEWPORT for kiosk videos (default: admin 1280×800),
 *           steps: [{ say, run?: async (h, seconds) => {} }] }
 * captions: "screen" draws them in the video, "srt" writes a .vi.srt next to it, "both" does both.
 * Each step shows its caption, plays its line and runs its actions at the same time; the next
 * step starts when both are done.
 */
export async function record(video) {
  const opts = { voice: DEFAULT_VOICE, speed: 1, captions: "both", ...pick(video), ...cliOptions() };
  if (!CAPTION_MODES.includes(opts.captions)) throw new Error(`captions must be one of ${CAPTION_MODES.join(", ")}`);
  VIEWPORT = video.viewport ?? ADMIN_VIEWPORT;
  const onScreen = opts.captions === "both" || opts.captions === "screen";
  const srtFile = opts.captions === "both" || opts.captions === "srt";
  const outDir = path.join("docs/onboarding-videos", video.folder);
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(path.join(os.tmpdir(), "onboarding-"));

  console.log(`Narration: ${video.steps.length} lines`);
  const lines = [];
  console.log(`Voice: ${opts.voice} · speed ${opts.speed} · captions ${opts.captions}`);
  for (const step of video.steps) lines.push(await speak(step.say, opts.voice, opts.speed));

  if (video.prepare) await video.prepare();

  const browser = await chromium.launch();
  try {
    // Sign in and compile every route first, off camera.
    const warm = await browser.newContext({ viewport: VIEWPORT, locale: "en-AU", timezoneId: "Australia/Hobart" });
    const wp = await warm.newPage();
    await wp.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle" });
    await wp.getByLabel("Email").fill(ADMIN.email);
    await wp.getByLabel("Password", { exact: true }).fill(ADMIN.password);
    await wp.getByRole("button", { name: "Sign in" }).click();
    await wp.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
    for (const p of video.warmUp ?? []) await wp.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle" });
    const storageState = await warm.storageState();
    await warm.close();

    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      locale: "en-AU",
      timezoneId: "Australia/Hobart",
      storageState,
      recordVideo: { dir: work, size: VIEWPORT },
    });
    await ctx.addInitScript(OVERLAY);
    const page = await ctx.newPage();
    const t0 = Date.now();
    const now = () => (Date.now() - t0) / 1000;
    await page.goto(`${BASE_URL}${video.start}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const h = helpers(page);
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await sleep(800);

    const cues = [];
    for (const [i, step] of video.steps.entries()) {
      const { file, seconds } = lines[i];
      const at = now();
      if (onScreen) await h.caption(step.say);
      await Promise.all([step.run ? step.run(h, seconds) : null, sleep((seconds + GAP) * 1000)]);
      cues.push({ at, seconds, file, text: step.say });
      console.log(`  ${String(i + 1).padStart(2)}. ${at.toFixed(1)}s  ${step.say.slice(0, 60)}…`);
    }
    await h.caption(null);
    await h.unhighlight();
    await sleep(1200);
    const end = now();
    await ctx.close();

    const webm = readdirSync(work).find((f) => f.endsWith(".webm"));
    const trim = Math.max(0, cues[0].at - 0.6);

    // Voice track: each line placed at its step's start, shifted by the trim.
    const inputs = cues.flatMap((c) => ["-i", c.file]);
    const filters = cues.map((c, i) => `[${i + 1}:a]adelay=${Math.round((c.at - trim) * 1000)}:all=1[a${i}]`);
    const mix = `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0,apad[aout]`;
    const out = path.join(outDir, `${video.file}.mp4`);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-ss", String(trim), "-i", path.join(work, webm),
      ...inputs,
      "-filter_complex", [...filters, mix].join(";"),
      "-map", "0:v", "-map", "[aout]",
      "-t", String(end - trim),
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "160k",
      out,
    ]);

    const srtPath = path.join(outDir, `${video.file}.vi.srt`);
    if (srtFile) {
      const srt = cues.map((c, i) => `${i + 1}\n${srtTime(c.at - trim)} --> ${srtTime(c.at - trim + c.seconds + 0.3)}\n${c.text}\n`).join("\n");
      writeFileSync(srtPath, srt);
    } else rmSync(srtPath, { force: true });
    console.log(`Saved ${out} (${(end - trim).toFixed(1)}s)`);
    return out;
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}
