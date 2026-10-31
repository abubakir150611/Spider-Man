#!/usr/bin/env node
// Downloads Remotion's Chrome Headless Shell ahead of the first render (used by install.mjs).
import { ensureBrowser } from '@remotion/renderer';
import { enableSystemCA } from '../lib/system-ca.mjs';
import { findBrowser } from '../lib/browser.mjs';

enableSystemCA();
if (findBrowser({ purpose: 'render' })) {
  process.stdout.write('• Chrome Headless Shell уже есть\n');
} else {
  process.stdout.write('• Скачиваю Chrome Headless Shell для рендера (~100 МБ)...\n');
  const status = await ensureBrowser();
  process.stdout.write(`• Браузер для рендера готов: ${status.path || status.type}\n`);
}
