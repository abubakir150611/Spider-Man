import { z } from 'zod';

const url = z.string().url().refine((u) => /^https?:\/\//.test(u), 'URL должен начинаться с http(s)://');
const nonEmpty = z.string().trim().min(1);

export const THEMES = ['graphite-lime', 'midnight-cyan', 'ember', 'ice', 'mono-red', 'violet-noir'];
export const LANGUAGES = ['ru', 'en', 'ky'];
export const PLATFORMS = ['shorts', 'reels', 'tiktok', 'youtube'];

const installCommand = z.object({
  cmd: nonEmpty,
  note: z.string().optional(),
  source: url,
});

export const researchSchema = z.object({
  topic: nonEmpty,
  researchedAt: nonEmpty,
  summary: z.string().optional(),
  items: z
    .array(
      z.object({
        name: nonEmpty,
        purpose: nonEmpty,
        features: z.array(nonEmpty).default([]),
        advantages: z.array(nonEmpty).default([]),
        website: url.optional(),
        github: url.optional(),
        docs: url.optional(),
        install: z.array(installCommand).default([]),
        example: z.string().optional(),
        license: z.string().optional(),
        pricing: z.string().optional(),
        sources: z.array(url).min(1, 'У каждого пункта должен быть хотя бы один источник'),
      }),
    )
    .default([]),
  facts: z.array(z.object({ text: nonEmpty, source: url })).default([]),
  sources: z.array(z.object({ title: nonEmpty, url })).min(1, 'Нужен хотя бы один источник'),
});

const base = {
  id: z.string().optional(),
  narration: nonEmpty,
  chapter: z.string().optional(),
  transition: z.enum(['auto', 'slide', 'zoom', 'wipe', 'blur', 'none']).default('auto'),
  voice: z.object({ rate: z.string().optional(), pitch: z.string().optional() }).optional(),
};

export const sceneSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('hook'), visual: z.object({ headline: nonEmpty, kicker: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('title'), visual: z.object({ title: nonEmpty, subtitle: z.string().optional(), label: z.string().optional() }) }),
  z.object({
    ...base,
    type: z.literal('item'),
    visual: z.object({
      index: z.number().int().positive(),
      total: z.number().int().positive().optional(),
      name: nonEmpty,
      tagline: nonEmpty,
      bullets: z.array(nonEmpty).max(4).default([]),
      website: url.optional(),
      github: url.optional(),
      command: z.string().optional(),
      badge: z.string().optional(),
      screenshot: z.boolean().default(true),
    }),
  }),
  z.object({
    ...base,
    type: z.literal('code'),
    visual: z.object({
      title: z.string().optional(),
      language: z.string().default('bash'),
      lines: z.array(z.string()).min(1).max(12),
      output: z.array(z.string()).max(6).default([]),
    }),
  }),
  z.object({ ...base, type: z.literal('stat'), visual: z.object({ value: nonEmpty, label: nonEmpty, source: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('bullets'), visual: z.object({ title: nonEmpty, items: z.array(nonEmpty).min(1).max(6) }) }),
  z.object({ ...base, type: z.literal('fact'), visual: z.object({ text: nonEmpty, source: z.string().optional(), label: z.string().optional() }) }),
  z.object({ ...base, type: z.literal('outro'), visual: z.object({ headline: nonEmpty, cta: nonEmpty, handle: z.string().optional() }) }),
]);

export const scriptSchema = z.object({
  title: nonEmpty,
  language: z.enum(LANGUAGES),
  platform: z.enum(PLATFORMS),
  targetDurationSec: z.number().positive(),
  theme: z.enum(THEMES).default('graphite-lime'),
  voice: z
    .object({
      provider: z.enum(['auto', 'edge', 'piper', 'mms', 'espeak']).default('auto'),
      voice: z.string().optional(),
      rate: z.string().default('+0%'),
      pitch: z.string().default('+0Hz'),
    })
    .default({ provider: 'auto', rate: '+0%', pitch: '+0Hz' }),
  music: z.object({ mood: z.enum(['focus', 'upbeat', 'cinematic', 'calm']).default('focus'), file: z.string().optional() }).default({ mood: 'focus' }),
  scenes: z.array(sceneSchema).min(3),
});

export const publicationSchema = z.object({
  title: nonEmpty,
  shortDescription: nonEmpty,
  longDescription: nonEmpty,
  keyPoints: z.array(nonEmpty).min(1),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u, 'Хештег должен начинаться с # и не содержать пробелов')).min(1).max(30),
  keywords: z.array(nonEmpty).default([]),
  cta: nonEmpty,
  links: z
    .array(
      z.object({
        name: nonEmpty,
        description: z.string().optional(),
        website: url.optional(),
        github: url.optional(),
        docs: url.optional(),
        install: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  sources: z.array(z.object({ title: nonEmpty, url })).min(1),
});

function formatIssues(label, error) {
  return error.issues.map((i) => `${label}: ${i.path.join('.') || '(root)'} — ${i.message}`);
}

export function parseWith(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) return { ok: false, errors: formatIssues(label, result.error) };
  return { ok: true, data: result.data, errors: [] };
}

const normalizeUrl = (u) => u.replace(/\/+$/, '').replace(/^http:/, 'https:').toLowerCase();
const normalizeCmd = (c) => c.replace(/\s+/g, ' ').trim();

/**
 * Cross-checks script and publication against research so the video never
 * shows links or commands that were not found during research.
 */
export function crossCheck({ research, script, publication, wordsPerSecond = 2.5 }) {
  const errors = [];
  const warnings = [];
  const knownUrls = new Set();
  const knownCommands = new Set();
  for (const item of research.items) {
    for (const u of [item.website, item.github, item.docs, ...item.sources].filter(Boolean)) knownUrls.add(normalizeUrl(u));
    for (const i of item.install) knownCommands.add(normalizeCmd(i.cmd));
  }
  for (const s of research.sources) knownUrls.add(normalizeUrl(s.url));
  for (const f of research.facts) knownUrls.add(normalizeUrl(f.source));

  script.scenes.forEach((scene, idx) => {
    const where = `script.scenes[${idx}] (${scene.type})`;
    if (scene.type === 'item') {
      for (const key of ['website', 'github']) {
        const value = scene.visual[key];
        if (value && !knownUrls.has(normalizeUrl(value))) errors.push(`${where}: ссылка ${value} отсутствует в research.json`);
      }
      if (scene.visual.command && !knownCommands.has(normalizeCmd(scene.visual.command))) {
        errors.push(`${where}: команда "${scene.visual.command}" не подтверждена в research.json (items[].install)`);
      }
    }
    if (scene.type === 'code') {
      for (const line of scene.visual.lines) {
        const cmd = normalizeCmd(line.replace(/^\$\s*/, ''));
        if (cmd && !cmd.startsWith('#') && !knownCommands.has(cmd)) warnings.push(`${where}: строка "${cmd}" не найдена среди подтверждённых команд`);
      }
    }
  });

  if (script.scenes[0].type !== 'hook') warnings.push('Первая сцена должна быть hook — зритель решает за 2 секунды.');
  const hookWords = script.scenes[0].narration.split(/\s+/).length;
  if (hookWords > 14) warnings.push(`Hook слишком длинный (${hookWords} слов). Оптимально до 12 слов (~2–4 с).`);
  if (script.scenes.at(-1).type !== 'outro') warnings.push('Последняя сцена должна быть outro с призывом подписаться.');

  const words = script.scenes.reduce((sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const estimated = words / wordsPerSecond;
  const ratio = estimated / script.targetDurationSec;
  if (ratio < 0.65 || ratio > 1.35) {
    warnings.push(`Оценка длительности ${Math.round(estimated)}с сильно отличается от цели ${script.targetDurationSec}с (${words} слов). Подкорректируйте текст.`);
  }

  if (publication) {
    for (const link of publication.links) {
      for (const key of ['website', 'github', 'docs']) {
        if (link[key] && !knownUrls.has(normalizeUrl(link[key]))) errors.push(`publication.links "${link.name}": ${link[key]} отсутствует в research.json`);
      }
      for (const cmd of link.install) {
        if (!knownCommands.has(normalizeCmd(cmd))) errors.push(`publication.links "${link.name}": команда "${cmd}" не подтверждена в research.json`);
      }
    }
    const mentioned = script.scenes.filter((s) => s.type === 'item').map((s) => s.visual.name.toLowerCase());
    for (const name of mentioned) {
      if (!publication.links.some((l) => l.name.toLowerCase() === name)) warnings.push(`Инструмент "${name}" упомянут в видео, но нет в publication.links`);
    }
  }
  return { errors, warnings, estimatedDurationSec: Math.round(estimated), words };
}
