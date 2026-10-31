#!/usr/bin/env node
// Regenerates the repository copy of the /create-video skill from content-factory/skill/SKILL.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FACTORY_ROOT } from '../lib/paths.mjs';
import { REPO_SKILL, renderSkill } from '../lib/skill.mjs';

const dir = join(FACTORY_ROOT, '..', '.claude', 'skills', 'create-video');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'SKILL.md'), renderSkill(REPO_SKILL));
console.log(`✔ ${join(dir, 'SKILL.md')}`);
