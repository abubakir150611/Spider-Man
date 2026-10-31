import test from 'node:test';
import assert from 'node:assert/strict';
import { crossCheck, parseWith, publicationSchema, researchSchema, scriptSchema } from '../lib/schema.mjs';
import { clone, publication, research, script } from './fixtures.mjs';

const parsed = () => ({
  research: parseWith(researchSchema, research, 'r').data,
  script: parseWith(scriptSchema, script, 's').data,
  publication: parseWith(publicationSchema, publication, 'p').data,
});

test('valid inputs pass and defaults are applied', () => {
  const p = parsed();
  assert.equal(p.script.theme, 'graphite-lime');
  assert.equal(p.script.scenes[0].transition, 'auto');
  const r = crossCheck({ ...p, wordsPerSecond: 2.4 });
  assert.deepEqual(r.errors, []);
});

test('schema errors are reported with paths', () => {
  const bad = clone(script);
  bad.scenes[1].visual.website = 'not-a-url';
  const r = parseWith(scriptSchema, bad, 'script');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /scenes\.1\.visual\.website/);
  const badPub = clone(publication);
  badPub.hashtags = ['no hash'];
  assert.equal(parseWith(publicationSchema, badPub, 'p').ok, false);
});

test('invented commands and links are rejected by the cross-check', () => {
  const p = parsed();
  p.script.scenes[1].visual.command = 'npm install lucide-magic';
  p.script.scenes[1].visual.github = 'https://github.com/fake/repo';
  p.publication.links[0].install = ['pip install lucide'];
  const r = crossCheck({ ...p });
  assert.equal(r.errors.length, 3);
  assert.match(r.errors.join('\n'), /не подтверждена/);
  assert.match(r.errors.join('\n'), /отсутствует в research/);
});

test('structure warnings: hook first, outro last, duration estimate', () => {
  const p = parsed();
  p.script.scenes.reverse();
  p.script.targetDurationSec = 120;
  const r = crossCheck({ ...p });
  assert.ok(r.warnings.some((w) => w.includes('hook')));
  assert.ok(r.warnings.some((w) => w.includes('outro')));
  assert.ok(r.warnings.some((w) => w.includes('Оценка длительности')));
});
