#!/usr/bin/env node
// ReelSave local server. Zero npm dependencies. Listens on 127.0.0.1 only.
//   node server.mjs [--open]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findEngine, hasFfmpeg, runEngine, explainError } from './lib/engine.mjs';
import { normalizeLink, isMediaHost, fileName, parseProgress } from './lib/links.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reelsave-'));
const PORT = Number(process.env.PORT) || 4280;
const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE = 3;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

const jobs = new Map(); // id -> { state, percent, message, file, name, dir, created }

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, code, message) => send(res, code, { error: message });

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('Body too large'));
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Other websites must not drive this server from the person's browser.
function isLocalRequest(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  if (host !== '127.0.0.1' && host !== 'localhost') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return o.hostname === '127.0.0.1' || o.hostname === 'localhost';
  } catch {
    return false;
  }
}

function removeJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  fs.rm(job.dir, { recursive: true, force: true }, () => {});
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) if (now - job.created > JOB_TTL_MS) removeJob(id);
}, 60 * 1000).unref();

// ---- /api/info: look a link up and describe what is in the post ----
function describe(entry, index) {
  const hasVideo = Boolean(entry.formats?.some((f) => f.vcodec && f.vcodec !== 'none') || entry.url);
  const best = (entry.formats || []).reduce((a, f) => ((f.height || 0) > (a?.height || 0) ? f : a), null);
  const hasAudio = (entry.formats || []).some((f) => f.acodec !== 'none');
  return {
    index,
    id: entry.id || '',
    hasVideo,
    hasAudio,
    duration: entry.duration || null,
    width: best?.width || entry.width || null,
    height: best?.height || entry.height || null,
    thumbnail: entry.thumbnail ? `/api/thumb?u=${encodeURIComponent(entry.thumbnail)}` : null,
  };
}

async function handleInfo(req, res) {
  const body = await readJson(req);
  const link = normalizeLink(body.url);
  if (!link) return fail(res, 400, 'Paste an Instagram reel or post link, for example https://www.instagram.com/reel/ABC123/');
  const { code, stdout, stderr } = await runEngine(['-J', link], { timeoutMs: 90 * 1000 });
  if (code !== 0) return fail(res, 422, explainError(stderr));
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return fail(res, 502, 'The engine returned an unreadable answer. Run "node scripts/setup.mjs --update".');
  }
  const entries = data._type === 'playlist' ? data.entries || [] : [data];
  const items = entries.filter(Boolean).map((e, i) => describe(e, i + 1)).filter((i) => i.hasVideo);
  if (!items.length) return fail(res, 422, 'This post has no video. ReelSave downloads reels and video posts.');
  const first = entries.find(Boolean) || {};
  send(res, 200, {
    link,
    code: data.id || first.id || '',
    author: data.channel || first.channel || data.uploader_id || first.uploader_id || data.uploader || first.uploader || '',
    caption: String(data.description || first.description || data.title || '').slice(0, 300),
    items,
  });
}

// ---- /api/prepare: start fetching one item, report progress, then serve ----
async function handlePrepare(req, res) {
  const body = await readJson(req);
  const link = normalizeLink(body.url);
  if (!link) return fail(res, 400, 'This link is not an Instagram reel or post.');
  const format = body.format === 'mp3' ? 'mp3' : 'mp4';
  const item = Number.isInteger(body.item) && body.item >= 1 && body.item <= 50 ? body.item : 1;
  const active = [...jobs.values()].filter((j) => j.state === 'working').length;
  if (active >= MAX_ACTIVE) return fail(res, 429, 'Three downloads are running. Wait for one to finish.');

  const id = crypto.randomBytes(12).toString('hex');
  const dir = path.join(WORK_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const job = { state: 'working', percent: 0, message: 'Starting', file: null, name: null, dir, created: Date.now() };
  jobs.set(id, job);
  send(res, 200, { id });

  const args = ['--newline', '--playlist-items', String(item), '--no-part', '-P', dir, '-o', 'media.%(ext)s'];
  if (format === 'mp3') {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    // Prefer H.264 with AAC so the file plays on phones and in every editor.
    args.push('-S', 'vcodec:h264,res,acodec:m4a', '-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
  }
  args.push(link);

  let pass = 0;
  let lastPercent = 0;
  try {
    const { code, stderr } = await runEngine(args, {
      keepStdout: false,
      onLine: (line) => {
        const p = parseProgress(line);
        if (p !== null) {
          if (p < lastPercent - 20) pass += 1; // the second stream (audio) started
          lastPercent = p;
          job.percent = Math.min(95, Math.round(format === 'mp3' ? p * 0.9 : pass === 0 ? p * 0.75 : 75 + p * 0.15));
          job.message = 'Downloading';
        } else if (/^\[(Merger|ExtractAudio|VideoConvertor)\]/.test(line)) {
          job.percent = 96;
          job.message = format === 'mp3' ? 'Converting to MP3' : 'Joining video and sound';
        }
      },
    });
    const produced = fs.readdirSync(dir).find((f) => f === `media.${format}`) || fs.readdirSync(dir).find((f) => f.startsWith('media.'));
    if (code !== 0 || !produced) {
      job.state = 'error';
      job.message = explainError(stderr);
      return;
    }
    const ext = path.extname(produced).slice(1) || format;
    job.file = path.join(dir, produced);
    job.name = fileName([body.author, body.code, body.items > 1 ? String(item) : ''], ext);
    job.size = fs.statSync(job.file).size;
    job.percent = 100;
    job.message = 'Ready';
    job.state = 'done';
  } catch (err) {
    job.state = 'error';
    job.message = err.message === 'ENGINE_MISSING' ? 'yt-dlp is missing. Run "node scripts/setup.mjs".' : 'The download failed to start.';
  }
}

function handleJob(res, id) {
  const job = jobs.get(id);
  if (!job) return fail(res, 404, 'This download expired. Press Download again.');
  send(res, 200, { state: job.state, percent: job.percent, message: job.message, name: job.name, size: job.size || null });
}

function handleFile(res, id) {
  const job = jobs.get(id);
  if (!job || job.state !== 'done') return fail(res, 404, 'This download expired. Press Download again.');
  const type = MIME[path.extname(job.file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': job.size,
    'Content-Disposition': `attachment; filename="${job.name}"`,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(job.file).pipe(res);
}

// Preview images come from Instagram's media servers through this server,
// because Instagram blocks them when a page on another address asks.
async function handleThumb(res, target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return fail(res, 400, 'Bad address');
  }
  if (url.protocol !== 'https:' || !isMediaHost(url.hostname)) return fail(res, 400, 'Bad address');
  try {
    const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return fail(res, 502, 'No preview');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return fail(res, 502, 'No preview');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  } catch {
    fail(res, 502, 'No preview');
  }
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return fail(res, 404, 'Not found');
  fs.readFile(file, (err, data) => {
    if (err) return fail(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isLocalRequest(req)) return fail(res, 403, 'Forbidden');
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/health') {
      const engine = findEngine();
      return send(res, 200, { engine: engine ? engine.version : null, ffmpeg: hasFfmpeg() });
    }
    if (req.method === 'POST' && p === '/api/info') return await handleInfo(req, res);
    if (req.method === 'POST' && p === '/api/prepare') return await handlePrepare(req, res);
    if (req.method === 'GET' && p.startsWith('/api/job/')) return handleJob(res, p.slice(9));
    if (req.method === 'GET' && p.startsWith('/api/file/')) return handleFile(res, p.slice(10));
    if (req.method === 'GET' && p === '/api/thumb') return await handleThumb(res, url.searchParams.get('u') || '');
    if (req.method === 'GET' && !p.startsWith('/api/')) return serveStatic(res, p);
    fail(res, 404, 'Not found');
  } catch (err) {
    if (res.headersSent) return res.end();
    if (err.message === 'ENGINE_MISSING') return fail(res, 503, 'yt-dlp is missing. Run "node scripts/setup.mjs".');
    fail(res, 400, err.message === 'Invalid JSON' || err.message === 'Body too large' ? err.message : 'Something went wrong. Try again.');
  }
});

function cleanup() {
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function listen(port, attempts = 10) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts > 1) return listen(port + 1, attempts - 1);
    console.error(err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const address = `http://localhost:${port}`;
    console.log(`ReelSave is running at ${address}`);
    const engine = findEngine();
    console.log(engine ? `Engine: yt-dlp ${engine.version} (${engine.label})` : 'Engine: MISSING. Run "node scripts/setup.mjs".');
    if (process.argv.includes('--open')) {
      const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', '', address] : [address];
      spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    }
  });
}
listen(PORT);
