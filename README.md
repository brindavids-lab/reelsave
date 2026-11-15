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

- `server.mjs`: the local server. Zero dependencies. Listens on 127.0.0.1 only and rejects requests from other sites.
- `lib/links.mjs`: accepts Instagram post links only and rewrites them to a canonical form.
- `lib/engine.mjs`: finds and runs yt-dlp without a shell.
- `public/`: the page. No trackers, no analytics, no external scripts.

## Why this exists

Hosted downloaders run the same open source extractor on a server, then add ads, rate limits and a paywall to
cover the server bill. Running the extractor on your own computer removes the bill, so the limits go with it.

## Use it fairly

Download videos you own or have permission to save. Creators hold the copyright in their posts. Instagram's terms
restrict automated access, so keep use personal and light. ReelSave is not affiliated with Instagram or Meta.

## Licence

MIT. yt-dlp is released under the Unlicense. ffmpeg is LGPL/GPL.
