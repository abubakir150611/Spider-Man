import { existsSync } from 'node:fs';
import { getConfig } from './config.mjs';
import { readJson } from './project.mjs';
import { crossCheck, parseWith, publicationSchema, researchSchema, scriptSchema } from './schema.mjs';

/** Loads and validates research.json, script.json and publication.json of a project. */
export function loadInputs(project) {
  const { files } = project;
  const errors = [];
  const out = {};
  for (const [key, schema, file] of [
    ['research', researchSchema, files.research],
    ['script', scriptSchema, files.script],
    ['publication', publicationSchema, files.publication],
  ]) {
    if (!existsSync(file)) {
      errors.push(`${key}: файл не найден (${file})`);
      continue;
    }
    const parsed = parseWith(schema, readJson(file), key);
    if (parsed.ok) out[key] = parsed.data;
    else errors.push(...parsed.errors);
  }
  if (errors.length) return { ok: false, errors, warnings: [] };
  const wps = getConfig().tts.wordsPerSecond[out.script.language] || 2.5;
  const cross = crossCheck({ ...out, wordsPerSecond: wps });
  const brief = project.meta.brief;
  if (brief && out.script.platform !== brief.platform) cross.warnings.push(`Платформа в script.json (${out.script.platform}) отличается от брифа (${brief.platform}); используется брифовая геометрия кадра.`);
  return { ok: cross.errors.length === 0, ...out, errors: cross.errors, warnings: cross.warnings, estimate: { words: cross.words, seconds: cross.estimatedDurationSec } };
}
