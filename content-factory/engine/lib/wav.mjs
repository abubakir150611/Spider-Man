import { readFileSync, writeFileSync } from 'node:fs';

/** Reads a 16-bit PCM WAV file into per-channel Float32Arrays. */
export function readWav(file) {
  const buf = readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: не WAV`);
  let offset = 12;
  let fmt;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    let size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!fmt) throw new Error(`${file}: нет fmt-чанка`);
      if (fmt.bits !== 16) throw new Error(`${file}: поддерживается только 16-bit PCM`);
      if (size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      const frames = Math.floor(size / (2 * fmt.channels));
      const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.channels; c++) channels[c][i] = buf.readInt16LE(body + (i * fmt.channels + c) * 2) / 32768;
      }
      return { sampleRate: fmt.sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${file}: нет data-чанка`);
}

/** Writes per-channel Float32Arrays as a 16-bit PCM WAV file. */
export function writeWav(file, channels, sampleRate) {
  const frames = channels[0].length;
  const n = channels.length;
  const dataSize = frames * n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(n, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * n * 2, 28);
  buf.writeUInt16LE(n * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  writeFileSync(file, buf);
}
