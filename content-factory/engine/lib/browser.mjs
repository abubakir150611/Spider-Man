import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FACTORY_ROOT } from './paths.mjs';

function firstExisting(paths) {
  return paths.find((p) => p && existsSync(p)) || null;
}

function globHeadless(root, pattern) {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => pattern.test(d)).sort().reverse().map((d) => join(root, d));
}

/**
 * Finds a Chromium binary for rendering/screenshots. Order:
 * CF_BROWSER → Remotion's downloaded headless shell → Playwright browsers → system Chrome.
 * Returns null to let Remotion download its own Chrome Headless Shell.
 */
export function findBrowser() {
  if (process.env.CF_BROWSER && existsSync(process.env.CF_BROWSER)) return process.env.CF_BROWSER;
  const candidates = [];
  const remotionDir = join(FACTORY_ROOT, 'node_modules', '.remotion', 'chrome-headless-shell');
  if (existsSync(remotionDir)) {
    for (const platform of readdirSync(remotionDir)) {
      const dir = join(remotionDir, platform);
      for (const sub of existsSync(dir) ? readdirSync(dir) : []) {
        candidates.push(join(dir, sub, 'chrome-headless-shell'), join(dir, sub, 'chrome-headless-shell.exe'));
      }
    }
  }
  const pwRoots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', join(process.env.HOME || '', '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of pwRoots) {
    for (const dir of globHeadless(root, /^chromium_headless_shell-\d+/)) {
      candidates.push(join(dir, 'chrome-linux', 'headless_shell'), join(dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
    }
    for (const dir of globHeadless(root, /^chromium-\d+/)) candidates.push(join(dir, 'chrome-linux', 'chrome'), join(dir, 'chrome-linux64', 'chrome'));
  }
  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  );
  return firstExisting(candidates);
}
