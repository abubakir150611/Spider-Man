import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG_DIR } from './paths.mjs';

let cached;

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(base[key], value);
  return out;
}

/** factory.config.json, optionally overridden by config/local.config.json (gitignored). */
export function getConfig() {
  if (cached) return cached;
  const base = JSON.parse(readFileSync(resolve(CONFIG_DIR, 'factory.config.json'), 'utf8'));
  const localFile = resolve(CONFIG_DIR, 'local.config.json');
  const local = existsSync(localFile) ? JSON.parse(readFileSync(localFile, 'utf8')) : {};
  cached = deepMerge(base, local);
  return cached;
}

export { deepMerge };
