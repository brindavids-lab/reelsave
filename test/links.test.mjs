import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLink, isMediaHost, fileName, parseProgress } from '../lib/links.mjs';

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
  assert.equal(fileName([], 'mp3'), 'instagram-video.mp3');
});

test('reads progress lines', () => {
  assert.equal(parseProgress('[download]  42.5% of 3.10MiB at 1.2MiB/s ETA 00:01'), 42.5);
  assert.equal(parseProgress('[Merger] Merging formats into "media.mp4"'), null);
});
