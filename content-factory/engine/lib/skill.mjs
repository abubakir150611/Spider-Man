import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FACTORY_ROOT } from './paths.mjs';

export const SKILL_TEMPLATE = join(FACTORY_ROOT, 'skill', 'SKILL.md');

const quote = (p) => (/\s/.test(p) ? `"${p}"` : p);

/** Forward slashes work in Git Bash (used by Claude Code on Windows), cmd, PowerShell and Node. */
export const toPortable = (p) => p.replace(/\\/g, '/');

/**
 * Renders the /create-video skill for a concrete installation.
 * `cliCommand` is how Claude must invoke the CLI, e.g. `node /home/me/.ai-content-factory/engine/bin/cf.mjs`.
 */
export function renderSkill({ cliCommand, factoryHome, template = readFileSync(SKILL_TEMPLATE, 'utf8') }) {
  return template.replaceAll('{{CF}}', cliCommand).replaceAll('{{CF_HOME}}', toPortable(factoryHome));
}

export function cliCommandFor(factoryHome) {
  return `node ${quote(toPortable(join(factoryHome, 'engine', 'bin', 'cf.mjs')))}`;
}

/** The copy committed to this repository (works without a global install). */
export const REPO_SKILL = { cliCommand: 'node content-factory/engine/bin/cf.mjs', factoryHome: 'content-factory' };
