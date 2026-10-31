#!/usr/bin/env node
/**
 * AI Content Factory CLI.
 *   cf new "<запрос>"            создать проект из запроса (/create-video)
 *   cf validate <id>             проверить research/script/publication
 *   cf links <id>                проверить доступность всех ссылок исследования
 *   cf build <id> [--force]      озвучка → ассеты → рендер → сведение → QA → публикационные файлы
 *   cf publish <id> [--force]    опубликовать в Telegram
 *   cf run <id>                  build + publish (если публикация разрешена)
 *   cf telegram check|approve|revoke|status
 *   cf list | cf status <id> | cf doctor
 */
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { loadEnv } from '../lib/env.mjs';
import { createLogger, redact } from '../lib/logger.mjs';
import { doctor } from '../lib/doctor.mjs';
import { loadInputs } from '../lib/inputs.mjs';
import { checkLinks, collectUrls } from '../lib/links.mjs';
import { FACTORY_ROOT, TEMPLATES_DIR } from '../lib/paths.mjs';
import { buildProject, publishProject } from '../lib/pipeline.mjs';
import { createProject, listProjects, loadProject, readJson, writeJson } from '../lib/project.mjs';
import { parseRequest } from '../lib/request-parser.mjs';
import { TelegramClient, checkConnection, readState, telegramSettings, writeState } from '../lib/telegram.mjs';

loadEnv();

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const args = argv.filter((a) => !a.startsWith('--'));
const json = flags.has('--json');
const [command, ...rest] = args;

const rel = (p) => relative(process.cwd(), p) || '.';

function out(data, text) {
  if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  else if (text) process.stdout.write(`${text}\n`);
}

function projectLogger(project) {
  return createLogger({ file: project.files.log, level: flags.has('--verbose') ? 'debug' : 'info' });
}

const commands = {
  async new() {
    const request = rest.join(' ') || argv.filter((a) => !a.startsWith('--json')).slice(1).join(' ');
    const brief = parseRequest(request);
    const project = createProject(brief);
    out(
      { id: project.id, dir: project.dir, brief, files: { research: project.files.research, script: project.files.script, publication: project.files.publication }, templates: TEMPLATES_DIR },
      [
        `✔ Проект создан: ${project.id}`,
        `  Папка: ${rel(project.dir)}`,
        `  Платформа: ${brief.platformLabel} (${brief.width}×${brief.height}), язык: ${brief.language}, длительность: ~${brief.durationSec}с`,
        `  Тема: ${brief.topic}`,
        '',
        'Дальше создайте файлы (шаблоны в content-factory/templates/):',
        `  ${rel(project.files.research)}`,
        `  ${rel(project.files.script)}`,
        `  ${rel(project.files.publication)}`,
        `и запустите: node content-factory/engine/bin/cf.mjs run ${project.id}`,
      ].join('\n'),
    );
  },

  async validate() {
    const project = loadProject(rest[0]);
    const result = loadInputs(project);
    out({ ok: result.ok, errors: result.errors, warnings: result.warnings, estimate: result.estimate }, [
      result.ok ? '✔ Входные данные корректны' : '✖ Найдены ошибки:',
      ...result.errors.map((e) => `  ✖ ${e}`),
      ...result.warnings.map((w) => `  ⚠ ${w}`),
      result.estimate ? `  Оценка: ${result.estimate.words} слов ≈ ${result.estimate.seconds}с` : '',
    ].join('\n'));
    if (!result.ok) process.exitCode = 1;
  },

  async links() {
    const project = loadProject(rest[0]);
    const research = readJson(project.files.research);
    const results = await checkLinks(collectUrls(research));
    writeJson(`${project.dir}/research/link-check.json`, { checkedAt: new Date().toISOString(), results });
    const bad = results.filter((r) => !r.ok);
    out({ ok: bad.length === 0, results }, [
      ...results.map((r) => `${r.ok ? '✔' : '✖'} ${r.status || r.error || ''} ${r.url}${r.note ? ` (${r.note})` : ''}`),
      bad.length ? `\n${bad.length} ссылок недоступны — проверьте их или замените.` : '\n✔ Все ссылки доступны',
    ].join('\n'));
    if (bad.length) process.exitCode = 2;
  },

  async build() {
    const project = loadProject(rest[0]);
    const logger = projectLogger(project);
    logger.info(`Сборка проекта ${project.id}`);
    await buildProject(project, { logger, force: flags.has('--force') });
    const validation = readJson(project.files.validation);
    out({ id: project.id, video: project.files.finalVideo, validation }, `\n✔ Видео готово: ${rel(project.files.finalVideo)}`);
  },

  async publish() {
    const project = loadProject(rest[0]);
    const logger = projectLogger(project);
    const result = await publishProject(project, { logger, force: flags.has('--force') });
    out(result, describePublish(result));
    if (!['published', 'already_published'].includes(result.status)) process.exitCode = 3;
  },

  async run() {
    await commands.build();
    const settings = telegramSettings();
    if (!settings.configured) {
      out({ telegram: 'not_configured' }, 'ℹ Telegram не настроен — публикация пропущена (см. README → Telegram).');
      return;
    }
    await commands.publish();
  },

  async telegram() {
    const sub = rest[0] || 'status';
    const settings = telegramSettings();
    const logger = createLogger({ file: `${FACTORY_ROOT}/projects/telegram.log` });
    if (sub === 'status') {
      const state = readState();
      out({ configured: settings.configured, ...state }, [
        `Настроен: ${settings.configured ? 'да' : 'нет'}`,
        `Проверено: ${state.verified ? `${state.verified.at} — ${state.verified.bot} → «${state.verified.chat?.title}»` : 'нет'}`,
        `Автопубликация разрешена: ${state.approved ? `да (${state.approvedAt})` : 'нет'}`,
      ].join('\n'));
      return;
    }
    if (sub === 'revoke') {
      writeState({ approved: false, approvedAt: null });
      out({ approved: false }, '✔ Автопубликация отключена');
      return;
    }
    if (!settings.configured) throw new Error('Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID в content-factory/.env');
    const client = new TelegramClient({ token: settings.token, apiBase: settings.apiBase, logger });
    if (sub === 'check') {
      const result = await checkConnection({ client, chatId: settings.chatId, logger });
      writeState({ verified: { at: new Date().toISOString(), ...result } });
      out(result, `✔ Подключение работает: ${result.bot} может публиковать в «${result.chat.title}».\nЧтобы разрешить автопубликацию: cf telegram approve`);
      return;
    }
    if (sub === 'approve') {
      const state = readState();
      if (!state.verified) throw new Error('Сначала выполните: cf telegram check');
      writeState({ approved: true, approvedAt: new Date().toISOString() });
      out({ approved: true }, '✔ Автопубликация разрешена. Готовые видео будут публиковаться без дополнительных вопросов.');
      return;
    }
    if (sub === 'test') {
      const msg = await client.call('sendMessage', { chat_id: settings.chatId, text: '✅ AI Content Factory: тестовое сообщение. Подключение работает.' });
      out(msg, `✔ Тестовое сообщение отправлено (id ${msg.message_id})`);
      return;
    }
    throw new Error(`Неизвестная подкоманда telegram ${sub}`);
  },

  async list() {
    const ids = listProjects();
    const rows = ids.map((id) => {
      const p = loadProject(id);
      const st = p.meta.stages || {};
      return { id, topic: p.meta.brief.topic, platform: p.meta.brief.platform, video: existsSync(p.files.finalVideo), telegram: st.telegram?.status || '-' };
    });
    out(rows, rows.length ? rows.map((r) => `${r.video ? '🎬' : '…'} ${r.id}  [${r.platform}]  telegram: ${r.telegram}`).join('\n') : 'Проектов пока нет.');
  },

  async status() {
    const project = loadProject(rest[0] || 'latest');
    const stages = project.meta.stages || {};
    out({ id: project.id, brief: project.meta.brief, stages }, [
      `${project.id} — ${project.meta.brief.topic}`,
      ...Object.entries(stages).map(([k, v]) => `  ${v.status === 'done' ? '✔' : v.status === 'failed' ? '✖' : '•'} ${k}: ${v.status}${v.error ? ` — ${v.error.split('\n')[0]}` : ''}`),
    ].join('\n'));
  },

  async doctor() {
    const checks = await doctor();
    const icon = { ok: '✔', warn: '⚠', error: '✖', info: 'ℹ' };
    out(checks, checks.map((c) => `${icon[c.level]} ${c.name}: ${c.detail}`).join('\n'));
    if (checks.some((c) => c.level === 'error')) process.exitCode = 1;
  },
};

function describePublish(result) {
  switch (result.status) {
    case 'published':
      return `✔ Опубликовано в Telegram${result.link ? `: ${result.link}` : ''} (${result.messages.length} сообщ., загрузка: ${result.uploadStrategy.strategy})`;
    case 'already_published':
      return `ℹ Уже опубликовано ранее${result.link ? `: ${result.link}` : ''}. Повторить: --force`;
    case 'awaiting_approval':
      return `⏸ ${result.message}`;
    case 'not_configured':
      return `ℹ ${result.message}`;
    default:
      return JSON.stringify(result);
  }
}

async function main() {
  if (!command || command === 'help' || flags.has('--help')) {
    process.stdout.write(
      'AI Content Factory\n\n' +
        '  cf new "<запрос>"              создать проект (Shorts:/Reels:/TikTok:/YouTube long:, --lang ru|en|ky, --duration 45s|8m)\n' +
        '  cf validate <id>               проверить research/script/publication\n' +
        '  cf links <id>                  проверить ссылки исследования\n' +
        '  cf build <id> [--force]        собрать видео\n' +
        '  cf publish <id> [--force]      опубликовать в Telegram\n' +
        '  cf run <id>                    build + publish\n' +
        '  cf telegram check|approve|revoke|status|test\n' +
        '  cf list | cf status [id] | cf doctor\n' +
        '\n  id: полный id, его часть или "latest". Флаги: --json --verbose\n',
    );
    return;
  }
  const fn = commands[command];
  if (!fn) throw new Error(`Неизвестная команда: ${command}. См. cf help`);
  await fn();
}

main().catch((error) => {
  const message = redact(error.message || String(error));
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.stderr.write(`✖ ${message}\n`);
  process.exitCode = process.exitCode || 1;
});
