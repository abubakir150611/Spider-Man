import { getConfig } from './config.mjs';

const PLATFORM_PREFIXES = [
  [/^(youtube\s*long|long\s*youtube|youtube\s*длинное|длинное(\s*видео)?|long(\s*video)?|ютуб|youtube)\s*[:\-—]\s*/i, 'youtube'],
  [/^(youtube\s*shorts|shorts|шортс)\s*[:\-—]\s*/i, 'shorts'],
  [/^(instagram\s*reels|instagram|reels|рилс)\s*[:\-—]\s*/i, 'reels'],
  [/^(tiktok|tik\s*tok|тикток|тик-ток)\s*[:\-—]\s*/i, 'tiktok'],
];

const PLATFORM_ALIASES = {
  youtube: 'youtube', long: 'youtube', yt: 'youtube',
  shorts: 'shorts', short: 'shorts', 'youtube-shorts': 'shorts',
  reels: 'reels', instagram: 'reels', ig: 'reels',
  tiktok: 'tiktok', tt: 'tiktok',
};

const LANGUAGE_ALIASES = {
  ru: 'ru', rus: 'ru', russian: 'ru', русский: 'ru',
  en: 'en', eng: 'en', english: 'en', английский: 'en',
  ky: 'ky', kg: 'ky', kir: 'ky', kyrgyz: 'ky', кыргызский: 'ky', киргизский: 'ky', кыргызча: 'ky',
};

const INLINE_LANGUAGE = [
  [/\s*[,(]?\s*(на\s+английском(\s+языке)?|in\s+english|english\s+version)\s*\)?/i, 'en'],
  [/\s*[,(]?\s*(на\s+(кыргызском|киргизском)(\s+языке)?|кыргызча|in\s+kyrgyz)\s*\)?/i, 'ky'],
  [/\s*[,(]?\s*(на\s+русском(\s+языке)?|in\s+russian)\s*\)?/i, 'ru'],
];

const INLINE_DURATION = /\s*(?:,|\(|длительность:?|duration:?)\s*(\d{1,4})\s*(секунд[аы]?|сек\.?|s|sec|seconds?|минут[аы]?|мин\.?|m|min|minutes?)(?![\p{L}])\s*\)?/iu;

export function parseDuration(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*([a-zа-я.]*)$/i);
  if (!match) throw new Error(`Не удалось разобрать длительность: "${value}"`);
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!unit || /^(s|sec|seconds?|сек\.?|секунд[аы]?)$/.test(unit)) return Math.round(amount);
  if (/^(m|min|minutes?|мин\.?|минут[аы]?)$/.test(unit)) return Math.round(amount * 60);
  throw new Error(`Неизвестная единица длительности: "${unit}"`);
}

export function detectLanguage(text) {
  if (/[ңөүҢӨҮ]/.test(text)) return 'ky';
  const cyr = (text.match(/[а-яё]/gi) || []).length;
  const lat = (text.match(/[a-z]/gi) || []).length;
  if (cyr === 0 && lat > 0) return 'en';
  return 'ru';
}

function extractFlags(text) {
  const flags = {};
  const rest = text.replace(/--(platform|lang|language|duration|voice|theme)[=\s]+("[^"]+"|\S+)/gi, (_, key, value) => {
    flags[key.toLowerCase() === 'language' ? 'lang' : key.toLowerCase()] = value.replace(/^"|"$/g, '');
    return ' ';
  });
  return { flags, rest };
}

/**
 * Parses a free-form /create-video request into a structured brief.
 * Examples: "Shorts: 5 tools --lang en", "YouTube long: обзор Claude Code, 10 минут".
 */
export function parseRequest(raw, config = getConfig()) {
  if (!raw || !raw.trim()) throw new Error('Пустой запрос: укажите тему видео.');
  let { flags, rest: text } = extractFlags(raw.trim());
  text = text.trim();

  let platform;
  for (const [re, value] of PLATFORM_PREFIXES) {
    if (re.test(text)) {
      platform = value;
      text = text.replace(re, '');
      break;
    }
  }
  if (flags.platform) {
    platform = PLATFORM_ALIASES[flags.platform.toLowerCase()];
    if (!platform) throw new Error(`Неизвестная платформа "${flags.platform}". Доступно: youtube, shorts, reels, tiktok`);
  }
  platform ||= config.defaults.platform;

  let language;
  for (const [re, value] of INLINE_LANGUAGE) {
    if (re.test(text)) {
      language = value;
      text = text.replace(re, ' ');
      break;
    }
  }
  if (flags.lang) {
    language = LANGUAGE_ALIASES[flags.lang.toLowerCase()];
    if (!language) throw new Error(`Неподдерживаемый язык "${flags.lang}". Доступно: ru, en, ky`);
  }

  let durationSec;
  const inline = text.match(INLINE_DURATION);
  if (inline) {
    durationSec = parseDuration(`${inline[1]}${inline[2]}`);
    text = text.replace(INLINE_DURATION, ' ');
  }
  if (flags.duration) durationSec = parseDuration(flags.duration);

  const topic = text.replace(/\s{2,}/g, ' ').replace(/^[\s,:;—-]+|[\s,:;—-]+$/g, '').trim();
  if (!topic) throw new Error('Не удалось выделить тему из запроса.');
  language ||= detectLanguage(topic);

  const preset = config.platforms[platform];
  const kind = preset.kind;
  const fallbackDuration = kind === 'long' ? config.defaults.longDurationSec : config.defaults.shortDurationSec;
  const [min, max] = kind === 'long' ? [90, 3600] : [15, 180];
  durationSec = Math.min(max, Math.max(min, durationSec ?? fallbackDuration));

  return {
    request: raw.trim(),
    topic,
    platform,
    platformLabel: preset.label,
    kind,
    language,
    durationSec,
    width: preset.width,
    height: preset.height,
    aspect: preset.aspect,
    voice: flags.voice,
    theme: flags.theme,
  };
}
