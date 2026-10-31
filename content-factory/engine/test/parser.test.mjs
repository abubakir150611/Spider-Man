import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, parseDuration, parseRequest } from '../lib/request-parser.mjs';
import { slugify } from '../lib/slug.mjs';

test('defaults to vertical shorts when no platform is given', () => {
  const b = parseRequest('5 полезных скиллов для Claude Code');
  assert.equal(b.platform, 'shorts');
  assert.equal(b.width, 1080);
  assert.equal(b.height, 1920);
  assert.equal(b.language, 'ru');
  assert.equal(b.durationSec, 45);
  assert.equal(b.topic, '5 полезных скиллов для Claude Code');
});

test('recognises "YouTube long:" prefix as horizontal long-form', () => {
  const b = parseRequest('YouTube long: Полный обзор возможностей Claude Code');
  assert.equal(b.platform, 'youtube');
  assert.equal(b.kind, 'long');
  assert.equal(b.width, 1920);
  assert.equal(b.durationSec, 480);
  assert.equal(b.topic, 'Полный обзор возможностей Claude Code');
});

test('supports flags and inline duration/language', () => {
  const b = parseRequest('Shorts: 5 repos --lang en --duration 1m');
  assert.equal(b.language, 'en');
  assert.equal(b.durationSec, 60);
  const c = parseRequest('Как выучить React за 7 минут, 30 сек');
  assert.equal(c.durationSec, 30);
  assert.equal(c.topic, 'Как выучить React за 7 минут');
  const d = parseRequest('TikTok: AI tools (на английском)');
  assert.equal(d.platform, 'tiktok');
  assert.equal(d.language, 'en');
  const r = parseRequest('Reels: тема --platform youtube');
  assert.equal(r.platform, 'youtube');
});

test('clamps durations and rejects invalid input', () => {
  assert.equal(parseRequest('тема --duration 5s').durationSec, 15);
  assert.throws(() => parseRequest('   '), /Пустой запрос/);
  assert.throws(() => parseRequest('тема --lang de'), /Неподдерживаемый язык/);
  assert.throws(() => parseRequest('тема --platform vk'), /Неизвестная платформа/);
  assert.throws(() => parseDuration('abc'), /Не удалось/);
  assert.throws(() => parseDuration('5 parsecs'), /Неизвестная единица/);
});

test('detects Kyrgyz by specific letters and English by Latin script', () => {
  assert.equal(detectLanguage('Жасалма интеллект деген эмне? Үйрөнөбүз'), 'ky');
  assert.equal(detectLanguage('Best GitHub repos'), 'en');
  assert.equal(parseRequest('кыргызча: AI куралдары').language, 'ky');
});

test('slugify transliterates Cyrillic', () => {
  assert.equal(slugify('Топ-7 AI-инструментов'), 'top-7-ai-instrumentov');
  assert.equal(slugify('!!!'), 'video');
});
