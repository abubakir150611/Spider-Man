import { statSync } from 'node:fs';
import { run } from './exec.mjs';
import { ffprobe } from './ffmpeg.mjs';

function parseSilences(stderr) {
  const out = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: ([\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/);
    if (s) start = Number(s[1]);
    if (e) out.push({ start, end: Number(e[1]), duration: Number(e[2]) });
  }
  return out;
}

function parseBlack(stderr) {
  return [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((m) => ({ start: Number(m[1]), end: Number(m[2]), duration: Number(m[3]) }));
}

/**
 * Full technical QA of the final file: container/codec/format checks, a full
 * decode pass (corrupted frames), loudness, long silences and black frames.
 */
export async function validateVideo(file, { width, height, fps, durationSec, loudness = -14, logger } = {}) {
  const errors = [];
  const warnings = [];
  const info = await ffprobe(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(info.format.duration);
  const sizeMB = statSync(file).size / 1024 / 1024;

  if (!v) errors.push('Нет видеодорожки');
  if (!a) errors.push('Нет аудиодорожки');
  if (v) {
    if (v.codec_name !== 'h264') errors.push(`Видео-кодек ${v.codec_name}, ожидался h264`);
    if (v.pix_fmt !== 'yuv420p') errors.push(`pix_fmt ${v.pix_fmt}, ожидался yuv420p`);
    if (width && (v.width !== width || v.height !== height)) errors.push(`Разрешение ${v.width}x${v.height}, ожидалось ${width}x${height}`);
    const [n, d] = String(v.r_frame_rate).split('/').map(Number);
    if (fps && Math.abs(n / d - fps) > 0.01) errors.push(`FPS ${n / d}, ожидалось ${fps}`);
  }
  if (a) {
    if (a.codec_name !== 'aac') errors.push(`Аудио-кодек ${a.codec_name}, ожидался aac`);
    if (Number(a.channels) !== 2) warnings.push(`Каналов аудио: ${a.channels}`);
  }
  if (durationSec && Math.abs(duration - durationSec) > 0.6) errors.push(`Длительность ${duration.toFixed(2)}с, ожидалось ${durationSec.toFixed(2)}с`);

  logger?.info('Проверка: полное декодирование файла...');
  const decode = await run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { timeoutMs: 30 * 60 * 1000 }).catch((e) => ({ stderr: e.stderr || e.message }));
  const decodeErrors = (decode.stderr || '').trim().split('\n').filter(Boolean);
  if (decodeErrors.length) errors.push(`Ошибки декодирования (${decodeErrors.length}): ${decodeErrors.slice(0, 3).join(' | ')}`);

  const analysis = await run('ffmpeg', [
    '-v', 'info', '-i', file,
    '-filter_complex', '[0:a]ebur128=framelog=quiet,silencedetect=noise=-45dB:d=2.5[aout];[0:v]blackdetect=d=0.5:pix_th=0.05[vout]',
    '-map', '[aout]', '-map', '[vout]', '-f', 'null', '-',
  ], { timeoutMs: 30 * 60 * 1000 });
  const stderr = analysis.stderr;
  const integrated = Number((stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0]);
  const truePeakMatch = stderr.match(/Peak:\s+(-?[\d.]+) dBFS/);
  if (!Number.isFinite(integrated)) warnings.push('Не удалось измерить громкость');
  else if (Math.abs(integrated - loudness) > 2) warnings.push(`Громкость ${integrated} LUFS (цель ${loudness})`);
  if (integrated < -40) errors.push('Звук практически отсутствует');
  const silences = parseSilences(stderr).filter((s) => s.end < duration - 0.5);
  if (silences.length) warnings.push(`Длинные паузы в звуке: ${silences.map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)}с`).join(', ')}`);
  const black = parseBlack(stderr);
  if (black.length) errors.push(`Чёрные кадры: ${black.map((b) => `${b.start.toFixed(1)}–${b.end.toFixed(1)}с`).join(', ')}`);

  return {
    ok: errors.length === 0,
    file,
    errors,
    warnings,
    metrics: {
      durationSec: Number(duration.toFixed(3)),
      sizeMB: Number(sizeMB.toFixed(2)),
      video: v && { codec: v.codec_name, profile: v.profile, width: v.width, height: v.height, fps: v.r_frame_rate, pixFmt: v.pix_fmt, bitrate: Number(v.bit_rate) },
      audio: a && { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels, bitrate: Number(a.bit_rate) },
      loudnessLUFS: integrated,
      truePeak: truePeakMatch ? Number(truePeakMatch[1]) : null,
    },
    checkedAt: new Date().toISOString(),
  };
}
