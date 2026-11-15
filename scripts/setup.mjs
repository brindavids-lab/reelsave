#!/usr/bin/env node
// Checks what ReelSave needs and prints install steps for anything missing.
//   node scripts/setup.mjs            check
//   node scripts/setup.mjs --update   update yt-dlp (do this when downloads start failing)
import { spawnSync } from 'node:child_process';
import { findEngine, hasFfmpeg } from '../lib/engine.mjs';

const os = process.platform;
const hint = (win, mac, linux) => (os === 'win32' ? win : os === 'darwin' ? mac : linux);
let missing = 0;

const nodeOk = Number(process.versions.node.split('.')[0]) >= 18;
console.log(`${nodeOk ? 'OK     ' : 'MISSING'} Node ${process.versions.node}${nodeOk ? '' : ' (need 18 or newer: https://nodejs.org)'}`);
if (!nodeOk) missing += 1;

if (process.argv.includes('--update')) {
  const tries = [['uv', ['tool', 'upgrade', 'yt-dlp']], ['uvx', ['--refresh', 'yt-dlp', '--version']], ['yt-dlp', ['-U']], ['python3', ['-m', 'pip', 'install', '-U', 'yt-dlp']]];
  for (const [cmd, args] of tries) {
    const r = spawnSync(cmd, args, { stdio: 'inherit' });
    if (r.status === 0) break;
  }
}

const engine = findEngine({ refresh: true });
if (engine) console.log(`OK      yt-dlp ${engine.version} (${engine.label})`);
else {
  missing += 1;
  console.log('MISSING yt-dlp. Install uv, then ReelSave fetches yt-dlp on first use:');
  console.log(`          ${hint('winget install astral-sh.uv', 'brew install uv', 'curl -LsSf https://astral.sh/uv/install.sh | sh')}`);
  console.log(`        Or install yt-dlp directly: ${hint('winget install yt-dlp.yt-dlp', 'brew install yt-dlp', 'pipx install yt-dlp')}`);
}

if (hasFfmpeg()) console.log('OK      ffmpeg');
else {
  missing += 1;
  console.log(`MISSING ffmpeg: ${hint('winget install Gyan.FFmpeg', 'brew install ffmpeg', 'sudo apt install ffmpeg')}`);
  console.log('        If ffmpeg lives outside PATH, set FFMPEG_DIR to its folder.');
}

console.log(missing ? `\n${missing} item(s) missing. Install them, open a new terminal, run this again.` : '\nReady. Start with: node server.mjs --open');
process.exit(missing ? 1 : 0);
