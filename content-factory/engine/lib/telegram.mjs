import { existsSync, openAsBlob, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { env, envBool } from './env.mjs';
import { ffprobe } from './ffmpeg.mjs';
import { CONFIG_DIR, ENV_FILE } from './paths.mjs';
import { readJson, writeJson } from './project.mjs';
import { splitMessage } from './publication.mjs';
import { sleep } from './retry.mjs';
import { makeThumbnail, prepareTelegramMedia } from './telegram-media.mjs';

export const STATE_FILE = process.env.CF_TELEGRAM_STATE || join(CONFIG_DIR, 'telegram-state.json');

export class TelegramError extends Error {
  constructor(method, code, description) {
    super(`Telegram ${method}: ${code} ${description}`);
    this.code = code;
    this.description = description;
  }
}

/**
 * Approval state. In ephemeral environments (cloud sessions) the state file does
 * not survive, so CF_TELEGRAM_AUTO_PUBLISH=true acts as a standing approval.
 */
export function readState() {
  const state = existsSync(STATE_FILE) ? readJson(STATE_FILE) : {};
  if (!state.approved && envBool('CF_TELEGRAM_AUTO_PUBLISH')) return { ...state, approved: true, approvedBy: 'CF_TELEGRAM_AUTO_PUBLISH' };
  return state;
}

export function writeState(patch) {
  const state = { ...(existsSync(STATE_FILE) ? readJson(STATE_FILE) : {}), ...patch };
  writeJson(STATE_FILE, state);
  return state;
}

export function telegramSettings() {
  const token = env('TELEGRAM_BOT_TOKEN');
  const chatId = env('TELEGRAM_CHANNEL_ID');
  const apiBase = (env('TELEGRAM_API_BASE') || 'https://api.telegram.org').replace(/\/+$/, '');
  const customServer = Boolean(env('TELEGRAM_API_BASE'));
  const limitMB = Number(env('TELEGRAM_MAX_UPLOAD_MB') || (customServer ? 1950 : 49));
  return { token, chatId, apiBase, limitMB, configured: Boolean(token && chatId) };
}

export class TelegramClient {
  constructor({ token, apiBase = 'https://api.telegram.org', logger, retries = 4, fetchImpl = fetch }) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN не задан в .env');
    if (!/^\d+:[\w-]{20,}$/.test(token)) throw new Error('TELEGRAM_BOT_TOKEN имеет неверный формат (ожидается 123456:ABC...)');
    this.token = token;
    this.apiBase = apiBase;
    this.logger = logger;
    this.retries = retries;
    this.fetch = fetchImpl;
  }

  /** Calls a Bot API method. `files` maps field → absolute path for multipart uploads. */
  async call(method, params = {}, files = null) {
    const url = `${this.apiBase}/bot${this.token}/${method}`;
    for (let attempt = 0; ; attempt++) {
      let body;
      let headers;
      if (files) {
        body = new FormData();
        for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        for (const [field, path] of Object.entries(files)) body.append(field, await openAsBlob(path), basename(path));
      } else {
        body = JSON.stringify(params);
        headers = { 'content-type': 'application/json' };
      }
      let res;
      let data;
      try {
        res = await this.fetch(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(files ? 15 * 60 * 1000 : 60000) });
        data = await res.json().catch(() => ({ ok: false, error_code: res.status, description: res.statusText }));
      } catch (error) {
        // Network-level failure: never include the URL (it contains the token).
        if (attempt >= this.retries) throw new Error(`Telegram ${method}: сеть недоступна (${error.cause?.code || error.name})`);
        await this.backoff(method, attempt, `сеть: ${error.cause?.code || error.name}`);
        continue;
      }
      if (data.ok) return data.result;
      const code = data.error_code || res.status;
      if (code === 429 && attempt < this.retries) {
        const wait = (data.parameters?.retry_after || 5) * 1000;
        this.logger?.warn(`Telegram ${method}: лимит запросов, жду ${wait / 1000}с`);
        await sleep(wait);
        continue;
      }
      if (code >= 500 && attempt < this.retries) {
        await this.backoff(method, attempt, `HTTP ${code}`);
        continue;
      }
      throw new TelegramError(method, code, data.description || 'unknown error');
    }
  }

  async backoff(method, attempt, reason) {
    const wait = 1000 * 2 ** attempt;
    this.logger?.warn(`Telegram ${method}: ${reason}, повтор через ${wait / 1000}с`);
    await sleep(wait);
  }
}

/** Verifies the token, channel access and the bot's posting rights. */
export async function checkConnection({ client, chatId, logger }) {
  if (!chatId) throw new Error('TELEGRAM_CHANNEL_ID не задан в .env');
  const me = await client.call('getMe');
  const chat = await client.call('getChat', { chat_id: chatId });
  const member = await client.call('getChatMember', { chat_id: chatId, user_id: me.id });
  const isAdmin = ['administrator', 'creator'].includes(member.status);
  const canPost = chat.type === 'channel' ? isAdmin && member.can_post_messages !== false : ['administrator', 'creator', 'member'].includes(member.status);
  const result = {
    bot: `@${me.username}`,
    chat: { id: chat.id, title: chat.title || chat.username, type: chat.type, username: chat.username || null },
    memberStatus: member.status,
    canPost,
  };
  logger?.info(`Бот ${result.bot} → «${result.chat.title}» (${chat.type}), статус: ${member.status}, может публиковать: ${canPost ? 'да' : 'нет'}`);
  if (!canPost) throw new Error('Бот не может публиковать в этом чате. Добавьте его администратором канала с правом «Публикация сообщений».');
  return result;
}

export function messageLink(chat, messageId) {
  if (chat.username) return `https://t.me/${chat.username}/${messageId}`;
  const id = String(chat.id);
  return id.startsWith('-100') ? `https://t.me/c/${id.slice(4)}/${messageId}` : null;
}

/**
 * Publishes the final video + full post to the channel.
 * Requires a successful `telegram check` and a one-time approval (`telegram approve`).
 */
export async function publishToTelegram({ project, timeline, captionHtml, postHtml, logger, force = false, client: injected }) {
  const { files } = project;
  const settings = telegramSettings();
  if (!settings.configured) return { status: 'not_configured', message: `Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID в ${ENV_FILE} (или задайте переменные окружения)` };
  const state = readState();
  if (!state.approved) return { status: 'awaiting_approval', message: 'Первая публикация требует подтверждения: проверьте подключение (`cf telegram check`) и выполните `cf telegram approve`.' };
  if (existsSync(files.telegramResult) && !force) {
    const prev = readJson(files.telegramResult);
    if (prev.status === 'published') return { ...prev, status: 'already_published' };
  }
  const client = injected || new TelegramClient({ token: settings.token, apiBase: settings.apiBase, logger });
  const conn = await checkConnection({ client, chatId: settings.chatId, logger });

  const info = await ffprobe(files.finalVideo);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const media = await prepareTelegramMedia({ input: files.finalVideo, outDir: join(files.dir, 'renders'), durationSec: timeline.durationSec, width: v.width, height: v.height, limitMB: settings.limitMB, logger });
  const thumb = existsSync(files.cover) ? await makeThumbnail(files.cover, join(files.dir, 'renders', 'telegram-thumb.jpg'), logger) : null;

  const messages = [];
  for (let i = 0; i < media.files.length; i++) {
    const file = media.files[i];
    const probe = await ffprobe(file);
    const pv = probe.streams.find((s) => s.codec_type === 'video');
    const partLabel = media.files.length > 1 ? `\n\n<i>${i + 1}/${media.files.length}</i>` : '';
    logger?.info(`Telegram: загрузка ${basename(file)} (${(statSync(file).size / 1048576).toFixed(1)} МБ)`);
    const msg = await client.call(
      'sendVideo',
      {
        chat_id: settings.chatId,
        caption: i === 0 ? captionHtml + partLabel : partLabel.trim(),
        parse_mode: 'HTML',
        width: pv.width,
        height: pv.height,
        duration: Math.round(Number(probe.format.duration)),
        supports_streaming: true,
        ...(thumb ? { thumbnail: 'attach://thumb' } : {}),
        ...(i > 0 ? { reply_parameters: { message_id: messages[0].message_id } } : {}),
      },
      { video: file, ...(thumb ? { thumb } : {}) },
    );
    messages.push({ kind: 'video', message_id: msg.message_id, file: basename(file) });
  }
  for (const chunk of splitMessage(postHtml, 4096)) {
    const msg = await client.call('sendMessage', {
      chat_id: settings.chatId,
      text: chunk,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_parameters: { message_id: messages[0].message_id },
    });
    messages.push({ kind: 'text', message_id: msg.message_id });
  }
  const result = {
    status: 'published',
    publishedAt: new Date().toISOString(),
    bot: conn.bot,
    chat: conn.chat,
    uploadStrategy: media.plan,
    messages,
    link: messageLink(conn.chat, messages[0].message_id),
  };
  writeJson(files.telegramResult, result);
  return result;
}
