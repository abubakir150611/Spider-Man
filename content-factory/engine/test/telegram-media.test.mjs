import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeThumbnail, prepareTelegramMedia } from '../lib/telegram-media.mjs';

const dir = mkdtempSync(join(tmpdir(), 'cf-tgm-'));
const input = join(dir, 'big.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=3', '-f', 'lavfi', '-i', 'anoisesrc=d=3', '-c:v', 'libx264', '-b:v', '9M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', input]);

test('direct upload when the file fits', async () => {
  const r = await prepareTelegramMedia({ input, outDir: dir, durationSec: 3, width: 1080, height: 1920, limitMB: 50 });
  assert.equal(r.plan.strategy, 'direct');
  assert.deepEqual(r.files, [input]);
});

test('compresses an oversized video below the limit', async () => {
  const sizeMB = statSync(input).size / 1048576;
  const limitMB = Math.max(0.8, sizeMB / 2.5);
  const r = await prepareTelegramMedia({ input, outDir: dir, durationSec: 3, width: 1080, height: 1920, limitMB });
  assert.equal(r.plan.strategy, 'compress');
  assert.ok(statSync(r.files[0]).size / 1048576 <= limitMB);
});

test('splits a video that cannot be compressed with acceptable quality', async () => {
  const r = await prepareTelegramMedia({ input, outDir: dir, durationSec: 3, width: 1080, height: 1920, limitMB: 0.3 });
  assert.equal(r.plan.strategy, 'split');
  assert.equal(r.files.length, r.plan.parts);
  for (const f of r.files) assert.ok(statSync(f).size / 1048576 <= 0.3);
});

test('thumbnail is at most 320px', async () => {
  const cover = join(dir, 'cover.jpg');
  execFileSync('ffmpeg', ['-v', 'error', '-i', input, '-frames:v', '1', cover]);
  const thumb = await makeThumbnail(cover, join(dir, 'thumb.jpg'));
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', thumb]).toString().trim().split(',').map(Number);
  assert.ok(Math.max(...out) <= 320);
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
