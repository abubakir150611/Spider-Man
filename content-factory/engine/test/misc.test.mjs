import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateMusic, impact, mulberry32, placeClip, pop, seedFrom, tick, whoosh } from '../lib/audio-synth.mjs';
import { checkLinks, collectUrls } from '../lib/links.mjs';
import { redact } from '../lib/logger.mjs';
import { withRetry } from '../lib/retry.mjs';
import { planTelegramUpload } from '../lib/telegram-media.mjs';
import { readWav, writeWav } from '../lib/wav.mjs';
import { research } from './fixtures.mjs';
import { deepMerge } from '../lib/config.mjs';

test('redact hides telegram tokens and env secrets', () => {
  process.env.TEST_API_KEY = 'super-secret-value-123';
  const line = redact('url https://api.telegram.org/bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/getMe key super-secret-value-123');
  assert.ok(!line.includes('AAHdq'));
  assert.ok(!line.includes('super-secret'));
  assert.match(line, /\[REDACTED\]/);
});

test('telegram upload planner picks direct / compress / split', () => {
  assert.equal(planTelegramUpload({ sizeMB: 20, durationSec: 40, limitMB: 49, width: 1080, height: 1920 }).strategy, 'direct');
  const c = planTelegramUpload({ sizeMB: 80, durationSec: 60, limitMB: 49, width: 1080, height: 1920 });
  assert.equal(c.strategy, 'compress');
  assert.equal(c.shortSide, 1080);
  const c720 = planTelegramUpload({ sizeMB: 300, durationSec: 300, limitMB: 49, width: 1920, height: 1080 });
  assert.equal(c720.strategy, 'compress');
  assert.equal(c720.shortSide, 720);
  const s = planTelegramUpload({ sizeMB: 900, durationSec: 900, limitMB: 49, width: 1920, height: 1080 });
  assert.equal(s.strategy, 'split');
  assert.ok(s.parts >= 2);
});

test('wav round trip and synthesised audio stay in range', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cf-'));
  const music = generateMusic({ durationSec: 3, seed: 1, mood: 'calm' });
  assert.equal(music.channels[0].length, 3 * 48000);
  const peak = music.channels[0].reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak > 0.3 && peak <= 1);
  const file = join(dir, 'm.wav');
  writeWav(file, music.channels, 48000);
  const back = readWav(file);
  assert.equal(back.sampleRate, 48000);
  assert.equal(back.channels.length, 2);
  assert.ok(Math.abs(back.channels[0][1000] - music.channels[0][1000]) < 1e-3);
  const target = [new Float32Array(48000), new Float32Array(48000)];
  for (const clip of [whoosh({}), pop({}), tick({}), impact({})]) placeClip(target, clip, 0.1, 48000);
  assert.ok(target[0].some((v) => v !== 0));
  assert.equal(seedFrom('a'), seedFrom('a'));
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('withRetry retries then succeeds, and can fail fast', async () => {
  let n = 0;
  const v = await withRetry(async () => {
    if (n++ < 2) throw new Error('flaky');
    return 'ok';
  }, { retries: 3, baseMs: 1 });
  assert.equal(v, 'ok');
  await assert.rejects(withRetry(async () => { throw new Error('fatal'); }, { retries: 3, baseMs: 1, shouldRetry: () => false }), /fatal/);
});

test('link checker handles ok, bot-protected and dead links', async () => {
  const fake = async (url, { method }) => {
    if (url.includes('dead')) throw Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND' } });
    if (url.includes('guard')) return { ok: false, status: 403, url };
    if (method === 'HEAD' && url.includes('nohead')) return { ok: false, status: 405, url };
    return { ok: true, status: 200, url };
  };
  const r = await checkLinks(['https://a.dev', 'https://guard.dev', 'https://dead.dev', 'https://nohead.dev', 'https://a.dev'], { fetchImpl: fake });
  assert.equal(r.length, 4);
  assert.deepEqual(r.map((x) => x.ok), [true, true, false, true]);
  assert.ok(collectUrls(research).includes('https://lucide.dev'));
});

test('config deep merge keeps base keys', () => {
  assert.deepEqual(deepMerge({ a: { b: 1, c: 2 }, l: [1] }, { a: { c: 3 }, l: [2] }), { a: { b: 1, c: 3 }, l: [2] });
});
