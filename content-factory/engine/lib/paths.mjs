import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Root of the content-factory folder. */
export const FACTORY_ROOT = resolve(here, '../..');
export const ENGINE_DIR = resolve(FACTORY_ROOT, 'engine');
export const CONFIG_DIR = resolve(FACTORY_ROOT, 'config');
export const TEMPLATES_DIR = resolve(FACTORY_ROOT, 'templates');
export const SHARED_ASSETS_DIR = resolve(FACTORY_ROOT, 'assets');
export const PROJECTS_DIR = process.env.CF_PROJECTS_DIR
  ? resolve(process.env.CF_PROJECTS_DIR)
  : resolve(FACTORY_ROOT, 'projects');
export const ENV_FILE = resolve(FACTORY_ROOT, '.env');
export const MODELS_DIR = resolve(FACTORY_ROOT, '.models');
export const REMOTION_ENTRY = resolve(ENGINE_DIR, 'remotion/index.ts');
export const TTS_SCRIPT = resolve(ENGINE_DIR, 'tts/tts.py');

/** Sub-folders created inside every video project. */
export const PROJECT_SUBDIRS = [
  'research',
  'scripts',
  'assets',
  'voiceovers',
  'subtitles',
  'renders',
  'publications',
  'logs',
];
