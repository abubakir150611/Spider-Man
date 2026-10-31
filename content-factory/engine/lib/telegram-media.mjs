import { statSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './exec.mjs';

const AUDIO_KBPS = 128;

/** Decides how to fit a video into Telegram's upload limit. Pure function. */
export function planTelegramUpload({ sizeMB, durationSec, limitMB, width, height }) {
  if (sizeMB <= limitMB) return { strategy: 'direct' };
  const budgetKbps = Math.floor((limitMB * 0.94 * 8192) / durationSec) - AUDIO_KBPS;
  const shortSide = Math.min(width, height);
  if (budgetKbps >= 1500) return { strategy: 'compress', videoKbps: budgetKbps, shortSide };
  if (budgetKbps >= 650) return { strategy: 'compress', videoKbps: budgetKbps, shortSide: Math.min(shortSide, 720) };
  const partKbps = 2200;
  const parts = Math.ceil((durationSec * (partKbps + AUDIO_KBPS)) / (limitMB * 0.94 * 8192));
  return { strategy: 'split', parts, partDurationSec: Number((durationSec / parts).toFixed(3)), videoKbps: partKbps, shortSide: Math.min(shortSide, 1080) };
}

function scaleFilter(width, height, shortSide) {
  if (Math.min(width, height) <= shortSide) return 'null';
  return width < height ? `scale=${shortSide}:-2` : `scale=-2:${shortSide}`;
}

async function encode({ input, output, videoKbps, filter, ss, t, logger }) {
  const args = ['-y', '-v', 'error'];
  if (ss !== undefined) args.push('-ss', String(ss));
  args.push('-i', input);
  if (t !== undefined) args.push('-t', String(t));
  args.push(
    '-vf', filter, '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', `${videoKbps}k`, '-maxrate', `${Math.round(videoKbps * 1.25)}k`, '-bufsize', `${videoKbps * 2}k`,
    '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-movflags', '+faststart', output,
  );
  await run('ffmpeg', args, { logger, timeoutMs: 60 * 60 * 1000 });
  return output;
}

/** Produces the file(s) that will actually be uploaded. */
export async function prepareTelegramMedia({ input, outDir, durationSec, width, height, limitMB, logger }) {
  const sizeMB = statSync(input).size / 1024 / 1024;
  const plan = planTelegramUpload({ sizeMB, durationSec, limitMB, width, height });
  if (plan.strategy === 'direct') return { plan, files: [input] };
  const filter = scaleFilter(width, height, plan.shortSide);
  // Encodes, then lowers the bitrate until the output fits the limit (max 3 attempts).
  const fit = async (output, extra) => {
    let kbps = plan.videoKbps;
    for (let attempt = 0; attempt < 3; attempt++) {
      const out = await encode({ input, output, videoKbps: kbps, filter, logger, ...extra });
      const outMB = statSync(out).size / 1024 / 1024;
      if (outMB <= limitMB) return out;
      kbps = Math.max(200, Math.floor(kbps * (limitMB / outMB) * 0.9));
    }
    throw new Error(`Не удалось уложить ${output} в лимит Telegram ${limitMB} МБ`);
  };
  if (plan.strategy === 'compress') {
    logger?.info(`Видео ${sizeMB.toFixed(1)} МБ > ${limitMB} МБ — сжимаю для Telegram (${plan.videoKbps} кбит/с)`);
    return { plan, files: [await fit(join(outDir, 'telegram.mp4'))] };
  }
  logger?.info(`Видео слишком длинное для одного файла — делю на ${plan.parts} части`);
  const files = [];
  for (let i = 0; i < plan.parts; i++) {
    files.push(await fit(join(outDir, `telegram-part${i + 1}.mp4`), { ss: i * plan.partDurationSec, t: plan.partDurationSec }));
  }
  return { plan, files };
}

/** Telegram thumbnails: JPEG, ≤320 px, ≤200 KB. */
export async function makeThumbnail(cover, outFile, logger) {
  await run('ffmpeg', ['-y', '-v', 'error', '-i', cover, '-vf', 'scale=320:320:force_original_aspect_ratio=decrease', '-q:v', '5', outFile], { logger });
  return outFile;
}
