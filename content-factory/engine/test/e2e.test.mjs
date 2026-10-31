import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { which } from '../lib/exec.mjs';
import { clone, publication, research, script } from './fixtures.mjs';

const root = mkdtempSync(join(tmpdir(), 'cf-e2e-'));
process.env.CF_PROJECTS_DIR = join(root, 'projects');
process.env.CF_TELEGRAM_STATE = join(root, 'tg.json');
process.env.CF_SKIP_SCREENSHOTS = '1';
process.env.CF_TTS_PROVIDER = 'espeak';

const canRun = which('ffmpeg') && (which('espeak-ng') || which('espeak'));

test('full pipeline builds a valid video and resumes on re-run', { skip: !canRun && 'needs ffmpeg + espeak-ng', timeout: 15 * 60 * 1000 }, async () => {
  const { createProject, loadProject, writeJson, listProjects } = await import('../lib/project.mjs');
  const { buildProject, publishProject } = await import('../lib/pipeline.mjs');
  const { createLogger } = await import('../lib/logger.mjs');
  const { parseRequest } = await import('../lib/request-parser.mjs');

  const brief = { ...parseRequest('Shorts: Тест конвейера, 15 сек'), width: 270, height: 480 };
  const created = createProject(brief);
  writeJson(created.files.research, research);
  const s = clone(script);
  s.scenes.splice(2, 0, { type: 'code', narration: 'Ставится одной командой.', visual: { lines: ['npm install lucide-react'], output: ['✓ done'] } });
  writeJson(created.files.script, s);
  writeJson(created.files.publication, publication);

  const logger = createLogger({ file: created.files.log, quiet: true });
  let project = loadProject(created.id);
  const { timeline, validation } = await buildProject(project, { logger });
  assert.ok(validation.ok);
  const report = JSON.parse(readFileSync(project.files.validation, 'utf8'));
  assert.equal(report.metrics.video.width, 270);
  assert.equal(report.metrics.video.codec, 'h264');
  assert.equal(report.metrics.audio.codec, 'aac');
  assert.ok(Math.abs(report.metrics.durationSec - timeline.durationSec) < 0.6);
  for (const f of [project.files.srt, project.files.vtt, project.files.cover, join(project.dir, 'publications', 'telegram-post.html'), join(project.dir, 'publications', 'publication.md')]) assert.ok(existsSync(f), f);

  // Re-run: every stage is cached, nothing is re-rendered.
  project = loadProject('latest');
  const t0 = Date.now();
  await buildProject(project, { logger });
  assert.ok(Date.now() - t0 < 20000, 're-run should reuse cached stages');
  const log = readFileSync(project.files.log, 'utf8');
  assert.match(log, /\[render\] уже выполнен/);
  assert.deepEqual(listProjects(), [created.id]);

  // Without Telegram credentials publishing is skipped gracefully.
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal((await publishProject(project, { logger })).status, 'not_configured');
});

test.after(() => rmSync(root, { recursive: true, force: true }));
