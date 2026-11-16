# ReelSave: instructions for Claude

ReelSave is a zero dependency Node app. `server.mjs` serves `public/` and runs yt-dlp through `lib/engine.mjs`.
Run `node --test` before each commit. Keep the server free of npm packages.

## Video work

Build promo videos, reels and motion graphics with Remotion. The working project is in `promo/`.
Copy the folder as the starting point for a new video.

- Install: `cd promo && npm install`
- Render: `npx remotion render src/index.ts Promo out/reelsave-promo.mp4`
- In a cloud session add `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
- Finish with `ffmpeg -af loudnorm=I=-14:TP=-1.5` for Instagram loudness.

The owner has no paid Higgsfield plan. Do not spend Higgsfield credits or plan a video around paid AI video
generation. Use Remotion animation, real screen recordings made with Playwright, and assets already in the repo.
Ask before using any service with a cost.
