import { getConfig } from './config.mjs';
import { run } from './exec.mjs';

const dbToGain = (db) => 10 ** (db / 20);

/**
 * Mixes voice + ducked music + SFX, normalises loudness (EBU R128) and
 * muxes the result with the rendered video into the final MP4 (H.264 + AAC).
 */
export async function mixAndMux({ files, timeline, logger }) {
  const { audio, video } = getConfig();
  const filter = [
    `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[voice][side]`,
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${dbToGain(audio.musicGainDb).toFixed(4)}[music]`,
    `[music][side]sidechaincompress=threshold=${audio.duckThreshold}:ratio=${audio.duckRatio}:attack=15:release=450:makeup=1[ducked]`,
    `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${dbToGain(audio.sfxGainDb).toFixed(4)}[sfx]`,
    `[voice][ducked][sfx]amix=inputs=3:normalize=0:duration=first,loudnorm=I=${video.loudnessLUFS}:TP=${video.truePeak}:LRA=11,aresample=48000[out]`,
  ].join(';');
  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-i', files.voiceTrack, '-i', files.music, '-i', files.sfx,
    '-filter_complex', filter, '-map', '[out]',
    '-t', String(timeline.durationSec),
    '-c:a', 'aac', '-b:a', video.audioBitrate, '-ar', String(video.audioSampleRate), '-ac', '2',
    files.mixedAudio,
  ], { logger, timeoutMs: 20 * 60 * 1000 });

  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-i', files.silentVideo, '-i', files.mixedAudio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'copy',
    '-movflags', '+faststart', '-shortest',
    '-metadata', `title=${timeline.title}`,
    files.finalVideo,
  ], { logger, timeoutMs: 20 * 60 * 1000 });

  // Cover image (thumbnail) from the hook, ~1s in.
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.min(1.2, timeline.durationSec / 2)), '-i', files.finalVideo, '-frames:v', '1', '-q:v', '3', files.cover], { logger });
  return files.finalVideo;
}
