import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateMusic, impact, mulberry32, placeClip, pop, seedFrom, tick, whoosh } from './audio-synth.mjs';
import { run } from './exec.mjs';
import { SHARED_ASSETS_DIR } from './paths.mjs';
import { readWav, writeWav } from './wav.mjs';

const SR = 48000;

/** Places every scene's voice clip at its timeline position into one mono track. */
export function buildVoiceTrack(timeline, outFile) {
  const total = Math.ceil(timeline.durationSec * SR);
  const track = new Float32Array(total);
  for (const scene of timeline.scenes) {
    const { channels, sampleRate } = readWav(scene.voiceFile);
    if (sampleRate !== SR) throw new Error(`${scene.voiceFile}: ожидалось ${SR} Гц`);
    const start = Math.round(scene.voiceStartSec * SR);
    const src = channels[0];
    for (let i = 0; i < src.length && start + i < total; i++) track[start + i] += src[i];
  }
  writeWav(outFile, [track], SR);
  return outFile;
}

/** Renders all SFX cues into one stereo track. */
export function buildSfxTrack(timeline, outFile, seed = 1) {
  const total = Math.ceil(timeline.durationSec * SR);
  const out = [new Float32Array(total), new Float32Array(total)];
  const rand = mulberry32(seed);
  const cache = { impact: impact({ sampleRate: SR }), tick: tick({ sampleRate: SR }) };
  for (const cue of timeline.sfx) {
    if (cue.type === 'whoosh') placeClip(out, whoosh({ sampleRate: SR, seed: Math.floor(rand() * 1e6), direction: cue.direction }), cue.at, SR, 0.55);
    else if (cue.type === 'pop') placeClip(out, pop({ sampleRate: SR, freq: cue.freq || 880 }), cue.at, SR, 0.5);
    else if (cue.type === 'tick') placeClip(out, cache.tick, cue.at, SR, 0.35 + rand() * 0.2);
    else if (cue.type === 'impact') placeClip(out, cache.impact, cue.at, SR, 0.7);
  }
  writeWav(outFile, out, SR);
  return outFile;
}

/**
 * Background music: a user-supplied track from assets/music (if any) or a
 * procedurally generated one. Returns a description of what was used.
 */
export async function buildMusicTrack({ timeline, outFile, mood = 'focus', file, seedKey, logger }) {
  const userDir = join(SHARED_ASSETS_DIR, 'music');
  let source = file && existsSync(file) ? file : null;
  if (!source && existsSync(userDir)) {
    const tracks = readdirSync(userDir).filter((f) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f)).sort();
    if (tracks.length) source = join(userDir, tracks[seedFrom(seedKey) % tracks.length]);
  }
  if (source) {
    logger?.info(`Музыка: пользовательский трек ${source}`);
    await run('ffmpeg', [
      '-y', '-v', 'error', '-stream_loop', '-1', '-i', source, '-t', String(timeline.durationSec),
      '-af', `afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, timeline.durationSec - 2.5)}:d=2.5,loudnorm=I=-16:TP=-1.5`,
      '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', outFile,
    ], { logger });
    return { kind: 'file', source };
  }
  const music = generateMusic({ durationSec: timeline.durationSec, seed: seedFrom(seedKey), mood, sampleRate: SR });
  writeWav(outFile, music.channels, SR);
  logger?.info(`Музыка: сгенерирована процедурно (${mood}, ${music.bpm} BPM)`);
  return { kind: 'generated', mood, bpm: music.bpm };
}
