import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawQ';
const root = mkdtempSync(join(tmpdir(), 'cf-tg-'));
process.env.CF_PROJECTS_DIR = join(root, 'projects');
process.env.CF_TELEGRAM_STATE = join(root, 'telegram-state.json');

/** Minimal fake of the Telegram Bot API. */
function startMockApi({ adminStatus = 'administrator', rateLimitOnce = false } = {}) {
  const calls = [];
  let limited = !rateLimitOnce;
  let nextId = 100;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const [, bot, method] = req.url.split('/');
      const isMultipart = String(req.headers['content-type']).startsWith('multipart/');
      const body = isMultipart ? raw.toString('latin1') : JSON.parse(raw.toString() || '{}');
      calls.push({ method, bot, isMultipart, size: raw.length, body });
      const send = (obj, code = 200) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (bot !== `bot${TOKEN}`) return send({ ok: false, error_code: 401, description: 'Unauthorized' }, 401);
      if (method === 'getMe') return send({ ok: true, result: { id: 42, is_bot: true, username: 'factory_bot' } });
      if (method === 'getChat') return send({ ok: true, result: { id: -1001234567890, type: 'channel', title: 'Test Channel', username: 'testchannel' } });
      if (method === 'getChatMember') return send({ ok: true, result: { status: adminStatus, can_post_messages: true } });
      if (method === 'sendMessage' && !limited) {
        limited = true;
        return send({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 0.01 } }, 429);
      }
      if (method === 'sendVideo' || method === 'sendMessage') return send({ ok: true, result: { message_id: nextId++ } });
      return send({ ok: false, error_code: 404, description: 'Not Found' }, 404);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` })));
}

async function makeProject() {
  const { createProject, writeJson } = await import('../lib/project.mjs');
  const brief = { topic: 'Telegram test', platform: 'shorts', width: 320, height: 568 };
  const project = createProject(brief);
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x568:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', project.files.finalVideo]);
  execFileSync('ffmpeg', ['-v', 'error', '-i', project.files.finalVideo, '-frames:v', '1', project.files.cover]);
  writeJson(project.files.validation, { ok: true });
  return project;
}

const timeline = { durationSec: 2, language: 'ru' };

test('publication flow: configuration, approval gate, upload, idempotency', async (t) => {
  const api = await startMockApi({ rateLimitOnce: true });
  t.after(() => api.server.close());
  const tg = await import('../lib/telegram.mjs');
  const project = await makeProject();
  const args = { project, timeline, captionHtml: '<b>Title</b>', postHtml: `<b>Post</b>\n${'line\n'.repeat(1200)}` };

  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal((await tg.publishToTelegram(args)).status, 'not_configured');

  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_CHANNEL_ID = '@testchannel';
  process.env.TELEGRAM_API_BASE = api.base;
  assert.equal((await tg.publishToTelegram(args)).status, 'awaiting_approval');

  const client = new tg.TelegramClient({ token: TOKEN, apiBase: api.base });
  const check = await tg.checkConnection({ client, chatId: '@testchannel' });
  assert.equal(check.canPost, true);
  tg.writeState({ verified: { at: 'now', ...check }, approved: true, approvedAt: 'now' });

  const result = await tg.publishToTelegram(args);
  assert.equal(result.status, 'published');
  assert.equal(result.link, 'https://t.me/testchannel/100');
  assert.equal(result.uploadStrategy.strategy, 'direct');
  const video = api.calls.find((c) => c.method === 'sendVideo');
  assert.ok(video.isMultipart);
  assert.match(video.body, /name="video"; filename="final.mp4"/);
  assert.match(video.body, /name="thumb"/);
  assert.match(video.body, /attach:\/\/thumb/);
  const texts = api.calls.filter((c) => c.method === 'sendMessage' && c.body.reply_parameters);
  assert.ok(texts.length >= 2, 'long post must be split into several messages');
  assert.ok(texts.every((c) => c.body.text.length <= 4096 && c.body.reply_parameters.message_id === 100));
  assert.ok(existsSync(project.files.telegramResult));

  assert.equal((await tg.publishToTelegram(args)).status, 'already_published');
  const before = api.calls.length;
  assert.equal((await tg.publishToTelegram({ ...args, force: true })).status, 'published');
  assert.ok(api.calls.length > before);
});

test('bot without admin rights is rejected with a helpful message', async (t) => {
  const api = await startMockApi({ adminStatus: 'member' });
  t.after(() => api.server.close());
  const tg = await import('../lib/telegram.mjs');
  const client = new tg.TelegramClient({ token: TOKEN, apiBase: api.base });
  await assert.rejects(tg.checkConnection({ client, chatId: '@testchannel' }), /администратором/);
});

test('API and network errors never leak the token', async (t) => {
  const api = await startMockApi();
  t.after(() => api.server.close());
  const tg = await import('../lib/telegram.mjs');
  const wrong = new tg.TelegramClient({ token: '999999999:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', apiBase: api.base, retries: 0 });
  await assert.rejects(wrong.call('getMe'), (e) => e.code === 401 && !e.message.includes('BBBB'));
  const offline = new tg.TelegramClient({ token: TOKEN, apiBase: 'http://127.0.0.1:1', retries: 0 });
  await assert.rejects(offline.call('getMe'), (e) => /сеть недоступна/.test(e.message) && !e.message.includes(TOKEN));
  assert.throws(() => new tg.TelegramClient({ token: 'bad' }), /неверный формат/);
  assert.equal(tg.messageLink({ id: -1001234567890 }, 7), 'https://t.me/c/1234567890/7');
});

test.after(() => rmSync(root, { recursive: true, force: true }));
