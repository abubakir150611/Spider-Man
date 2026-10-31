import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, type Palette } from '../theme';
import { clamp, easeOut, reveal, riseStyle } from '../components/motion';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

/** Animates the first number found in `value` (keeps prefix/suffix such as "$", "k", "%", "+"). */
function countUp(value: string, progress: number, lang: string) {
  const m = value.match(/^(.*?)(\d[\d\s.,]*)(.*)$/);
  if (!m) return value;
  const raw = m[2].replace(/\s/g, '');
  const decimals = /[.,]\d+$/.test(raw) ? raw.split(/[.,]/).pop()!.length : 0;
  const num = Number(raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(num)) return value;
  const current = num * progress;
  const formatted = current.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${m[1]}${formatted}${m[3]}`;
}

export const StatScene: React.FC<{ scene: TimelineScene; p: Palette; lang: string }> = ({ scene, p, lang }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical } = useLayout();
  const v = scene.visual;
  const progress = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: easeOut });
  const size = fitSize(v.value, box.width, (vertical ? 260 : 240) * s, { ratio: 0.6 });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: vertical ? 'flex-start' : 'center', gap: 24 * s }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.045em', color: p.accent, textShadow: `0 0 ${80 * s}px ${p.accent}40`, fontVariantNumeric: 'tabular-nums', transform: `scale(${0.85 + reveal(frame, 0, 18) * 0.15})`, opacity: reveal(frame, 0, 8) }}>
          {countUp(v.value, progress, lang)}
        </div>
        <div style={{ ...riseStyle(reveal(frame, 10, 14), 30 * s), fontFamily: FONTS.display, fontWeight: 700, fontSize: (vertical ? 58 : 54) * s, lineHeight: 1.15, color: p.text, maxWidth: box.width, textAlign: vertical ? 'left' : 'center' }}>{v.label}</div>
        {v.source && <div style={{ opacity: reveal(frame, 20) * 0.8, fontFamily: FONTS.mono, fontSize: 24 * s, color: p.muted }}>{v.source}</div>}
      </div>
    </AbsoluteFill>
  );
};
