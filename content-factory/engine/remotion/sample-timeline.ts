import type { Timeline } from './types';

/** Preview data for `pnpm studio`. Real renders receive the project timeline as input props. */
export const sampleTimeline: Timeline = {
  version: 1,
  fps: 30,
  width: 1080,
  height: 1920,
  orientation: 'vertical',
  durationInFrames: 300,
  durationSec: 10,
  title: 'Preview',
  language: 'ru',
  platform: 'shorts',
  theme: 'graphite-lime',
  typing: { startSec: 0.45, charsPerSec: 26, lineGapSec: 0.25 },
  chapters: [],
  scenes: [
    { index: 0, id: 's1', type: 'hook', transition: 'none', narration: '', visual: { headline: 'Эти *5 инструментов* сэкономят тебе часы', kicker: '// топ-5' }, from: 0, durationInFrames: 90, startSec: 0, endSec: 3, words: [] },
    { index: 1, id: 's2', type: 'code', transition: 'zoom', narration: '', visual: { title: 'Установка', language: 'bash', lines: ['npm install -g @anthropic-ai/claude-code'], output: ['✓ added 1 package'] }, from: 90, durationInFrames: 120, startSec: 3, endSec: 7, words: [] },
    { index: 2, id: 's3', type: 'outro', transition: 'slide', narration: '', visual: { headline: 'Сохрани, чтобы *не потерять*', cta: 'Подписаться' }, from: 210, durationInFrames: 90, startSec: 7, endSec: 10, words: [] },
  ],
  captions: [{ start: 0.2, end: 2.5, text: 'Эти пять инструментов', words: [{ text: 'Эти', start: 0.2, end: 0.6 }, { text: 'пять', start: 0.6, end: 1.1 }, { text: 'инструментов', start: 1.1, end: 2.2 }] }],
};
