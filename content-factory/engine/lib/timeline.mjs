import { buildCues, round } from './subtitles.mjs';

export const TYPING = { startSec: 0.45, charsPerSec: 26, lineGapSec: 0.25 };

const MIN_SCENE_SEC = { hook: 1.6, title: 2.2, item: 3.5, code: 3, stat: 2.5, bullets: 3, fact: 2.5, outro: 3.2 };
const TAIL_SEC = { hook: 0.25, outro: 1.6 };

export function typingDuration(lines) {
  const chars = lines.reduce((s, l) => s + l.length, 0);
  return TYPING.startSec + chars / TYPING.charsPerSec + lines.length * TYPING.lineGapSec;
}

function minDuration(scene) {
  let min = MIN_SCENE_SEC[scene.type] ?? 2;
  if (scene.type === 'code') min = Math.max(min, typingDuration(scene.visual.lines) + 1 + scene.visual.output.length * 0.35);
  if (scene.type === 'bullets') min = Math.max(min, 1 + scene.visual.items.length * 0.7);
  return min;
}

/**
 * Builds the master timeline: scene timing from real voice durations,
 * absolute word timings, caption cues, SFX cues and chapter markers.
 */
export function buildTimeline({ script, brief, voice, assets = {}, fps = 30 }) {
  const vertical = brief.height > brief.width;
  let cursor = 0;
  const scenes = script.scenes.map((scene, i) => {
    const v = voice[i];
    const lead = i === 0 ? 0.08 : 0.28;
    const tail = TAIL_SEC[scene.type] ?? 0.32;
    const duration = Math.max(minDuration(scene), lead + v.duration + tail);
    const from = Math.round(cursor * fps);
    const durationInFrames = Math.round((cursor + duration) * fps) - from;
    const startSec = from / fps;
    const voiceStartSec = round(startSec + lead);
    const words = v.words.map((w) => ({ text: w.text, start: round(voiceStartSec + w.start), end: round(voiceStartSec + w.end) }));
    cursor += duration;
    const transition = scene.transition === 'auto' ? ['slide', 'zoom', 'wipe', 'blur'][i % 4] : scene.transition;
    return {
      index: i,
      id: scene.id || `scene-${i + 1}`,
      type: scene.type,
      chapter: scene.chapter,
      transition: i === 0 ? 'none' : transition,
      narration: scene.narration,
      visual: { ...scene.visual, ...(assets[i] || {}) },
      from,
      durationInFrames,
      startSec: round(startSec),
      endSec: round((from + durationInFrames) / fps),
      voiceStartSec,
      voiceFile: v.wav,
      voiceDuration: v.duration,
      words,
    };
  });

  const durationInFrames = scenes.at(-1).from + scenes.at(-1).durationInFrames;
  const allWords = scenes.flatMap((s) => s.words);
  const cues = buildCues(allWords, vertical ? { maxChars: 22, maxWords: 3 } : { maxChars: 40, maxWords: 7 });

  const sfx = [];
  scenes.forEach((s, i) => {
    if (i === 0) sfx.push({ type: 'impact', at: 0 });
    else sfx.push({ type: 'whoosh', at: Math.max(0, s.startSec - 0.22), direction: i % 2 ? 1 : -1 });
    if (s.type === 'item') sfx.push({ type: 'pop', at: s.startSec + 0.35 });
    if (s.type === 'bullets') s.visual.items.forEach((_, k) => sfx.push({ type: 'pop', at: s.startSec + 0.6 + k * 0.45, freq: 700 + k * 60 }));
    if (s.type === 'code') {
      let t = s.startSec + TYPING.startSec;
      for (const line of s.visual.lines) {
        for (let c = 0; c < line.length; c += 2) sfx.push({ type: 'tick', at: round(t + c / TYPING.charsPerSec) });
        t += line.length / TYPING.charsPerSec + TYPING.lineGapSec;
      }
    }
  });

  const chapters = scenes.filter((s) => s.chapter).map((s) => ({ title: s.chapter, startSec: s.startSec }));

  return {
    version: 1,
    fps,
    width: brief.width,
    height: brief.height,
    orientation: vertical ? 'vertical' : 'horizontal',
    durationInFrames,
    durationSec: round(durationInFrames / fps),
    title: script.title,
    language: script.language,
    platform: script.platform,
    theme: script.theme,
    typing: TYPING,
    scenes,
    captions: cues.map((c) => ({ start: c.start, end: c.end, text: c.text, words: c.words })),
    sfx,
    chapters,
  };
}
