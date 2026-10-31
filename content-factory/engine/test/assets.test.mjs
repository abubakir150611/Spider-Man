import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBrowser } from '../lib/browser.mjs';
import { prepareAssets } from '../lib/assets.mjs';

const PAGE = `<!doctype html><body style="margin:0"><h1 style="height:900px;background:#6d5dfc">Hero</h1><div style="height:900px;background:#eee">More</div></body>`;

test('captures a full-page website screenshot for item scenes', { skip: !findBrowser() && 'no Chromium' }, async (t) => {
  const server = createServer((_, res) => res.end(PAGE));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const dir = mkdtempSync(join(tmpdir(), 'cf-assets-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'assets'));
  const files = { dir, assetsDir: join(dir, 'assets'), assetsManifest: join(dir, 'assets', 'assets-manifest.json') };
  const url = `http://127.0.0.1:${server.address().port}/`;
  const script = { scenes: [{ type: 'hook', visual: {} }, { type: 'item', visual: { website: url, screenshot: true } }, { type: 'item', visual: { website: 'http://127.0.0.1:1/', screenshot: true } }] };
  const m = await prepareAssets({ files }, script, { width: 1920, height: 1080 }, { force: true });
  assert.equal(m.scenes[1].screenshotSrc, 'shots/scene-2.jpg');
  assert.ok(m.scenes[1].screenshotRatio > 1, 'screenshot must include content below the fold');
  assert.ok(existsSync(join(files.assetsDir, m.scenes[1].screenshotSrc)));
  assert.equal(m.failures.length, 1, 'unreachable site is reported, not fatal');
  assert.deepEqual(m.scenes[2], {});
});
