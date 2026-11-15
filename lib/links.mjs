// Link checking and file naming. Pure functions, covered by test/links.test.mjs.

const HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am', 'www.instagr.am']);
const POST_RE = /^\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})(?:\/|$)/;
const SHARE_RE = /^\/share\/(?:(p|reel|reels|tv)\/)?([A-Za-z0-9_-]{5,40})(?:\/|$)/;

// Accepts what a person pastes and returns a canonical Instagram post link,
// or null when the text is something else. Tracking parameters are dropped.
export function normalizeLink(input) {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  if (!text || text.length > 500) return null;
  const found = text.match(/(?:https?:\/\/)?(?:[a-z]+\.)?(?:instagram\.com|instagr\.am)\/[^\s"'<>]+/i);
  if (!found) return null;
  text = found[0];
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const share = url.pathname.match(SHARE_RE);
  if (share) {
    const kind = share[1] ? `${share[1]}/` : '';
    return `https://www.instagram.com/share/${kind}${share[2]}/`;
  }
  const post = url.pathname.match(POST_RE);
  if (!post) return null;
  const kind = post[1] === 'reels' ? 'reel' : post[1];
  return `https://www.instagram.com/${kind}/${post[2]}/`;
}

// Only Instagram's own media servers are fetched for preview images.
export function isMediaHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h.endsWith('.cdninstagram.com') || h.endsWith('.fbcdn.net');
}

// Builds a safe download file name such as "natgeo-Chunk8jurw.mp4".
export function fileName(parts, ext) {
  const clean = parts
    .filter(Boolean)
    .map((p) => String(p).normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, ''))
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
  return `${clean || 'instagram-video'}.${ext}`;
}

// Reads a percentage out of a yt-dlp progress line.
export function parseProgress(line) {
  const m = /^\[download\]\s+([\d.]+)%/.exec(line);
  return m ? Math.min(100, Number(m[1])) : null;
}
