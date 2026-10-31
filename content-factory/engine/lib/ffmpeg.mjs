import { run } from './exec.mjs';

export async function ffprobe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(stdout);
}

export async function mediaDuration(file) {
  const info = await ffprobe(file);
  return Number(info.format.duration);
}

/** Converts any audio to 48 kHz mono 16-bit WAV, trimming trailing silence (leading kept so word timings stay valid). */
export async function toVoiceWav(input, output, { logger } = {}) {
  await run(
    'ffmpeg',
    [
      '-y', '-v', 'error', '-i', input,
      '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,highpass=f=70,acompressor=threshold=-18dB:ratio=2.5:attack=5:release=80',
      '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', output,
    ],
    { logger },
  );
}
