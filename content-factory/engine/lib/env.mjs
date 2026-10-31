import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FACTORY_ROOT } from './paths.mjs';

let loaded = false;

/**
 * Loads secrets from `.env` files without overriding variables that are
 * already set in the process environment. content-factory/.env wins over the
 * repository root .env.
 */
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const candidates = [resolve(FACTORY_ROOT, '.env'), resolve(FACTORY_ROOT, '..', '.env')];
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch (error) {
        throw new Error(`Не удалось прочитать ${file}: ${error.message}`);
      }
    }
  }
}

export function env(name, fallback = undefined) {
  loadEnv();
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function envBool(name, fallback = false) {
  const value = env(name);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on', 'да'].includes(String(value).toLowerCase());
}

/** Values of environment variables that look secret, used for log redaction. */
export function secretValues() {
  loadEnv();
  return Object.entries(process.env)
    .filter(([key, value]) => /TOKEN|SECRET|PASSWORD|API_KEY|_KEY$/i.test(key) && value && value.length >= 8)
    .map(([, value]) => value);
}
