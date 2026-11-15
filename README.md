# ReelSave

Paste an Instagram link. Download the reel or video. Free, open source, no account, no ads, no limits.

ReelSave runs on your own computer. Your links go to Instagram and nowhere else. There is no server to pay for,
so there is nothing to charge you for.

## What you get

- Paste a reel, post or TV link and press **Find video**
- **Download MP4** saves the best quality in H.264, which plays on phones and in every editor
- **Audio MP3** saves the sound only
- Carousel posts list every video with its own buttons
- Works with links like `instagram.com/reel/...`, `/reels/...`, `/p/...`, `/tv/...` and `/share/...`

Photo posts, stories and private accounts are out of scope. ReelSave never asks for your Instagram login.

## Install

You need three free tools: [Node.js](https://nodejs.org) 18 or newer, ffmpeg, and uv (uv fetches
[yt-dlp](https://github.com/yt-dlp/yt-dlp) for you).

| System  | Command                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| Windows | `winget install OpenJS.NodeJS Gyan.FFmpeg astral-sh.uv`                        |
| macOS   | `brew install node ffmpeg uv`                                                  |
| Linux   | `sudo apt install nodejs ffmpeg` and `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

Then:

```
git clone <this repository>
cd reelsave
node scripts/setup.mjs
node server.mjs --open
```

Your browser opens `http://localhost:4280`. There are no npm packages to install.

## Use it on your phone

Your computer does the work and your phone opens the page over Wi-Fi.

1. On the computer, run `node server.mjs --phone`
2. The terminal prints a line like `On your phone, same Wi-Fi, open: http://192.168.1.23:4280`
3. Type the address into the browser on your phone. Both devices need the same Wi-Fi network.
4. In Instagram, tap Share, then Copy link. Paste the link into ReelSave and tap Download MP4.

On iPhone, the file lands in the Files app under Downloads. Open the file, tap Share, then Save Video to move
the file into Photos. On Android, the file lands in Downloads and shows in your gallery.

Add the page to your home screen for one tap access (Share, then Add to Home Screen).

Phone mode lets every device on your Wi-Fi use the page, so use it at home and skip it on public Wi-Fi.
If the phone shows no page, allow Node.js through the computer's firewall when the system asks.

## Use it on your phone with no computer (hosted)

Put ReelSave on a free web host once. After this, you open one web address on any phone or computer.

1. Create a free account at [render.com](https://render.com) and connect your GitHub.
2. Press New, then Blueprint, and pick your ReelSave repository. Render reads `render.yaml` and the `Dockerfile`.
3. Wait for the build. Render gives you an address like `https://reelsave.onrender.com`.
4. Open the address on your phone and add the page to your home screen.

Any host running Docker works the same way: build the `Dockerfile` and expose port 10000.

Set `ACCESS_CODE` in the host's settings if you want the page to ask for a code before downloads. Leave it empty
for an open page. An open page lets anyone with the address use your free server allowance.

Things to know about hosting:

- Free hosts sleep when idle. The first visit after a pause takes about a minute.
- Instagram blocks shared server addresses more often than home connections. If lookups fail with a login
  message, wait and retry, or use phone mode from your own computer.
- Redeploy from the Render dashboard to pick up the newest yt-dlp when downloads stop working.
- You are the operator of your hosted copy. Keep it for personal use.

## When downloads stop working

Instagram changes its site often. yt-dlp ships fixes within days. Run:

```
node scripts/setup.mjs --update
```

If Instagram says a login is required, wait a few minutes. Instagram limits how many posts one network
looks up without an account.

## How ReelSave works

```
browser page  ->  local server (127.0.0.1)  ->  yt-dlp  ->  Instagram
                        |                         |
                        +------  ffmpeg joins video and sound  ------> your Downloads folder
```

- `server.mjs`: the local server. Zero dependencies. Listens on 127.0.0.1 only (plus your Wi-Fi network in phone mode) and rejects requests from other sites.
- `lib/links.mjs`: accepts Instagram post links only and rewrites them to a canonical form.
- `lib/engine.mjs`: finds and runs yt-dlp without a shell.
- `public/`: the page. No trackers, no analytics, no external scripts.

## Why this exists

Hosted downloaders run the same open source extractor on a server, then add ads, rate limits and a paywall to
cover the server bill. Running the extractor on your own computer removes the bill, so the limits go with it.

## Use it fairly

Download videos you own or have permission to save. Creators hold the copyright in their posts. Instagram's terms
restrict automated access, so keep use personal and light. ReelSave is not affiliated with Instagram or Meta.

## Credit

Designed and created by Brinsley Davids.

## Licence

MIT. yt-dlp is released under the Unlicense. ffmpeg is LGPL/GPL.
