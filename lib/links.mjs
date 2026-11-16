// Link checking and file naming. Pure functions, covered by test/links.test.mjs.

const SAFE_PATH = /^[A-Za-z0-9._@\/-]*$/;
const ID = '[A-Za-z0-9_-]{5,40}';

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am', 'www.instagr.am']);
const IG_POST = new RegExp(`^/(?:[A-Za-z0-9._]{1,30}/)?(p|reel|reels|tv)/(${ID})(?:/|$)`);
const IG_SHARE = new RegExp(`^/share/(?:(p|reel|reels|tv)/)?(${ID})(?:/|$)`);

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const TIKTOK_SHORT_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);
const TT_VIDEO = /^\/@([A-Za-z0-9._]{1,40})\/video\/(\d{8,25})(?:\/|$)/;
const TT_SHORT = new RegExp(`^/(?:t/)?(${ID})(?:/|$)`);

const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'mbasic.facebook.com']);
const FB_PATHS = [
  /^\/reel\/(\d{5,25})(?:\/|$)/,
  /^\/[A-Za-z0-9.]{1,80}\/videos\/(?:[A-Za-z0-9._-]{1,120}\/)?(\d{5,25})(?:\/|$)/,
  new RegExp(`^/share/(?:v|r)/(${ID})(?:/|$)`),
];
const FB_WATCH = /^\/(?:watch\/?|video\.php)$/;

function instagram(url) {
  const share = url.pathname.match(IG_SHARE);
  if (share) return `https://www.instagram.com/share/${share[1] ? `${share[1]}/` : ''}${share[2]}/`;
  const post = url.pathname.match(IG_POST);
  if (!post) return null;
  return `https://www.instagram.com/${post[1] === 'reels' ? 'reel' : post[1]}/${post[2]}/`;
}

function tiktok(url, host) {
  if (TIKTOK_SHORT_HOSTS.has(host)) {
    const m = url.pathname.match(TT_SHORT);
    return m ? `https://${host}/${m[1]}/` : null;
  }
  const video = url.pathname.match(TT_VIDEO);
  if (video) return `https://www.tiktok.com/@${video[1]}/video/${video[2]}`;
  const short = url.pathname.match(new RegExp(`^/t/(${ID})(?:/|$)`));
  return short ? `https://www.tiktok.com/t/${short[1]}/` : null;
}

function facebook(url, host) {
  if (host === 'fb.watch') {
    const m = url.pathname.match(new RegExp(`^/(${ID})(?:/|$)`));
    return m ? `https://fb.watch/${m[1]}/` : null;
  }
  if (FB_WATCH.test(url.pathname)) {
    const v = url.searchParams.get('v') || '';
    return /^\d{5,25}$/.test(v) ? `https://www.facebook.com/watch/?v=${v}` : null;
  }
  for (const re of FB_PATHS) {
    const m = url.pathname.match(re);
    if (m) return `https://www.facebook.com${m[0].replace(/\/$/, '')}/`;
  }
  return null;
}

// Accepts what a person pastes and returns { site, link } with a canonical
// link, or null when the text is something else. Tracking parameters are dropped.
export function parseLink(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 600) return null;
  const found = trimmed.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.watch)\/[^\s"'<>]+/i);
  if (!found) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(found[0]) ? found[0] : `https://${found[0]}`);
  } catch {
    return null;
  }
  if (!SAFE_PATH.test(url.pathname)) return null;
  const host = url.hostname.toLowerCase();
  let site = null;
  let link = null;
  if (INSTAGRAM_HOSTS.has(host)) [site, link] = ['instagram', instagram(url)];
  else if (TIKTOK_HOSTS.has(host) || TIKTOK_SHORT_HOSTS.has(host)) [site, link] = ['tiktok', tiktok(url, host)];
  else if (FACEBOOK_HOSTS.has(host) || host === 'fb.watch') [site, link] = ['facebook', facebook(url, host)];
  return link ? { site, link } : null;
}

export function normalizeLink(input) {
  return parseLink(input)?.link ?? null;
}

export const SITE_NAMES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

// Preview images are fetched only from the media servers of the three sites.
const MEDIA_SUFFIXES = ['.cdninstagram.com', '.fbcdn.net', '.tiktokcdn.com', '.tiktokcdn-us.com', '.tiktokcdn-eu.com', '.ttwstatic.com'];
export function isMediaHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return MEDIA_SUFFIXES.some((s) => h.endsWith(s));
}

// Builds a safe download file name such as "natgeo-Chunk8jurw.mp4".
export function fileName(parts, ext) {
  const clean = parts
    .filter(Boolean)
    .map((p) => String(p).normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, ''))
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
  return `${clean || 'video'}.${ext}`;
}

// Reads a percentage out of a yt-dlp progress line.
export function parseProgress(line) {
  const m = /^\[download\]\s+([\d.]+)%/.exec(line);
  return m ? Math.min(100, Number(m[1])) : null;
}
