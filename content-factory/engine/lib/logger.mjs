import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { secretValues } from './env.mjs';

const TELEGRAM_TOKEN_RE = /\d{6,12}:[A-Za-z0-9_-]{30,}/g;

/** Removes anything that looks like a secret from a log line. */
export function redact(input) {
  let text = typeof input === 'string' ? input : safeStringify(input);
  for (const secret of secretValues()) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text.replace(TELEGRAM_TOKEN_RE, '[REDACTED]');
}

function safeStringify(value) {
  if (value instanceof Error) return value.stack || value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const ICONS = { debug: '·', info: '•', warn: '⚠', error: '✖' };

export function createLogger({ file, level = process.env.CF_LOG_LEVEL || 'info', quiet = false } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  if (file) mkdirSync(dirname(file), { recursive: true });

  const write = (lvl, parts) => {
    const message = redact(parts.map((p) => (typeof p === 'string' ? p : safeStringify(p))).join(' '));
    const stamp = new Date().toISOString();
    if (file) appendFileSync(file, `${stamp} [${lvl.toUpperCase()}] ${message}\n`);
    if (quiet || LEVELS[lvl] < threshold) return;
    const line = `${ICONS[lvl]} ${message}`;
    if (lvl === 'error' || lvl === 'warn') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };

  return {
    debug: (...p) => write('debug', p),
    info: (...p) => write('info', p),
    warn: (...p) => write('warn', p),
    error: (...p) => write('error', p),
    step: (name) => write('info', [`── ${name} ──`]),
    child: (childFile) => createLogger({ file: childFile, level, quiet }),
  };
}
