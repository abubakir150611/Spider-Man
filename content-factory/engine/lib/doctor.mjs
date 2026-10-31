import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findBrowser } from './browser.mjs';
import { env } from './env.mjs';
import { pythonBin, run, which } from './exec.mjs';
import { ENV_FILE, FACTORY_ROOT, TTS_SCRIPT } from './paths.mjs';
import { readState, telegramSettings } from './telegram.mjs';

async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Environment diagnostics: tools, TTS engines, browser, secrets and network. */
export async function doctor() {
  const checks = [];
  const add = (name, ok, detail, level = ok ? 'ok' : 'error') => checks.push({ name, ok, detail, level });

  const [major, minor] = process.versions.node.split('.').map(Number);
  add('Node.js ≥ 20.12', major > 20 || (major === 20 && minor >= 12), process.versions.node);
  add('ffmpeg', Boolean(which('ffmpeg')), which('ffmpeg') || 'не найден — https://ffmpeg.org/download.html');
  add('ffprobe', Boolean(which('ffprobe')), which('ffprobe') || 'не найден');
  add('Зависимости npm', existsSync(join(FACTORY_ROOT, 'node_modules', 'remotion')), `pnpm install в ${FACTORY_ROOT}`);
  const browser = findBrowser({ purpose: 'render' });
  add('Chrome Headless Shell (рендер)', true, browser || 'ещё не скачан — запустите установщик повторно или он скачается при первом рендере (~100 МБ)', browser ? 'ok' : 'warn');
  const shotBrowser = findBrowser({ purpose: 'screenshot' });
  add('Браузер для скриншотов сайтов', true, shotBrowser || 'не найден — скриншоты будут пропущены', shotBrowser ? 'ok' : 'warn');

  const py = pythonBin();
  let tts = {};
  try {
    const { stdout } = await run(py, [TTS_SCRIPT, '--probe']);
    tts = JSON.parse(stdout);
    add('Python', true, py);
  } catch (error) {
    add('Python', false, `${py}: ${error.message}`);
  }
  add('TTS: edge-tts (бесплатно, естественный голос, RU/EN)', Boolean(tts.edge), tts.edge ? 'установлен' : 'pip install -r requirements.txt', tts.edge ? 'ok' : 'warn');
  add('TTS: piper (офлайн, RU/EN)', Boolean(tts.piper), tts.piper ? 'установлен' : 'опционально: pip install piper-tts', tts.piper ? 'ok' : 'info');
  add('TTS: MMS (офлайн, кыргызский)', Boolean(tts.mms), tts.mms ? 'установлен' : 'для кыргызского: pip install -r requirements-kyrgyz.txt', tts.mms ? 'ok' : 'info');
  add('TTS: espeak-ng (резерв)', Boolean(tts.espeak), tts.espeak ? 'установлен' : 'опционально: apt/brew install espeak-ng', tts.espeak ? 'ok' : 'info');
  if (!tts.edge && !tts.piper && !tts.mms && !tts.espeak) add('TTS', false, 'ни один движок озвучки не доступен');

  const tg = telegramSettings();
  add('TELEGRAM_BOT_TOKEN', Boolean(tg.token), tg.token ? 'задан (скрыт)' : `не задан (${ENV_FILE} или переменная окружения)`, tg.token ? 'ok' : 'warn');
  add('TELEGRAM_CHANNEL_ID', Boolean(tg.chatId), tg.chatId ? 'задан' : `не задан (${ENV_FILE} или переменная окружения)`, tg.chatId ? 'ok' : 'warn');
  const state = readState();
  add('Telegram: проверка и разрешение публикации', Boolean(state.approved), state.approved ? `разрешено ${state.approvedAt} (${state.verified?.chat?.title || ''})` : 'выполните cf telegram check → cf telegram approve', state.approved ? 'ok' : 'info');

  const net = {
    'api.telegram.org': await reachable(tg.apiBase),
    'speech.platform.bing.com (edge-tts)': await reachable('https://speech.platform.bing.com/'),
    'github.com': await reachable('https://github.com/'),
  };
  for (const [host, ok] of Object.entries(net)) add(`Сеть: ${host}`, ok, ok ? 'доступен' : 'недоступен', ok ? 'ok' : 'warn');
  if (env('CF_TTS_PROVIDER')) add('CF_TTS_PROVIDER', true, env('CF_TTS_PROVIDER'), 'info');
  return checks;
}
