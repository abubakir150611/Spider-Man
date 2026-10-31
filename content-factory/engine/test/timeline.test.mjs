import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, typingDuration } from '../lib/timeline.mjs';

const brief = { width: 1080, height: 1920 };
const script = {
  title: 'T',
  language: 'ru',
  platform: 'shorts',
  theme: 'ember',
  scenes: [
    { type: 'hook', narration: 'Раз два', visual: { headline: 'X' }, transition: 'auto' },
    { type: 'code', narration: 'Три', visual: { lines: ['npm install something-long'], output: ['ok'] }, transition: 'auto', chapter: 'Установка' },
    { type: 'outro', narration: 'Пока', visual: { headline: 'Y', cta: 'Sub' }, transition: 'wipe' },
  ],
};
const voice = [
  { duration: 1.2, wav: 'a.wav', words: [{ text: 'Раз', start: 0, end: 0.5 }, { text: 'два', start: 0.6, end: 1.1 }] },
  { duration: 0.5, wav: 'b.wav', words: [{ text: 'Три', start: 0, end: 0.4 }] },
  { duration: 0.6, wav: 'c.wav', words: [{ text: 'Пока', start: 0, end: 0.5 }] },
];

test('scenes are contiguous and long enough for their content', () => {
  const t = buildTimeline({ script, brief, voice, fps: 30 });
  assert.equal(t.orientation, 'vertical');
  for (let i = 1; i < t.scenes.length; i++) assert.equal(t.scenes[i].from, t.scenes[i - 1].from + t.scenes[i - 1].durationInFrames);
  assert.ok(t.scenes[1].durationInFrames / 30 >= typingDuration(['npm install something-long']));
  assert.equal(t.durationInFrames, t.scenes.at(-1).from + t.scenes.at(-1).durationInFrames);
  assert.equal(t.scenes[0].transition, 'none');
  assert.equal(t.scenes[2].transition, 'wipe');
});

test('word timings are absolute and SFX/chapters are generated', () => {
  const t = buildTimeline({ script, brief, voice, fps: 30 });
  assert.ok(t.scenes[1].words[0].start >= t.scenes[1].startSec);
  assert.ok(t.captions.length >= 2);
  assert.equal(t.sfx[0].type, 'impact');
  assert.ok(t.sfx.some((s) => s.type === 'tick'));
  assert.deepEqual(t.chapters.map((c) => c.title), ['Установка']);
});
