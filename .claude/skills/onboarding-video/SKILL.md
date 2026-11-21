---
name: onboarding-video
description: Make a short onboarding / how-to video of the Best Nails app with a Vietnamese voice (VieNeu TTS), a visible cursor, highlights and optional subtitles, recorded from the local app with Playwright. Asks first about the voice (gender, accent, vibe, pace), subtitles and the audience, then writes, records and checks the video. Use when the user asks for an onboarding video, tutorial video, training video, "video hướng dẫn", or another video in a series such as "make the gift cards 02 video".
---

# Onboarding video with a Vietnamese voice (best-nails)

The pipeline lives in `scripts/onboarding-videos/` (read its `README.md`):
`lib/tts.mjs` (VieNeu voice, cached), `lib/recorder.mjs` (`record()`: Playwright walk-through, cursor,
highlights, captions, ffmpeg), `voices.mjs` (find voices), `demo-data.mjs` (demo data), and one script
per video, e.g. `gift-cards/01-gift-card-list-create-and-details.mjs`, which is the template to copy.

`$ARGUMENTS` may name the topic ("activate and use a gift card"), a folder or a video number. Use it and
don't ask again for what it already says.

## 1. Ask about the video (always, before writing anything)

Ask with **AskUserQuestion**, in Vietnamese if the user wrote in Vietnamese. Skip a question only when
the user already answered it in this conversation or in `$ARGUMENTS`. If an earlier video in the same
folder exists, read its `voice` / `speed` / `captions` and make "Same as video NN" the first, recommended option.

First call (4 questions):
1. **Giọng nam hay nữ?** Female (Nữ) / Male (Nam).
2. **Giọng miền nào?** South (Miền Nam) / North (Miền Bắc) / Central (Miền Trung, few voices).
3. **Vibe?** `clear` Rõ ràng, chuyên nghiệp (recommended for training) / `young` Trẻ trung, thân thiện /
   `gentle` Dịu dàng, từ tốn / `mature` Già dặn, trầm ấm. ("Other" → map to the nearest, or `warm` for truyền cảm.)
4. **Phụ đề (subtitles)?** `both` On screen + .srt file (recommended: Zalo/Facebook don't show .srt) /
   `screen` On screen only / `srt` .srt file only / `none` No subtitles.

Second call (only what's still unknown):
5. **Topic and steps**: what the video shows, if `$ARGUMENTS` doesn't say. One topic per video.
6. **Audience**: Owner / admin on the PC (admin pages) or Staff at the front desk (kiosk, Find gift card).
   It sets the screens, the viewport and how the voice addresses people ("bạn" by default; "anh chị" if they ask).
7. **Pace**: Normal (1.0) / A bit faster (1.1) / Slower, for older staff (0.9).
8. **Length**: Short, about 1 minute / Standard, about 1.5–2 minutes.

## 2. Pick the voice

```bash
node scripts/onboarding-videos/voices.mjs --gender=female --region=south --vibe=clear --limit=3 --sample
```

It drops comic or distorted voices and writes a sample of each to `scripts/onboarding-videos/.cache/samples/`.
Send the samples with **SendUserFile**, then ask which one (AskUserQuestion: the three names with their
descriptions, plus `Ngọc Lan` (used in gift cards 01) if it isn't already one of them). No match: drop
`--region` and say so. The voice name is the exact `name` from the list.

## 3. Check the app is running

- `VNE_NEU_API_KEY` in `.env.local` (check it's set; never print it).
- Docker running (`open -a Docker`), `npx supabase start`, the dev server via `preview_start` `{name: "best-nails"}` (never Bash).
- `node scripts/onboarding-videos/demo-data.mjs seed` so lists aren't empty (customers 0400 555 2xx, gift cards with a demo note).
  Never `db reset` and never run the e2e suite for this (they wipe or change the user's local data).
  Add what a new video needs to `demo-data.mjs`, tagged the same way so `clean` removes it.

## 4. Write the narration and get it approved

Walk the flow in the browser pane at the video's size first (admin 1280×800, kiosk 1180×820; sign in as
the local seed admin `admin@gmail.com` / `12345678`) and note the exact button and field labels.
`e2e/*.spec.ts` already has working selectors for most flows.

Then show the user the lines as a numbered list (what's said · what happens on screen) and wait for an OK
before recording, since a changed line costs VieNeu credit. Rules for the lines:
- Vietnamese, short sentences, one idea per line, about 8–14 lines for 1–2 minutes. Start with one line on
  what the video covers; end with "Vậy là xong." plus what the next video in the folder covers, if there is one.
- Use the app's own English words for what's on screen ("Gift cards", "Create gift card", "Top up") so staff
  can find them. Say amounts in words ("một trăm đô"), not "$100", and don't read codes aloud.
- Follow CLAUDE.md wording: **"thẻ quà tặng" / gift card, never "voucher"** (also in folder and file names);
  Create / Activate / Top up / Use / Correct balance; never tell customers to pay cash; kiosk copy stays
  neutral about timing ("Thanks for visiting", not "see you next time").
- The app records gift cards and visits; payment happens at the till. Say so where it matters.

## 5. Write the video script

Copy the template to `scripts/onboarding-videos/<folder>/<NN>-<kebab-name>.mjs`:
- **Folder** = the feature in kebab case, matching the admin's words: `gift-cards`, `kiosk`, `customers`,
  `check-ins`, `rewards`, `settings`. **File** = two-digit order in the folder + what it shows, e.g.
  `02-print-blank-gift-cards-and-details`, `03-activate-and-use-a-gift-card`. Look at the folder for the next number.
- Set `voice`, `speed`, `captions` from the answers, `viewport: KIOSK_VIEWPORT` for kiosk videos, `start`,
  `warmUp` (every route it visits, so nothing compiles on camera) and `prepare()` so the script can be re-run
  (take back what an earlier take created).
- Each step: `{ say, run: async (h, seconds) => {...} }`. Helpers: `h.click`, `h.type`, `h.moveTo`,
  `h.highlight` / `h.unhighlight`, `h.scrollBy`, `h.sleep`, `h.page`. A click that the line talks about goes
  after a `h.sleep` so the voice says it first. To highlight a card, find the innermost element holding two of
  its own labels (the `box()` helper in the template), and pick labels that appear nowhere else on the page.

## 6. Record and check

```bash
node scripts/onboarding-videos/<folder>/<NN>-<name>.mjs
```

Takes 2–3 minutes; run it with a long timeout. CLI overrides for a quick try: `--voice="…" --speed=1.1 --captions=none`.
Then pull 5–6 frames with ffmpeg (`-ss <t> -frames:v 1`, using the step times it prints) and look at them:
the highlight is on the right thing and fully on screen, nothing is cut off, captions don't hide what's
being clicked, no dev overlay. Fix the script and re-run; narration that didn't change is cached and free.

## 7. Deliver

Send the `.mp4` with **SendUserFile** (`display: render`). Say: its length, the voice / pace / subtitles used,
where it is (`docs/onboarding-videos/<folder>/`, git-ignored on purpose: videos are shared outside git and
rebuilt from the script, which does get committed), and that demo data stays in the local database until
`node scripts/onboarding-videos/demo-data.mjs clean`. You can't hear the audio: say the voice is the user's to judge.
