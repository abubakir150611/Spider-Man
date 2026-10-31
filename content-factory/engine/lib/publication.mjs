import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const L = {
  ru: { points: 'Главное', tools: 'Инструменты и ссылки', site: 'Сайт', docs: 'Документация', install: 'Установка', sources: 'Источники', chapters: 'Таймкоды', tags: 'Теги' },
  en: { points: 'Key points', tools: 'Tools & links', site: 'Website', docs: 'Docs', install: 'Install', sources: 'Sources', chapters: 'Chapters', tags: 'Tags' },
  ky: { points: 'Негизгиси', tools: 'Куралдар жана шилтемелер', site: 'Сайт', docs: 'Документация', install: 'Орнотуу', sources: 'Булактар', chapters: 'Убакыт белгилери', tags: 'Тегдер' },
};

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function formatTimestamp(sec) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function linkLine(link, labels, html) {
  const parts = [];
  if (link.website) parts.push(html ? `<a href="${escapeHtml(link.website)}">${labels.site}</a>` : `${labels.site}: ${link.website}`);
  if (link.github) parts.push(html ? `<a href="${escapeHtml(link.github)}">GitHub</a>` : `GitHub: ${link.github}`);
  if (link.docs) parts.push(html ? `<a href="${escapeHtml(link.docs)}">${labels.docs}</a>` : `${labels.docs}: ${link.docs}`);
  return parts;
}

/** YouTube chapters must start at 0:00 and be at least 10 s apart. */
export function youtubeChapters(chapters) {
  if (!chapters?.length) return [];
  const list = [...chapters].sort((a, b) => a.startSec - b.startSec);
  if (list[0].startSec > 0) list[0] = { ...list[0], startSec: 0 };
  const out = [];
  for (const c of list) if (!out.length || c.startSec - out.at(-1).startSec >= 10) out.push(c);
  return out.length >= 3 ? out : [];
}

/** Telegram post body (HTML parse mode). */
export function telegramPost(pub, { language = 'ru' } = {}) {
  const l = L[language] || L.en;
  const lines = [`<b>${escapeHtml(pub.title)}</b>`, '', escapeHtml(pub.shortDescription), ''];
  lines.push(`<b>${l.points}:</b>`);
  for (const p of pub.keyPoints) lines.push(`• ${escapeHtml(p)}`);
  if (pub.links.length) {
    lines.push('', `<b>${l.tools}:</b>`);
    pub.links.forEach((link, i) => {
      lines.push(`${i + 1}. <b>${escapeHtml(link.name)}</b>${link.description ? ` — ${escapeHtml(link.description)}` : ''}`);
      const parts = linkLine(link, l, true);
      if (parts.length) lines.push(`   ${parts.join(' · ')}`);
      for (const cmd of link.install) lines.push(`   <code>${escapeHtml(cmd)}</code>`);
    });
  }
  lines.push('', `<b>${l.sources}:</b>`);
  for (const s of pub.sources) lines.push(`— <a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a>`);
  lines.push('', escapeHtml(pub.cta), '', pub.hashtags.join(' '));
  return lines.join('\n');
}

/** Short caption that goes with the video itself (≤1024 chars). */
export function telegramCaption(pub, limit = 1024) {
  const tags = pub.hashtags.slice(0, 6).join(' ');
  let body = `<b>${escapeHtml(pub.title)}</b>\n\n${escapeHtml(pub.shortDescription)}\n\n${tags}`;
  if (body.length > limit) body = `<b>${escapeHtml(pub.title).slice(0, limit - 40)}</b>\n\n${tags}`.slice(0, limit);
  return body;
}

/**
 * Splits a long HTML message into chunks ≤ limit at line boundaries, never
 * inside a tag-bearing line.
 */
export function splitMessage(text, limit = 4096) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (line.length > limit) {
      if (current) chunks.push(current);
      current = '';
      const plain = line.replace(/<[^>]+>/g, '');
      for (let i = 0; i < plain.length; i += limit) chunks.push(plain.slice(i, i + limit));
      continue;
    }
    const next = current ? `${current}\n${line}` : line;
    if (next.length > limit) {
      chunks.push(current);
      current = line;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function youtubeDescription(pub, { language = 'ru', chapters = [] } = {}) {
  const l = L[language] || L.en;
  const out = [pub.longDescription, ''];
  const ch = youtubeChapters(chapters);
  if (ch.length) {
    out.push(`${l.chapters}:`);
    for (const c of ch) out.push(`${formatTimestamp(c.startSec)} ${c.title}`);
    out.push('');
  }
  if (pub.links.length) {
    out.push(`${l.tools}:`);
    for (const link of pub.links) {
      out.push(`▸ ${link.name}${link.description ? ` — ${link.description}` : ''}`);
      for (const p of linkLine(link, l, false)) out.push(`   ${p}`);
      for (const cmd of link.install) out.push(`   ${l.install}: ${cmd}`);
    }
    out.push('');
  }
  out.push(`${l.sources}:`);
  for (const s of pub.sources) out.push(`— ${s.title}: ${s.url}`);
  out.push('', pub.cta, '', pub.hashtags.slice(0, 15).join(' '));
  return out.join('\n');
}

export function socialCaption(pub, { maxTags = 8, limit = 2200 } = {}) {
  const links = pub.links.map((l) => `▸ ${l.name}: ${l.website || l.github || ''}`.trim()).join('\n');
  const text = `${pub.title}\n\n${pub.shortDescription}\n\n${pub.keyPoints.map((p) => `• ${p}`).join('\n')}\n\n${links}\n\n${pub.cta}\n\n${pub.hashtags.slice(0, maxTags).join(' ')}`;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Writes all platform-ready publication files for a project. */
export function writePublicationFiles({ files, pub, timeline, research, validation }) {
  const dir = join(files.dir, 'publications');
  const language = timeline.language;
  const tgPost = telegramPost(pub, { language });
  writeFileSync(join(dir, 'telegram-post.html'), tgPost);
  writeFileSync(join(dir, 'telegram-caption.html'), telegramCaption(pub));
  const yt = youtubeDescription(pub, { language, chapters: timeline.chapters });
  const shortForm = socialCaption(pub);
  const md = [
    `# ${pub.title}`,
    '',
    `**Платформа:** ${timeline.platform} · **Длительность:** ${formatTimestamp(timeline.durationSec)} · **Формат:** ${timeline.width}×${timeline.height}`,
    '',
    '## Краткое описание',
    pub.shortDescription,
    '',
    '## Подробное описание (YouTube)',
    '```',
    yt,
    '```',
    '',
    '## Подпись для Reels / TikTok / Shorts',
    '```',
    shortForm,
    '```',
    '',
    '## Хештеги',
    pub.hashtags.join(' '),
    '',
    '## Ключевые слова / теги',
    pub.keywords.join(', '),
    '',
    '## Ссылки',
    ...pub.links.flatMap((l) => [`- **${l.name}**${l.description ? ` — ${l.description}` : ''}`, ...[l.website, l.github, l.docs].filter(Boolean).map((u) => `  - ${u}`), ...l.install.map((c) => `  - \`${c}\``)]),
    '',
    '## Источники',
    ...pub.sources.map((s) => `- [${s.title}](${s.url})`),
    '',
    `_Исследование: ${research.researchedAt}. Проверка видео: ${validation?.ok ? 'пройдена' : 'есть замечания'}._`,
  ].join('\n');
  writeFileSync(join(dir, 'publication.md'), md);
  writeFileSync(join(dir, 'youtube-description.txt'), yt);
  writeFileSync(join(dir, 'social-caption.txt'), shortForm);
  writeFileSync(join(dir, 'sources.md'), research.sources.map((s) => `- [${s.title}](${s.url})`).join('\n') + '\n');
  return { telegramPost: tgPost, youtube: yt, social: shortForm };
}
