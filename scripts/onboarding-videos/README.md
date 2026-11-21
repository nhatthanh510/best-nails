# Onboarding videos (Vietnamese voice)

Short screen recordings of the local app with a Vietnamese voice from [VieNeu](https://www.vieneu.io/)
and captions drawn in the page. Output goes to `docs/onboarding-videos/<folder>/<NN-name>.mp4` (+ `.vi.srt`),
which is git-ignored: share the videos outside git (Drive, YouTube, Zalo) and rebuild them from these scripts.
The Claude Code skill `.claude/skills/onboarding-video` asks about the voice and subtitles and runs all of this.

Needs: Docker + `npx supabase start`, `npm run dev`, `ffmpeg`, and `VNE_NEU_API_KEY` in `.env.local`.

```bash
node scripts/onboarding-videos/demo-data.mjs seed      # demo customers (0400 555 2xx) and gift cards
node scripts/onboarding-videos/gift-cards/01-gift-card-list-create-and-details.mjs
node scripts/onboarding-videos/demo-data.mjs clean     # removes all demo data again
```

- Each video is one file with `steps: [{ say, run }]`. A step shows its caption, plays its line and runs
  its clicks at the same time, and the next step starts when both are done, so the voice and screen always line up.
- Narration is cached in `.cache/tts/` (git-ignored) by text + voice: re-recording only pays for lines you changed.
- Voice: `Ngọc Lan` (`DEFAULT_VOICE` in `lib/tts.mjs`). Call `GET https://api.vieneu.io/api/v1/voices` to see the others.
- Signs in as the local seed admin (`ONBOARDING_ADMIN_EMAIL` / `ONBOARDING_ADMIN_PASSWORD` to override).
- In the narration, keep the app's own words ("Gift cards", "Create gift card") and say "thẻ quà tặng", never "voucher".
