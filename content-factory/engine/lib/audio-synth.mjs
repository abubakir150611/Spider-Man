/**
 * Procedural, royalty-free background music and sound effects.
 * Everything is synthesised from scratch, so there are no licensing issues.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;

const MOODS = {
  focus: { bpm: [96, 104], progressions: [[0, -4, 3, -2], [0, 3, -4, -2], [0, -2, -4, -5]], drums: 0.8, brightness: 0.45 },
  upbeat: { bpm: [112, 122], progressions: [[0, -4, 3, -2], [0, 5, -4, 3]], drums: 1, brightness: 0.6 },
  cinematic: { bpm: [84, 92], progressions: [[0, -4, -2, -5], [0, 3, -2, -4]], drums: 0.55, brightness: 0.35 },
  calm: { bpm: [78, 86], progressions: [[0, -4, 3, -2], [0, -2, 3, -4]], drums: 0.35, brightness: 0.3 },
};

/** Minor triad (+7th sometimes) on a scale degree offset in semitones from the root. */
function chordNotes(root, offset, rand) {
  const base = root + offset;
  const isMajor = [3, -4, -2, 5, -5].includes(offset);
  const third = isMajor ? 4 : 3;
  const notes = [base, base + third, base + 7];
  if (rand() > 0.4) notes.push(base + (isMajor ? 11 : 10));
  return notes;
}

/** Renders a seamless loop of `bars` bars into stereo buffers. */
function renderLoop({ sampleRate, bpm, bars, root, progression, mood, rand }) {
  const beat = 60 / bpm;
  const barLen = beat * 4;
  const len = Math.round(barLen * bars * sampleRate);
  const pad = [new Float32Array(len), new Float32Array(len)];
  const bass = new Float32Array(len);
  const drums = [new Float32Array(len), new Float32Array(len)];
  const add = (buf, i, v) => {
    buf[((i % len) + len) % len] += v;
  };

  // Pads: additive detuned saw-ish voices with slow envelopes, wrapped circularly.
  for (let bar = 0; bar < bars; bar++) {
    const offset = progression[bar % progression.length];
    const notes = chordNotes(root, offset, rand);
    const start = Math.round(bar * barLen * sampleRate);
    const dur = Math.round(barLen * 1.25 * sampleRate);
    notes.forEach((note, ni) => {
      const pan = (ni / Math.max(1, notes.length - 1)) * 0.6 - 0.3;
      for (const detune of [-0.06, 0.06]) {
        const f = midiToHz(note + 12 + detune);
        for (let i = 0; i < dur; i++) {
          const t = i / sampleRate;
          const env = Math.min(1, t / 0.6) * Math.min(1, (dur / sampleRate - t) / 0.8);
          let s = 0;
          for (let h = 1; h <= 5; h++) s += (Math.sin(TAU * f * h * t + h) / h) * mood.brightness ** (h - 1);
          const v = s * env * 0.035;
          add(pad[0], start + i, v * (1 - pan));
          add(pad[1], start + i, v * (1 + pan));
        }
      }
    });
    // Bass: root on 8th notes with a soft pluck envelope.
    const bf = midiToHz(root + offset - 12);
    for (let step = 0; step < 8; step++) {
      if (step % 2 === 1 && rand() < 0.5) continue;
      const s0 = start + Math.round(step * (beat / 2) * sampleRate);
      const bl = Math.round(beat * 0.45 * sampleRate);
      for (let i = 0; i < bl; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 6);
        add(bass, s0 + i, (Math.sin(TAU * bf * t) + 0.25 * Math.sin(TAU * bf * 2 * t)) * env * 0.16);
      }
    }
    // Drums: kick on 1 & 3, clap on 2 & 4, hats on 8ths.
    for (let b = 0; b < 4; b++) {
      const s0 = start + Math.round(b * beat * sampleRate);
      if (b % 2 === 0) {
        const kl = Math.round(0.32 * sampleRate);
        let phase = 0;
        for (let i = 0; i < kl; i++) {
          const t = i / sampleRate;
          const f = 45 + 110 * Math.exp(-t * 30);
          phase += (TAU * f) / sampleRate;
          const v = Math.sin(phase) * Math.exp(-t * 9) * 0.5;
          add(drums[0], s0 + i, v);
          add(drums[1], s0 + i, v);
        }
      } else {
        const cl = Math.round(0.18 * sampleRate);
        let prev = 0;
        for (let i = 0; i < cl; i++) {
          const t = i / sampleRate;
          const n = rand() * 2 - 1;
          const hp = n - prev;
          prev = n;
          const v = hp * Math.exp(-t * 22) * 0.09;
          add(drums[0], s0 + i, v);
          add(drums[1], s0 + i, v);
        }
      }
      for (const half of [0, 0.5]) {
        const hs = s0 + Math.round(half * beat * sampleRate);
        const hl = Math.round(0.05 * sampleRate);
        const accent = half === 0.5 ? 1 : 0.55;
        let prev = 0;
        for (let i = 0; i < hl; i++) {
          const n = rand() * 2 - 1;
          const hp = n - prev;
          prev = n;
          const v = hp * Math.exp((-i / sampleRate) * 70) * 0.03 * accent;
          add(drums[0], hs + i, v * 0.7);
          add(drums[1], hs + i, v * 1.3);
        }
      }
    }
  }
  // Gentle low-pass on pads.
  for (const ch of pad) {
    let y = 0;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < len; i++) ch[i] = y += 0.22 * (ch[i] - y);
  }
  return { pad, bass, drums, len, barSamples: Math.round(barLen * sampleRate) };
}

/** Generates background music of the requested length (stereo Float32Arrays). */
export function generateMusic({ durationSec, seed = 1, mood: moodName = 'focus', sampleRate = 48000 }) {
  const rand = mulberry32(seed);
  const mood = MOODS[moodName] || MOODS.focus;
  const bpm = Math.round(mood.bpm[0] + rand() * (mood.bpm[1] - mood.bpm[0]));
  const root = 45 + Math.floor(rand() * 7); // A2..D#3
  const progression = mood.progressions[Math.floor(rand() * mood.progressions.length)];
  const loop = renderLoop({ sampleRate, bpm, bars: 4, root, progression, mood, rand });
  const total = Math.round(durationSec * sampleRate);
  const out = [new Float32Array(total), new Float32Array(total)];
  const introBars = 2;
  for (let i = 0; i < total; i++) {
    const li = i % loop.len;
    const bar = Math.floor(i / loop.barSamples);
    const drumGain = bar < introBars ? 0 : mood.drums * Math.min(1, (i - introBars * loop.barSamples) / (loop.barSamples * 0.5));
    for (let c = 0; c < 2; c++) out[c][i] = loop.pad[c][li] + loop.bass[li] + loop.drums[c][li] * drumGain;
  }
  // Fade in/out + soft clip + normalise.
  const fadeIn = Math.min(total, sampleRate * 1.5);
  const fadeOut = Math.min(total, sampleRate * 2.5);
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const g = Math.min(1, i / fadeIn) * Math.min(1, (total - i) / fadeOut);
    for (let c = 0; c < 2; c++) {
      const v = Math.tanh(out[c][i] * 1.4) * g;
      out[c][i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (const ch of out) for (let i = 0; i < total; i++) ch[i] *= norm;
  return { channels: out, sampleRate, bpm, root, progression };
}

/** A whoosh: band-limited noise sweep with a swelling envelope. */
export function whoosh({ sampleRate = 48000, duration = 0.55, seed = 7, direction = 1 }) {
  const rand = mulberry32(seed);
  const n = Math.round(duration * sampleRate);
  const out = [new Float32Array(n), new Float32Array(n)];
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const env = Math.sin(Math.PI * p) ** 2 * (p < 0.6 ? p / 0.6 : 1);
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * p);
    lp += cutoff * (rand() * 2 - 1 - lp);
    lp2 += cutoff * (lp - lp2);
    const v = lp2 * env * 2.2;
    const pan = direction * (p * 2 - 1) * 0.6;
    out[0][i] = v * (1 - pan);
    out[1][i] = v * (1 + pan);
  }
  return out;
}

/** A soft UI pop/blip. */
export function pop({ sampleRate = 48000, freq = 880 }) {
  const n = Math.round(0.09 * sampleRate);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = freq * (1 + 0.5 * Math.exp(-t * 60));
    const v = Math.sin(TAU * f * t) * Math.exp(-t * 45) * Math.min(1, t / 0.002) * 0.35;
    out[0][i] = v;
    out[1][i] = v;
  }
  return out;
}

/** A short keyboard tick for typing animations. */
export function tick({ sampleRate = 48000, seed = 3 }) {
  const rand = mulberry32(seed);
  const n = Math.round(0.025 * sampleRate);
  const out = [new Float32Array(n), new Float32Array(n)];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const x = rand() * 2 - 1;
    const v = (x - prev) * Math.exp((-i / sampleRate) * 300) * 0.25;
    prev = x;
    out[0][i] = v;
    out[1][i] = v;
  }
  return out;
}

/** Low cinematic impact used on the hook. */
export function impact({ sampleRate = 48000 }) {
  const n = Math.round(0.9 * sampleRate);
  const out = [new Float32Array(n), new Float32Array(n)];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    phase += (TAU * (38 + 70 * Math.exp(-t * 12))) / sampleRate;
    const v = Math.sin(phase) * Math.exp(-t * 4.5) * 0.6;
    out[0][i] = v;
    out[1][i] = v;
  }
  return out;
}

/** Mixes a stereo clip into a stereo buffer at a given time. */
export function placeClip(target, clip, atSec, sampleRate, gain = 1) {
  const start = Math.round(atSec * sampleRate);
  for (let c = 0; c < 2; c++) {
    const src = clip[c] || clip[0];
    for (let i = 0; i < src.length; i++) {
      const j = start + i;
      if (j >= 0 && j < target[c].length) target[c][j] += src[i] * gain;
    }
  }
}
