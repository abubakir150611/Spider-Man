/** Splits narration text into words, keeping punctuation attached. */
export function tokenize(text) {
  return text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

/**
 * Estimates word timings when the TTS engine does not provide boundaries.
 * Duration is distributed by character weight, with extra weight for pauses after punctuation.
 */
export function estimateWordTimings(text, durationSec, { leadSec = 0.05, tailSec = 0.1 } = {}) {
  const words = tokenize(text);
  if (!words.length) return [];
  const weights = words.map((w) => {
    const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
    const pause = /[.!?…]$/.test(w) ? 3 : /[,;:—–-]$/.test(w) ? 1.6 : 0;
    return { letters: letters + 1.5, pause };
  });
  const total = weights.reduce((s, w) => s + w.letters + w.pause, 0);
  const usable = Math.max(0.1, durationSec - leadSec - tailSec);
  let t = leadSec;
  return words.map((text, i) => {
    const speak = (weights[i].letters / total) * usable;
    const start = t;
    const end = t + speak;
    t = end + (weights[i].pause / total) * usable;
    return { text, start: round(start), end: round(end) };
  });
}

/**
 * Aligns engine word boundaries (which may strip punctuation) back onto the
 * original narration tokens so captions keep punctuation and casing.
 */
export function alignBoundaries(text, boundaries, durationSec) {
  const tokens = tokenize(text);
  if (!boundaries?.length) return estimateWordTimings(text, durationSec);
  const clean = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out = [];
  let b = 0;
  for (const token of tokens) {
    const key = clean(token);
    let match = -1;
    for (let k = b; k < Math.min(boundaries.length, b + 4); k++) {
      const bk = clean(boundaries[k].text);
      if (bk && (bk === key || key.startsWith(bk) || bk.startsWith(key))) {
        match = k;
        break;
      }
    }
    if (match >= 0) {
      out.push({ text: token, start: boundaries[match].start, end: boundaries[match].end });
      b = match + 1;
    } else {
      const prev = out.at(-1);
      const start = prev ? prev.end : 0;
      const next = boundaries[b];
      out.push({ text: token, start, end: next ? Math.max(start + 0.05, next.start) : start + 0.3 });
    }
  }
  return out;
}

/** Groups words into short caption cues suitable for vertical or horizontal video. */
export function buildCues(words, { maxChars = 28, maxWords = 4, maxGapSec = 0.6, minDurationSec = 0.6 } = {}) {
  const cues = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    cues.push({ start: current[0].start, end: current.at(-1).end, text: current.map((w) => w.text).join(' '), words: current });
    current = [];
  };
  for (const word of words) {
    const prev = current.at(-1);
    const length = current.map((w) => w.text).join(' ').length + word.text.length + 1;
    if (prev && (length > maxChars || current.length >= maxWords || word.start - prev.end > maxGapSec)) flush();
    current.push(word);
    if (/[.!?…]$/.test(word.text)) flush();
  }
  flush();
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1];
    const minEnd = cues[i].start + minDurationSec;
    cues[i].end = round(Math.max(cues[i].end, next ? Math.min(minEnd, next.start) : minEnd));
  }
  return cues;
}

function stamp(sec, sep) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
}

export function toVtt(cues) {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}

export const round = (n) => Math.round(n * 1000) / 1000;
