export type Palette = {
  bg: string;
  bg2: string;
  surface: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  onAccent: string;
  success: string;
};

const base = { surface: 'rgba(255,255,255,0.045)', line: 'rgba(255,255,255,0.09)', text: '#F3F4F6', muted: '#8E95A3', success: '#4ADE80' };

export const PALETTES: Record<string, Palette> = {
  'graphite-lime': { ...base, bg: '#0B0C0E', bg2: '#15171B', accent: '#C8F135', accent2: '#5EEAD4', onAccent: '#0B0C0E' },
  'midnight-cyan': { ...base, bg: '#050A13', bg2: '#0C1524', accent: '#2EE6D6', accent2: '#5B8CFF', onAccent: '#04121A' },
  ember: { ...base, bg: '#0F0A08', bg2: '#1B1310', accent: '#FF6B35', accent2: '#FFC24B', onAccent: '#140A05' },
  ice: { ...base, bg: '#090C11', bg2: '#111723', accent: '#8AB4FF', accent2: '#D6E4FF', onAccent: '#08101F' },
  'mono-red': { ...base, bg: '#0A0A0A', bg2: '#151515', accent: '#FF3B30', accent2: '#FFFFFF', onAccent: '#FFFFFF' },
  'violet-noir': { ...base, bg: '#0B0912', bg2: '#151020', accent: '#A78BFA', accent2: '#F472B6', onAccent: '#0B0912' },
};

export const palette = (name: string): Palette => PALETTES[name] ?? PALETTES['graphite-lime'];

export const FONTS = {
  display: 'Inter',
  text: 'Inter',
  mono: 'JetBrains Mono',
};

const LABELS = {
  ru: { fact: 'Факт', links: 'Ссылки — в описании', install: 'Установка', site: 'Сайт', subscribe: 'Подписаться', of: 'из' },
  en: { fact: 'Fact', links: 'Links in the description', install: 'Install', site: 'Website', subscribe: 'Subscribe', of: 'of' },
  ky: { fact: 'Факт', links: 'Шилтемелер — сүрөттөмөдө', install: 'Орнотуу', site: 'Сайт', subscribe: 'Жазылуу', of: '/' },
};

export const labels = (lang: string) => LABELS[lang as keyof typeof LABELS] ?? LABELS.en;

/** Rough text-fitting: picks a font size so `text` fits `maxWidth` on `lines` lines. */
export function fitSize(text: string, maxWidth: number, maxSize: number, { ratio = 0.56, lines = 1, min = 24 } = {}) {
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  const perLine = Math.max(longestWord, Math.ceil(text.length / lines));
  return Math.max(min, Math.min(maxSize, maxWidth / (perLine * ratio)));
}

export function domainOf(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function repoOf(url?: string) {
  if (!url) return '';
  const m = url.match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1].replace(/\.git$/, '') : domainOf(url);
}
