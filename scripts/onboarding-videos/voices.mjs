// Find VieNeu voices for a video by gender, accent and vibe, and optionally render a sample of each.
//   node scripts/onboarding-videos/voices.mjs --gender=female --region=south --vibe=young [--limit=5] [--sample]
// --sample writes one short clip per voice to scripts/onboarding-videos/.cache/samples/ (costs a few hundred characters).
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { speak } from "./lib/tts.mjs";

process.loadEnvFile(".env.local");

// Vibes the skill asks about, matched against the tags in each voice's description.
export const VIBES = {
  young: ["tre trung", "tre", "vui tuoi", "nhanh nhen", "nang dong", "hoat ngon", "gan gui", "tiktok"],
  mature: ["chung chac", "truong thanh", "dung tuoi", "tram am", "tram", "tram tinh", "dieu da"],
  gentle: ["diu dang", "nhe nhang", "ngot ngao", "tu ton", "cham rai", "am ap", "de nghe"],
  clear: ["ro rang", "tin tuc", "thanh thoat", "de nghe", "chuyen nghiep"],
  warm: ["truyen cam", "ke chuyen", "am ap", "tram am", "co cam xuc", "gan gui"],
};
// Comic or distorted voices never suit a training video.
const NEVER = ["meo mo", "tau he", "khong nghiem tuc", "bua", "hai huoc"];

const fold = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const limit = Number(args.limit ?? 5);

const res = await fetch("https://api.vieneu.io/api/v1/voices", { headers: { Authorization: `Bearer ${process.env.VNE_NEU_API_KEY}` } });
if (!res.ok) throw new Error(`VieNeu ${res.status}: ${await res.text()}`);
const { voices } = await res.json();

const wanted = args.vibe ? VIBES[args.vibe] : null;
if (args.vibe && !wanted) throw new Error(`--vibe must be one of: ${Object.keys(VIBES).join(", ")}`);

const scored = voices
  .filter((v) => !args.gender || v.gender === args.gender)
  .filter((v) => !args.region || v.region === args.region)
  .filter((v) => !NEVER.some((t) => fold(v.description).includes(t)))
  .map((v) => {
    const d = fold(v.description);
    const score = (wanted ? wanted.filter((t) => d.includes(t)).length * 10 : 0) + d.split(",").length; // richer descriptions first
    return { ...v, score };
  })
  .filter((v) => !wanted || v.score >= 10)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

if (!scored.length) console.log("No voice matches. Try without --region, or another --vibe.");
for (const v of scored) console.log(`${v.name}\t${v.gender}/${v.region ?? "?"}\t${v.description}`);

if (args.sample) {
  const dir = "scripts/onboarding-videos/.cache/samples";
  mkdirSync(dir, { recursive: true });
  const line = typeof args.text === "string" ? args.text : "Xin chào, đây là video hướng dẫn sử dụng ứng dụng Best Nails. Bấm Create gift card để tạo một thẻ quà tặng mới.";
  for (const v of scored) {
    const { file } = await speak(line, v.name);
    const out = path.join(dir, `${fold(v.name).replace(/[^a-z0-9]+/g, "-")}.mp3`);
    copyFileSync(file, out);
    console.log(`sample: ${out}`);
  }
}
