import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_DIR } from './paths.mjs';
import { buildMusicTrack, buildSfxTrack, buildVoiceTrack } from './audio-tracks.mjs';
import { prepareAssets } from './assets.mjs';
import { seedFrom } from './audio-synth.mjs';
import { getConfig } from './config.mjs';
import { loadInputs } from './inputs.mjs';
import { mixAndMux } from './mix.mjs';
import { hashOf, markStage, readJson, stageDone, writeJson } from './project.mjs';
import { telegramCaption, telegramPost, writePublicationFiles } from './publication.mjs';
import { renderVideo } from './render.mjs';
import { toSrt, toVtt } from './subtitles.mjs';
import { publishToTelegram } from './telegram.mjs';
import { buildTimeline } from './timeline.mjs';
import { synthesizeScenes } from './tts.mjs';
import { validateVideo } from './validate.mjs';

/** Hash of the Remotion source so design changes invalidate cached renders. */
function remotionSourceHash() {
  const dir = join(ENGINE_DIR, 'remotion');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.(tsx?|json)$/.test(e.name) ? [join(d, e.name)] : []));
  return hashOf(walk(dir).sort().map((f) => readFileSync(f, 'utf8')).join('\n'));
}

async function stage(project, name, logger, inputHash, force, fn) {
  if (!force && stageDone(project, name, inputHash)) {
    logger.info(`[${name}] уже выполнен — пропуск`);
    return project.meta.stages[name].result;
  }
  logger.step(name);
  markStage(project, name, 'running', { inputHash });
  const started = Date.now();
  try {
    const result = await fn();
    markStage(project, name, 'done', { inputHash, durationMs: Date.now() - started, result: result ?? null });
    return result;
  } catch (error) {
    markStage(project, name, 'failed', { error: error.message, durationMs: Date.now() - started });
    throw error;
  }
}

/**
 * Production pipeline: voiceover → assets → timeline & subtitles → audio
 * tracks → render → mix & mux → QA → publication files. Each stage is cached
 * by input hash, so re-runs resume where they stopped.
 */
export async function buildProject(project, { logger, force = false, only } = {}) {
  const inputs = loadInputs(project);
  for (const w of inputs.warnings) logger.warn(w);
  if (!inputs.ok) throw new Error(`Входные данные не прошли проверку:\n- ${inputs.errors.join('\n- ')}`);
  const { research, script, publication } = inputs;
  const brief = project.meta.brief;
  const config = getConfig();
  const { files } = project;
  const want = (name) => !only || only.includes(name);
  const scriptHash = hashOf({ script, brief });

  let voice;
  if (want('voiceover')) {
    voice = await stage(project, 'voiceover', logger, scriptHash, force, async () => {
      const scenes = await synthesizeScenes(project, script, { logger, force });
      return { scenes: scenes.length, providers: [...new Set(scenes.map((s) => s.provider))], timing: [...new Set(scenes.map((s) => s.timing))] };
    });
  }
  const ttsManifest = readJson(files.ttsManifest);
  const voiceScenes = script.scenes.map((_, i) => ttsManifest.scenes[`scene-${String(i + 1).padStart(2, '0')}`]);
  if (voiceScenes.some((v) => !v)) throw new Error('Озвучка неполная — запустите build без --only');

  const assets = want('assets')
    ? await stage(project, 'assets', logger, hashOf(script.scenes.map((s) => s.visual)), force, async () => {
        const m = await prepareAssets(project, script, brief, { logger, force });
        return { captured: Object.values(m.scenes).filter((s) => s.screenshotSrc || s.imageSrc).length, failures: m.failures.length };
      })
    : null;
  const assetsManifest = existsSync(files.assetsManifest) ? readJson(files.assetsManifest) : { scenes: {} };

  const timeline = buildTimeline({ script, brief, voice: voiceScenes, assets: assetsManifest.scenes, fps: config.video.fps });
  writeJson(files.timeline, timeline);
  writeFileSync(files.srt, toSrt(timeline.captions));
  writeFileSync(files.vtt, toVtt(timeline.captions));
  writeJson(files.captionsJson, timeline.captions);
  logger.info(`Таймлайн: ${timeline.scenes.length} сцен, ${timeline.durationSec}с (цель ${script.targetDurationSec}с), субтитров: ${timeline.captions.length}`);
  const timelineHash = hashOf(timeline);

  await stage(project, 'audio', logger, timelineHash + hashOf(script.music), force, async () => {
    buildVoiceTrack(timeline, files.voiceTrack);
    buildSfxTrack(timeline, files.sfx, seedFrom(project.id));
    return buildMusicTrack({ timeline, outFile: files.music, mood: script.music.mood, file: script.music.file, seedKey: project.id, logger });
  });

  const renderHash = timelineHash + remotionSourceHash();
  if (want('render')) {
    await stage(project, 'render', logger, renderHash, force, async () => {
      await renderVideo({ timeline, publicDir: files.assetsDir, outFile: files.silentVideo, logger });
      return { file: files.silentVideo };
    });
  }

  const mixHash = hashOf([renderHash, config.audio, project.meta.stages.audio?.inputHash]);
  await stage(project, 'mix', logger, mixHash, force, async () => {
    await mixAndMux({ files, timeline, logger });
    return { file: files.finalVideo };
  });

  const validation = await stage(project, 'validate', logger, mixHash, force, async () => {
    const report = await validateVideo(files.finalVideo, { width: brief.width, height: brief.height, fps: config.video.fps, durationSec: timeline.durationSec, loudness: config.video.loudnessLUFS, logger });
    report.tts = { providers: ttsManifest.providers, robotic: ttsManifest.robotic };
    writeJson(files.validation, report);
    for (const w of report.warnings) logger.warn(`QA: ${w}`);
    if (!report.ok) throw new Error(`Проверка видео не пройдена:\n- ${report.errors.join('\n- ')}`);
    logger.info(`QA пройдена: ${report.metrics.video.width}x${report.metrics.video.height}, ${report.metrics.durationSec}с, ${report.metrics.sizeMB} МБ, ${report.metrics.loudnessLUFS} LUFS`);
    return { ok: report.ok, warnings: report.warnings.length };
  });

  writePublicationFiles({ files, pub: publication, timeline, research, validation: readJson(files.validation) });
  markStage(project, 'publication', 'done', { inputHash: hashOf(publication) });
  logger.info('Материалы для публикации подготовлены (publications/)');
  return { timeline, validation, voice, assets };
}

export async function publishProject(project, { logger, force = false, client } = {}) {
  const inputs = loadInputs(project);
  if (!inputs.ok) throw new Error(inputs.errors.join('\n'));
  const { files } = project;
  if (!existsSync(files.finalVideo) || !existsSync(files.validation)) throw new Error('Сначала соберите видео: cf build <id>');
  const validation = readJson(files.validation);
  if (!validation.ok) throw new Error('Видео не прошло QA — публикация отменена.');
  const timeline = readJson(files.timeline);
  const result = await publishToTelegram({
    project,
    timeline,
    captionHtml: telegramCaption(inputs.publication),
    postHtml: telegramPost(inputs.publication, { language: timeline.language }),
    logger,
    force,
    client,
  });
  markStage(project, 'telegram', result.status === 'published' || result.status === 'already_published' ? 'done' : result.status, { result });
  return result;
}
