import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FACTORY_ROOT } from '../lib/paths.mjs';
import { REPO_SKILL, cliCommandFor, renderSkill } from '../lib/skill.mjs';

test('skill template renders concrete CLI paths and no placeholders remain', () => {
  const md = renderSkill({ cliCommand: cliCommandFor('/home/me/.ai-content-factory'), factoryHome: '/home/me/.ai-content-factory' });
  assert.match(md, /^---\nname: create-video\n/);
  assert.match(md, /allowed-tools: Bash\(node \/home\/me\/\.ai-content-factory\/engine\/bin\/cf\.mjs:\*\)/);
  assert.ok(!md.includes('{{'));
  assert.equal(cliCommandFor('/My Home/cf'), 'node "/My Home/cf/engine/bin/cf.mjs"');
});

test('repository copy of the skill is in sync with the template (run pnpm sync-skill)', () => {
  const repoCopy = join(FACTORY_ROOT, '..', '.claude', 'skills', 'create-video', 'SKILL.md');
  if (!existsSync(join(FACTORY_ROOT, '..', '.git'))) return; // global install: ~/.claude is the user's, not the repo's
  assert.equal(readFileSync(repoCopy, 'utf8'), renderSkill(REPO_SKILL));
});

test('installer copies code, installs the global skill and preserves user data on update', () => {
  const home = mkdtempSync(join(tmpdir(), 'cf-home-'));
  const cfHome = join(home, '.ai-content-factory');
  const env = { ...process.env, HOME: home, USERPROFILE: home, CF_HOME: cfHome, CLAUDE_CONFIG_DIR: join(home, '.claude') };
  try {
    execFileSync('node', [join(FACTORY_ROOT, 'install.mjs'), '--skip-deps'], { env, stdio: 'pipe' });
    const skill = readFileSync(join(home, '.claude', 'skills', 'create-video', 'SKILL.md'), 'utf8');
    assert.ok(skill.includes(join(cfHome, 'engine', 'bin', 'cf.mjs')));
    assert.ok(existsSync(join(cfHome, 'engine', 'bin', 'cf.mjs')));
    assert.ok(existsSync(join(cfHome, '.env')));
    assert.ok(existsSync(join(home, '.local', 'bin', process.platform === 'win32' ? 'cf.cmd' : 'cf')));

    writeFileSync(join(cfHome, '.env'), 'TELEGRAM_CHANNEL_ID=@mine\n');
    writeFileSync(join(cfHome, 'projects', 'keep.txt'), 'x');
    execFileSync('node', [join(FACTORY_ROOT, 'install.mjs'), '--skip-deps'], { env, stdio: 'pipe' });
    assert.equal(readFileSync(join(cfHome, '.env'), 'utf8'), 'TELEGRAM_CHANNEL_ID=@mine\n');
    assert.ok(existsSync(join(cfHome, 'projects', 'keep.txt')));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('CF_TELEGRAM_AUTO_PUBLISH acts as approval in ephemeral environments', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cf-state-'));
  process.env.CF_TELEGRAM_STATE = join(dir, 'state.json');
  const { readState } = await import('../lib/telegram.mjs');
  delete process.env.CF_TELEGRAM_AUTO_PUBLISH;
  if (readState().approved) return; // state path fixed by an earlier import in this process
  process.env.CF_TELEGRAM_AUTO_PUBLISH = 'true';
  assert.equal(readState().approved, true);
  delete process.env.CF_TELEGRAM_AUTO_PUBLISH;
  rmSync(dir, { recursive: true, force: true });
});
