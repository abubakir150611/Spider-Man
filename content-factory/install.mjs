#!/usr/bin/env node
/**
 * AI Content Factory — global installer (macOS / Linux / Windows).
 *
 *   node content-factory/install.mjs            install or update into ~/.ai-content-factory
 *   CF_HOME=/path node install.mjs              custom location
 *   node install.mjs --skip-deps                copy files and the skill only
 *
 * Installs the engine, its dependencies, a `cf` launcher and the user-level
 * Claude Code skill `/create-video`, which then works in every project and
 * session. Re-running updates the code and keeps .env, projects, Telegram
 * approval, voice models and your music.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const CF_HOME = resolve(process.env.CF_HOME || join(HOME, '.ai-content-factory'));
const CLAUDE_DIR = resolve(process.env.CLAUDE_CONFIG_DIR || join(HOME, '.claude'));
const SKIP_DEPS = process.argv.includes('--skip-deps');
const isWin = process.platform === 'win32';

const log = (m) => process.stdout.write(`• ${m}\n`);
const warn = (m) => process.stdout.write(`⚠ ${m}\n`);

// On Windows only npm/pnpm are .cmd shims that need a shell; everything else runs directly
// (so paths with spaces stay intact).
function sh(cmd, args, opts = {}) {
  const shell = isWin && /^(pnpm|npm)(\.cmd)?$/.test(cmd);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell, ...opts });
  return r.status === 0;
}
const has = (cmd) => spawnSync(isWin ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;

// 1. Code: replaced on every run. Data: never touched.
const CODE = ['engine', 'skill', 'templates', 'package.json', 'pnpm-lock.yaml', 'requirements.txt', 'requirements-offline.txt', 'requirements-kyrgyz.txt', 'README.md', '.env.example', 'install.mjs', '.gitignore'];
const same = resolve(SRC) === CF_HOME;
mkdirSync(CF_HOME, { recursive: true });
if (!same) {
  for (const item of CODE) {
    const from = join(SRC, item);
    if (!existsSync(from)) continue;
    const to = join(CF_HOME, item);
    if (item === 'engine') rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true, filter: (p) => !p.includes(`${'node_modules'}`) });
  }
  mkdirSync(join(CF_HOME, 'config'), { recursive: true });
  cpSync(join(SRC, 'config', 'factory.config.json'), join(CF_HOME, 'config', 'factory.config.json'));
  mkdirSync(join(CF_HOME, 'assets', 'music'), { recursive: true });
  cpSync(join(SRC, 'assets', 'music', 'README.md'), join(CF_HOME, 'assets', 'music', 'README.md'));
}
mkdirSync(join(CF_HOME, 'projects'), { recursive: true });
if (!existsSync(join(CF_HOME, '.env'))) cpSync(join(SRC, '.env.example'), join(CF_HOME, '.env'));
log(`Фабрика: ${CF_HOME}`);

// 2. Dependencies.
if (!SKIP_DEPS) {
  const npmOk = has('pnpm')
    ? sh('pnpm', ['install', '--prod=false'], { cwd: CF_HOME })
    : sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: CF_HOME });
  if (!npmOk) {
    console.error('✖ Не удалось установить npm-зависимости. Проверьте Node.js ≥ 20.12 и интернет.');
    process.exit(1);
  }
  const py = (isWin ? ['python', 'py', 'python3'] : ['python3', 'python']).find(has);
  if (py) {
    const req = join(CF_HOME, 'requirements.txt');
    const ok =
      sh(py, ['-m', 'pip', 'install', '--quiet', '-r', req]) ||
      sh(py, ['-m', 'pip', 'install', '--quiet', '--user', '-r', req]) ||
      sh(py, ['-m', 'pip', 'install', '--quiet', '--user', '--break-system-packages', '-r', req]);
    if (!ok) warn('edge-tts не установлен — выполните вручную: pip install -r requirements.txt');
  } else warn('Python не найден — озвучка не будет работать. Установите Python 3.9+.');
  if (!has('ffmpeg')) warn(`FFmpeg не найден — установите его: ${isWin ? 'winget install Gyan.FFmpeg (затем откройте новый терминал)' : 'brew install ffmpeg / sudo apt install ffmpeg'}`);
}

// 3. Launcher `cf`.
const binDir = join(HOME, '.local', 'bin');
mkdirSync(binDir, { recursive: true });
const cli = join(CF_HOME, 'engine', 'bin', 'cf.mjs');
// POSIX launcher (also used by Git Bash on Windows) + cmd/PowerShell launcher on Windows.
writeFileSync(join(binDir, 'cf'), `#!/bin/sh\nexec node "${cli.replace(/\\/g, '/')}" "$@"\n`);
if (isWin) writeFileSync(join(binDir, 'cf.cmd'), `@echo off\r\nnode "${cli}" %*\r\n`);
else chmodSync(join(binDir, 'cf'), 0o755);
log(`Команда cf: ${join(binDir, isWin ? 'cf.cmd' : 'cf')}${(process.env.PATH || '').includes(binDir) ? '' : ' (добавьте эту папку в PATH, если хотите вызывать cf напрямую)'}`);

// 4. Global Claude Code skill.
const { renderSkill, cliCommandFor } = await import(pathToFileURL(join(CF_HOME, 'engine', 'lib', 'skill.mjs')).href);
const skillDir = join(CLAUDE_DIR, 'skills', 'create-video');
mkdirSync(skillDir, { recursive: true });
writeFileSync(join(skillDir, 'SKILL.md'), renderSkill({ cliCommand: cliCommandFor(CF_HOME), factoryHome: CF_HOME, template: undefined }));
const legacy = join(CLAUDE_DIR, 'commands', 'create-video.md');
if (existsSync(legacy)) rmSync(legacy);
log(`Глобальная команда /create-video: ${join(skillDir, 'SKILL.md')}`);

// 5. Diagnostics.
if (!SKIP_DEPS) sh('node', [cli, 'doctor']);
const projects = readdirSync(join(CF_HOME, 'projects')).filter((d) => !d.startsWith('.')).length;
process.stdout.write(
  `\n✔ AI Content Factory установлена. Проектов: ${projects}.\n` +
    `  1) Заполните ${join(CF_HOME, '.env')} (TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID)\n` +
    '  2) Перезапустите Claude Code и в любом проекте напишите: /create-video <тема>\n',
);
