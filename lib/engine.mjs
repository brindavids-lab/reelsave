// Finds and runs yt-dlp, the open source extractor that does the Instagram, TikTok and Facebook work.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const isWin = process.platform === 'win32';

const CANDIDATES = [
  process.env.YTDLP_PATH ? [process.env.YTDLP_PATH] : null,
  ['yt-dlp'],
  ['uvx', 'yt-dlp'],
  ['python3', '-m', 'yt_dlp'],
  ['python', '-m', 'yt_dlp'],
  isWin ? ['py', '-m', 'yt_dlp'] : null,
].filter(Boolean);

let cached;

// Returns { cmd, args, version } for the first working candidate, or null.
export function findEngine({ refresh = false } = {}) {
  if (cached !== undefined && !refresh) return cached;
  cached = null;
  for (const [cmd, ...args] of CANDIDATES) {
    const r = spawnSync(cmd, [...args, '--version'], { encoding: 'utf8', timeout: 120000, shell: false });
    if (r.status === 0 && /^\d{4}\./.test((r.stdout || '').trim())) {
      cached = { cmd, args, version: r.stdout.trim(), label: [cmd, ...args].join(' ') };
      break;
    }
  }
  return cached;
}

export function ffmpegDir() {
  return process.env.FFMPEG_DIR || null;
}

// Path of ffmpeg or ffprobe, honouring FFMPEG_DIR.
export function ffTool(name) {
  return ffmpegDir() ? path.join(ffmpegDir(), isWin ? `${name}.exe` : name) : name;
}

// Runs ffmpeg or ffprobe and resolves with { code, stdout }.
export function runFf(name, args, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    const child = spawn(ffTool(name), args, { shell: false, windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); resolve({ code: 1, stdout }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout }); });
  });
}

export function hasFfmpeg() {
  const bin = ffmpegDir() ? path.join(ffmpegDir(), isWin ? 'ffmpeg.exe' : 'ffmpeg') : 'ffmpeg';
  return spawnSync(bin, ['-version'], { timeout: 20000 }).status === 0;
}

// Runs yt-dlp with the given arguments. Calls onLine for every stdout line.
// Resolves with { code, stdout, stderr }. Never uses a shell.
export function runEngine(extraArgs, { onLine, timeoutMs = 10 * 60 * 1000, keepStdout = true } = {}) {
  const engine = findEngine();
  if (!engine) return Promise.reject(new Error('ENGINE_MISSING'));
  const args = [...engine.args, '--no-warnings', '--no-colors', '--ignore-config'];
  if (ffmpegDir()) args.push('--ffmpeg-location', ffmpegDir());
  args.push(...extraArgs);
  return new Promise((resolve, reject) => {
    const child = spawn(engine.cmd, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let pending = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (keepStdout) stdout += chunk;
      if (!onLine) return;
      pending += chunk;
      const lines = pending.split(/\r?\n|\r/);
      pending = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (onLine && pending) onLine(pending);
      resolve({ code, stdout, stderr });
    });
  });
}

// Turns yt-dlp's stderr into one sentence a person understands.
export function explainError(stderr, site = 'The site') {
  const s = String(stderr || '');
  if (/login required|rate-limit reached|requested content is not available|cookies|log in|private|status code 10204|blocked/i.test(s)) {
    return `${site} refused to show this post without a login. The post is private or age restricted, or ${site} is limiting your network right now. Try again in a few minutes.`;
  }
  if (/No video formats found|There is no video in this post|no video/i.test(s)) {
    return 'This post has no video. ReelSave downloads reels and video posts.';
  }
  if (/unable to obtain file audio codec|audio conversion failed/i.test(s)) return 'This video has no sound, so there is no audio to save.';
  if (/Cannot parse data|Unable to extract|No video formats found/i.test(s)) return `${site} did not return this video. The post is private, removed, or needs a login.`;
  if (/Unsupported URL|not a valid URL/i.test(s)) return 'This link does not point to a video ReelSave supports.';
  if (/HTTP Error 404|does not exist|Not Found/i.test(s)) return `${site} says this post does not exist. Check the link.`;
  if (/ffmpeg/i.test(s) && /not found|not installed/i.test(s)) {
    return 'ffmpeg is missing. Run "node scripts/setup.mjs" for install steps.';
  }
  if (/getaddrinfo|Temporary failure|timed out|Connection (reset|refused)|Unable to connect|Tunnel connection failed|urlopen error/i.test(s)) {
    return `The connection to ${site} failed. Check your internet, VPN or firewall and try again.`;
  }
  const last = s.trim().split('\n').filter((l) => /ERROR/.test(l)).pop();
  return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?([\w-]+:\s*)?/, '') : 'The download failed. Update the engine with "node scripts/setup.mjs --update" and try again.';
}
