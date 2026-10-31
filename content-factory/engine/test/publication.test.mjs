import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatTimestamp, socialCaption, splitMessage, telegramCaption, telegramPost, youtubeChapters, youtubeDescription } from '../lib/publication.mjs';
import { publication } from './fixtures.mjs';

const pub = { ...publication };

test('telegram post escapes HTML and includes links, commands and sources', () => {
  const html = telegramPost(pub, { language: 'ru' });
  assert.match(html, /Иконки &lt;для&gt; &amp; разработчиков/);
  assert.match(html, /<a href="https:\/\/lucide.dev">Сайт<\/a>/);
  assert.match(html, /<code>npm install lucide-react<\/code>/);
  assert.match(html, /Источники/);
  assert.match(html, /#icons #dev/);
  assert.equal(escapeHtml('"<&>"'), '&quot;&lt;&amp;&gt;&quot;');
});

test('caption fits the 1024 limit', () => {
  const long = { ...pub, shortDescription: 'x'.repeat(2000) };
  assert.ok(telegramCaption(long).length <= 1024);
  assert.ok(telegramCaption(pub).includes('<b>'));
});

test('long messages are split at line boundaries', () => {
  const text = Array.from({ length: 400 }, (_, i) => `<b>line ${i}</b> ${'y'.repeat(20)}`).join('\n');
  const parts = splitMessage(text, 4096);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 4096);
  assert.equal(parts.join('\n'), text);
  assert.deepEqual(splitMessage('short'), ['short']);
  const huge = splitMessage('z'.repeat(9000), 4096);
  assert.ok(huge.every((p) => p.length <= 4096));
});

test('youtube chapters start at 0:00, are 10s apart and need 3+', () => {
  const ch = youtubeChapters([{ title: 'A', startSec: 3 }, { title: 'B', startSec: 8 }, { title: 'C', startSec: 30 }, { title: 'D', startSec: 75 }]);
  assert.deepEqual(ch.map((c) => c.title), ['A', 'C', 'D']);
  assert.equal(ch[0].startSec, 0);
  assert.deepEqual(youtubeChapters([{ title: 'A', startSec: 0 }]), []);
  assert.equal(formatTimestamp(3725), '1:02:05');
  const desc = youtubeDescription(pub, { language: 'en', chapters: [{ title: 'Intro', startSec: 0 }, { title: 'Setup', startSec: 20 }, { title: 'End', startSec: 60 }] });
  assert.match(desc, /0:00 Intro/);
  assert.match(desc, /Install: npm install lucide-react/);
  assert.ok(socialCaption(pub).length <= 2200);
});
