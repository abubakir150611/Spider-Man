import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from './config.mjs';
import { pythonBin, run } from './exec.mjs';
import { mediaDuration, toVoiceWav } from './ffmpeg.mjs';
import { MODELS_DIR, TTS_SCRIPT } from './paths.mjs';
import { hashOf, readJson, writeJson } from './project.mjs';
import { alignBoundaries } from './subtitles.mjs';

/** Provider chain for a language, honouring an explicit provider choice in the script. */
export function providerChain(language, voiceSettings = {}, config = getConfig()) {
  const chain = config.tts.chains[language];
  if (!chain) throw new Error(`Нет TTS-цепочки для языка ${language}`);
  const forced = process.env.CF_TTS_PROVIDER || (voiceSettings.provider !== 'auto' ? voiceSettings.provider : undefined);
  if (!forced) return chain;
  return [forced, ...chain.filter((p) => p !== forced)];
}

export function voicesFor(language, voiceSettings = {}, config = getConfig()) {
  const voices = { ...config.tts.voices[language] };
  if (voiceSettings.voice) {
    const provider = voiceSettings.provider && voiceSettings.provider !== 'auto' ? voiceSettings.provider : 'edge';
    voices[provider] = voiceSettings.voice;
  }
  if (process.env.CF_EDGE_VOICE) voices.edge = process.env.CF_EDGE_VOICE;
  return voices;
}

/**
 * Synthesises narration for every scene. Results are cached by content hash,
 * so re-running the pipeline only re-voices scenes whose text changed.
 */
export async function synthesizeScenes(project, script, { logger, force = false } = {}) {
  const { files } = project;
  const chain = providerChain(script.language, script.voice);
  const voices = voicesFor(script.language, script.voice);
  const manifest = existsSync(files.ttsManifest) && !force ? readJson(files.ttsManifest) : { scenes: {} };

  const jobs = [];
  const sceneKeys = script.scenes.map((scene, i) => {
    const id = `scene-${String(i + 1).padStart(2, '0')}`;
    const rate = scene.voice?.rate || script.voice.rate;
    const pitch = scene.voice?.pitch || script.voice.pitch;
    const key = hashOf({ text: scene.narration, chain, voices, rate, pitch, lang: script.language });
    const cached = manifest.scenes[id];
    if (cached && cached.key === key && existsSync(cached.wav)) return { id, key, cached: true };
    jobs.push({ id, text: scene.narration, lang: script.language, chain, voices, rate, pitch, out_dir: join(files.voiceDir, 'raw') });
    return { id, key, cached: false };
  });

  if (jobs.length) {
    logger?.info(`Озвучка: ${jobs.length} сцен(ы), цепочка провайдеров: ${chain.join(' → ')}`);
    const { stdout } = await run(pythonBin(), [TTS_SCRIPT], {
      input: JSON.stringify({ jobs, models_dir: MODELS_DIR }),
      timeoutMs: 30 * 60 * 1000,
      logger,
      onStderr: (line) => line.trim() && logger?.debug(`[tts] ${line.trim()}`),
    });
    const { results } = JSON.parse(stdout.trim().split('\n').at(-1));
    for (const result of results) {
      if (!result.ok) {
        const details = result.attempts.map((a) => `${a.provider}: ${a.error}`).join('; ');
        throw new Error(`Не удалось озвучить ${result.id}. ${details}`);
      }
      for (const a of result.attempts.filter((x) => !x.ok)) logger?.warn(`TTS ${a.provider} недоступен для ${result.id}: ${a.error}`);
      const wav = join(files.voiceDir, `${result.id}.wav`);
      await toVoiceWav(result.audio, wav, { logger });
      const duration = await mediaDuration(wav);
      const job = jobs.find((j) => j.id === result.id);
      const words = alignBoundaries(job.text, result.words, duration);
      const key = sceneKeys.find((k) => k.id === result.id).key;
      manifest.scenes[result.id] = {
        key, wav, duration, provider: result.provider, voice: result.voice,
        timing: result.words ? 'engine' : 'estimated', words,
      };
    }
  } else {
    logger?.info('Озвучка: все сцены взяты из кэша');
  }

  const providers = [...new Set(sceneKeys.map((k) => manifest.scenes[k.id].provider))];
  manifest.providers = providers;
  manifest.robotic = providers.includes('espeak');
  writeJson(files.ttsManifest, manifest);
  if (manifest.robotic) logger?.warn('Использован espeak-ng (роботизированный голос). Установите edge-tts/piper для естественной речи — см. README.');
  return sceneKeys.map((k) => ({ id: k.id, ...manifest.scenes[k.id] }));
}
