import { existsSync, rmSync } from 'node:fs';
import { findBrowser } from './browser.mjs';
import { getConfig } from './config.mjs';
import { REMOTION_ENTRY } from './paths.mjs';

/** Renders the silent video track with Remotion (H.264, yuv420p). */
export async function renderVideo({ timeline, publicDir, outFile, logger, concurrency }) {
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const config = getConfig();
  const browserExecutable = findBrowser({ purpose: 'render' });
  logger?.info(`Remotion: сборка композиции${browserExecutable ? ` (браузер: ${browserExecutable})` : ' (браузер будет загружен Remotion)'}`);
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir, onProgress: () => {} });
  const inputProps = { timeline };
  const chromiumOptions = process.env.CF_GL ? { gl: process.env.CF_GL } : {};
  const logLevel = process.env.CF_LOG_LEVEL === 'debug' ? 'verbose' : 'error';
  const composition = await selectComposition({ serveUrl, id: 'FactoryVideo', inputProps, browserExecutable, chromiumOptions, logLevel });
  if (existsSync(outFile)) rmSync(outFile);
  let lastLogged = -10;
  const started = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: config.video.crf,
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    logLevel,
    muted: true,
    outputLocation: outFile,
    inputProps,
    browserExecutable,
    chromiumOptions,
    concurrency: concurrency || Number(process.env.CF_CONCURRENCY) || null,
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct - lastLogged >= 10) {
        lastLogged = pct;
        logger?.info(`Рендер: ${pct}%`);
      }
    },
  });
  logger?.info(`Рендер завершён за ${Math.round((Date.now() - started) / 1000)}с`);
  return outFile;
}
