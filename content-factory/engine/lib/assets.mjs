import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findBrowser } from './browser.mjs';
import { run } from './exec.mjs';
import { readJson, writeJson } from './project.mjs';
import { withRetry } from './retry.mjs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function imageSize(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]);
  const s = JSON.parse(stdout).streams[0];
  return { width: s.width, height: s.height };
}

/** Captures the top part of a website as a tall screenshot for the scrolling "screen recording". */
async function captureSite(browser, url, outFile, { vertical, logger }) {
  const page = await browser.newPage({ viewport: vertical ? { width: 1200, height: 900 } : { width: 1440, height: 900 }, userAgent: UA, deviceScaleFactor: 1 });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Hide common cookie banners / overlays.
    await page.addStyleTag({ content: '[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[aria-modal="true"]{display:none!important}' }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const height = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 2600));
    await page.screenshot({ path: outFile, type: 'jpeg', quality: 86, fullPage: true, clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.max(900, height) } });
    logger?.info(`Скриншот: ${url}`);
  } finally {
    await page.close();
  }
}

/** GitHub renders a social preview card for every public repo. */
async function fetchGithubCard(repoUrl, outFile) {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) throw new Error('не GitHub-репозиторий');
  const res = await fetch(`https://opengraph.githubassets.com/1/${m[1]}/${m[2].replace(/\.git$/, '')}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
}

/**
 * Prepares visual assets for item scenes: website screenshots (preferred) or GitHub cards.
 * Failures are non-fatal — the scene falls back to a designed card.
 */
export async function prepareAssets(project, script, brief, { logger, force = false } = {}) {
  const { files } = project;
  const shotsDir = join(files.assetsDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });
  const manifest = existsSync(files.assetsManifest) && !force ? readJson(files.assetsManifest) : { scenes: {}, failures: [] };
  manifest.failures = [];
  const items = script.scenes.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'item' && (s.visual.website || s.visual.github));
  if (process.env.CF_SKIP_SCREENSHOTS === '1') {
    logger?.info('Скриншоты отключены (CF_SKIP_SCREENSHOTS=1)');
    items.length = 0;
  }

  let browser = null;
  const needsBrowser = items.some(({ s, i }) => s.visual.screenshot !== false && s.visual.website && !manifest.scenes[i]?.screenshotSrc);
  if (needsBrowser) {
    try {
      const { chromium } = await import('playwright-core');
      const executablePath = findBrowser();
      if (!executablePath) throw new Error('Chromium не найден (задайте CF_BROWSER или выполните `npx remotion browser ensure`)');
      browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    } catch (error) {
      logger?.warn(`Скриншоты сайтов недоступны: ${error.message}`);
    }
  }

  try {
    for (const { s, i } of items) {
      const existing = manifest.scenes[i];
      if (existing && (existing.screenshotSrc || existing.imageSrc) && existsSync(join(files.assetsDir, existing.screenshotSrc || existing.imageSrc))) continue;
      const entry = {};
      if (browser && s.visual.website && s.visual.screenshot !== false) {
        const rel = `shots/scene-${i + 1}.jpg`;
        try {
          await withRetry(() => captureSite(browser, s.visual.website, join(files.assetsDir, rel), { vertical: brief.height > brief.width, logger }), { retries: 1, baseMs: 1500, label: `скриншот ${s.visual.website}`, logger });
          const size = await imageSize(join(files.assetsDir, rel));
          Object.assign(entry, { screenshotSrc: rel, screenshotRatio: size.height / size.width });
        } catch (error) {
          manifest.failures.push({ scene: i, url: s.visual.website, error: error.message });
          logger?.warn(`Не удалось снять ${s.visual.website}: ${error.message}`);
        }
      }
      if (!entry.screenshotSrc && s.visual.github) {
        const rel = `shots/scene-${i + 1}-github.png`;
        try {
          await withRetry(() => fetchGithubCard(s.visual.github, join(files.assetsDir, rel)), { retries: 2, baseMs: 1000, label: 'GitHub card', logger });
          entry.imageSrc = rel;
        } catch (error) {
          manifest.failures.push({ scene: i, url: s.visual.github, error: error.message });
          logger?.warn(`GitHub-карточка недоступна для ${s.visual.github}: ${error.message}`);
        }
      }
      manifest.scenes[i] = entry;
    }
  } finally {
    await browser?.close();
  }
  writeJson(files.assetsManifest, manifest);
  return manifest;
}
