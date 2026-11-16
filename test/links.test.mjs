import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLink, parseLink, isMediaHost, fileName, parseProgress } from '../lib/links.mjs';

test('accepts reel, post and tv links and drops tracking', () => {
  assert.equal(normalizeLink('https://www.instagram.com/reel/Chunk8-jurw/?igsh=abc123'), 'https://www.instagram.com/reel/Chunk8-jurw/');
  assert.equal(normalizeLink('instagram.com/reels/Chunk8-jurw'), 'https://www.instagram.com/reel/Chunk8-jurw/');
  assert.equal(normalizeLink('https://instagram.com/p/aye83DjauH/'), 'https://www.instagram.com/p/aye83DjauH/');
  assert.equal(normalizeLink('https://www.instagram.com/natgeo/reel/Chunk8-jurw/'), 'https://www.instagram.com/reel/Chunk8-jurw/');
  assert.equal(normalizeLink('https://www.instagram.com/tv/B1234567890/'), 'https://www.instagram.com/tv/B1234567890/');
  assert.equal(normalizeLink('https://www.instagram.com/share/reel/BAbcdEFgh1'), 'https://www.instagram.com/share/reel/BAbcdEFgh1/');
  assert.equal(normalizeLink('Look at this https://www.instagram.com/reel/Chunk8-jurw/ wow'), 'https://www.instagram.com/reel/Chunk8-jurw/');
});

test('rejects other sites, profiles and option-like text', () => {
  for (const bad of [
    '', null, 42, 'hello',
    'https://example.com/reel/Chunk8-jurw/',
    'https://instagram.com.evil.io/reel/Chunk8-jurw/',
    'https://evil.io/?x=instagram.com/reel/Chunk8-jurw/',
    'https://www.instagram.com/natgeo/',
    '--exec=calc',
    'file:///etc/passwd',
  ]) {
    const out = normalizeLink(bad);
    assert.ok(out === null || out.startsWith('https://www.instagram.com/'), String(bad));
  }
  assert.equal(normalizeLink('https://example.com/reel/Chunk8-jurw/'), null);
  assert.equal(normalizeLink('https://instagram.com.evil.io/reel/Chunk8-jurw/'), null);
  assert.equal(normalizeLink('https://www.instagram.com/natgeo/'), null);
  assert.equal(normalizeLink('--exec=calc'), null);
});

test('only Instagram media servers pass the preview check', () => {
  assert.ok(isMediaHost('scontent-lax3-1.cdninstagram.com'));
  assert.ok(isMediaHost('instagram.fabc1-1.fna.fbcdn.net'));
  assert.ok(!isMediaHost('cdninstagram.com.evil.io'));
  assert.ok(!isMediaHost('127.0.0.1'));
  assert.ok(!isMediaHost('localhost'));
});

test('file names are safe', () => {
  assert.equal(fileName(['nat.geo', 'Chunk8-jurw', ''], 'mp4'), 'nat.geo-Chunk8-jurw.mp4');
  assert.equal(fileName(['../../etc', 'a"b\r\nc'], 'mp4'), 'etc-a-b-c.mp4');
  assert.equal(fileName([], 'mp3'), 'video.mp3');
});

test('reads progress lines', () => {
  assert.equal(parseProgress('[download]  42.5% of 3.10MiB at 1.2MiB/s ETA 00:01'), 42.5);
  assert.equal(parseProgress('[Merger] Merging formats into "media.mp4"'), null);
});

test('accepts TikTok links', () => {
  assert.deepEqual(parseLink('https://www.tiktok.com/@scout2015/video/6718335390845095173?is_from_webapp=1&lang=en'), { site: 'tiktok', link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173' });
  assert.equal(normalizeLink('https://vm.tiktok.com/ZMabc123X/'), 'https://vm.tiktok.com/ZMabc123X/');
  assert.equal(normalizeLink('vt.tiktok.com/ZSabc123X'), 'https://vt.tiktok.com/ZSabc123X/');
  assert.equal(normalizeLink('https://www.tiktok.com/t/ZTabc123X/'), 'https://www.tiktok.com/t/ZTabc123X/');
  assert.equal(normalizeLink('https://m.tiktok.com/@a.b_c/video/7000000000000000000'), 'https://www.tiktok.com/@a.b_c/video/7000000000000000000');
  assert.equal(normalizeLink('https://www.tiktok.com/@scout2015'), null);
  assert.equal(normalizeLink('https://www.tiktok.com/@scout2015/photo/6718335390845095173'), null);
});

test('accepts Facebook links', () => {
  assert.deepEqual(parseLink('https://www.facebook.com/watch/?v=10153231379946729&ref=sharing'), { site: 'facebook', link: 'https://www.facebook.com/watch/?v=10153231379946729' });
  assert.equal(normalizeLink('https://m.facebook.com/watch?v=10153231379946729'), 'https://www.facebook.com/watch/?v=10153231379946729');
  assert.equal(normalizeLink('https://www.facebook.com/video.php?v=10153231379946729'), 'https://www.facebook.com/watch/?v=10153231379946729');
  assert.equal(normalizeLink('https://www.facebook.com/reel/1195289147628387?mibextid=x'), 'https://www.facebook.com/reel/1195289147628387/');
  assert.equal(normalizeLink('https://www.facebook.com/somepage/videos/10153231379946729/'), 'https://www.facebook.com/somepage/videos/10153231379946729/');
  assert.equal(normalizeLink('https://www.facebook.com/share/v/1AbCdEfGhI/'), 'https://www.facebook.com/share/v/1AbCdEfGhI/');
  assert.equal(normalizeLink('https://www.facebook.com/share/r/1AbCdEfGhI'), 'https://www.facebook.com/share/r/1AbCdEfGhI/');
  assert.equal(normalizeLink('https://fb.watch/abcDEF123_/'), 'https://fb.watch/abcDEF123_/');
  assert.equal(normalizeLink('https://www.facebook.com/somepage'), null);
  assert.equal(normalizeLink('https://www.facebook.com/watch/?v=abc;rm'), null);
  assert.equal(normalizeLink('https://www.facebook.com/groups/123456/'), null);
});

test('rejects look-alike hosts and unsafe paths', () => {
  assert.equal(normalizeLink('https://tiktok.com.evil.io/@a/video/6718335390845095173'), null);
  assert.equal(normalizeLink('https://facebook.com.evil.io/reel/1195289147628387'), null);
  assert.equal(normalizeLink('https://www.tiktok.com/@a/video/6718335390845095173/$(id)'), null);
  assert.ok(isMediaHost('p16-sign.tiktokcdn-us.com'));
  assert.ok(isMediaHost('scontent.fabc1-1.fna.fbcdn.net'));
  assert.ok(!isMediaHost('tiktokcdn.com.evil.io'));
});
