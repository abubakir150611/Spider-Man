import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { PROJECTS_DIR, PROJECT_SUBDIRS } from './paths.mjs';
import { slugify } from './slug.mjs';

export function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Файл не найден: ${file}`);
    throw new Error(`Некорректный JSON в ${file}: ${error.message}`);
  }
}

export function hashOf(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
}

function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/** Standard file locations inside a project folder. */
export function projectFiles(dir) {
  return {
    dir,
    meta: join(dir, 'project.json'),
    brief: join(dir, 'research', 'brief.json'),
    research: join(dir, 'research', 'research.json'),
    script: join(dir, 'scripts', 'script.json'),
    publication: join(dir, 'publications', 'publication.json'),
    timeline: join(dir, 'scripts', 'timeline.json'),
    voiceDir: join(dir, 'voiceovers'),
    voiceTrack: join(dir, 'voiceovers', 'voice-track.wav'),
    ttsManifest: join(dir, 'voiceovers', 'tts-manifest.json'),
    srt: join(dir, 'subtitles', 'subtitles.srt'),
    vtt: join(dir, 'subtitles', 'subtitles.vtt'),
    captionsJson: join(dir, 'subtitles', 'captions.json'),
    assetsDir: join(dir, 'assets'),
    assetsManifest: join(dir, 'assets', 'assets-manifest.json'),
    music: join(dir, 'assets', 'music.wav'),
    sfx: join(dir, 'assets', 'sfx.wav'),
    silentVideo: join(dir, 'renders', 'video-silent.mp4'),
    mixedAudio: join(dir, 'renders', 'audio-mix.m4a'),
    finalVideo: join(dir, 'renders', 'final.mp4'),
    cover: join(dir, 'renders', 'cover.jpg'),
    validation: join(dir, 'renders', 'validation.json'),
    telegramResult: join(dir, 'publications', 'telegram-result.json'),
    log: join(dir, 'logs', 'pipeline.log'),
  };
}

export function createProject(brief, { now = new Date() } = {}) {
  mkdirSync(PROJECTS_DIR, { recursive: true });
  let id = `${timestamp(now)}-${slugify(brief.topic)}`;
  let n = 2;
  while (existsSync(join(PROJECTS_DIR, id))) id = `${timestamp(now)}-${slugify(brief.topic)}-${n++}`;
  const dir = join(PROJECTS_DIR, id);
  for (const sub of PROJECT_SUBDIRS) mkdirSync(join(dir, sub), { recursive: true });
  const files = projectFiles(dir);
  writeJson(files.brief, brief);
  const meta = { id, createdAt: now.toISOString(), brief, stages: {} };
  writeJson(files.meta, meta);
  return { id, dir, files, meta };
}

export function listProjects() {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PROJECTS_DIR, d.name, 'project.json')))
    .map((d) => d.name)
    .sort();
}

/** Resolves a project by full id, unique prefix/substring, absolute path or "latest". */
export function loadProject(ref) {
  if (!ref) throw new Error('Укажите id проекта (или "latest").');
  let dir;
  if (ref.includes('/') && existsSync(join(resolve(ref), 'project.json'))) dir = resolve(ref);
  else {
    const all = listProjects();
    if (ref === 'latest') {
      if (!all.length) throw new Error('Проектов пока нет.');
      dir = join(PROJECTS_DIR, all[all.length - 1]);
    } else {
      const exact = all.find((p) => p === ref);
      const matches = exact ? [exact] : all.filter((p) => p.includes(ref));
      if (!matches.length) throw new Error(`Проект "${ref}" не найден в ${PROJECTS_DIR}`);
      if (matches.length > 1) throw new Error(`Неоднозначный id "${ref}": ${matches.join(', ')}`);
      dir = join(PROJECTS_DIR, matches[0]);
    }
  }
  const files = projectFiles(dir);
  for (const sub of PROJECT_SUBDIRS) mkdirSync(join(dir, sub), { recursive: true });
  const meta = readJson(files.meta);
  return { id: meta.id || basename(dir), dir, files, meta };
}

export function markStage(project, stage, status, extra = {}) {
  const meta = readJson(project.files.meta);
  meta.stages ||= {};
  meta.stages[stage] = { ...(meta.stages[stage] || {}), status, updatedAt: new Date().toISOString(), ...extra };
  writeJson(project.files.meta, meta);
  project.meta = meta;
  return meta.stages[stage];
}

export function stageDone(project, stage, inputHash) {
  const info = project.meta.stages?.[stage];
  return Boolean(info && info.status === 'done' && (!inputHash || info.inputHash === inputHash));
}
