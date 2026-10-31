import test from 'node:test';
import assert from 'node:assert/strict';
import { alignBoundaries, buildCues, estimateWordTimings, toSrt, toVtt } from '../lib/subtitles.mjs';

test('estimated timings are monotonic and inside the clip', () => {
  const w = estimateWordTimings('Привет, мир. Это тест субтитров!', 3);
  assert.equal(w.length, 5);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].end);
  assert.ok(w.at(-1).end <= 3);
});

test('engine boundaries are mapped back onto punctuated tokens', () => {
  const words = alignBoundaries('Привет, мир!', [{ text: 'Привет', start: 0.1, end: 0.5 }, { text: 'мир', start: 0.6, end: 0.9 }], 1);
  assert.deepEqual(words.map((x) => x.text), ['Привет,', 'мир!']);
  assert.equal(words[1].start, 0.6);
  const fallback = alignBoundaries('Один два', null, 1);
  assert.equal(fallback.length, 2);
  const missing = alignBoundaries('Один 2026 три', [{ text: 'Один', start: 0, end: 0.3 }, { text: 'три', start: 0.8, end: 1 }], 1.2);
  assert.equal(missing.length, 3);
  assert.ok(missing[1].start >= 0.3);
});

test('cues respect word and char limits and sentence ends', () => {
  const words = estimateWordTimings('Раз два три четыре пять. Шесть семь', 4);
  const cues = buildCues(words, { maxWords: 3, maxChars: 40 });
  assert.equal(cues[0].text, 'Раз два три');
  assert.equal(cues[1].text, 'четыре пять.');
  assert.ok(toSrt(cues).startsWith('1\n00:00:00,'));
  assert.ok(toVtt(cues).startsWith('WEBVTT'));
});
