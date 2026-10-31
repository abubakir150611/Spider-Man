import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, type Palette } from '../theme';
import { reveal, riseStyle } from '../components/motion';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

export const BulletsScene: React.FC<{ scene: TimelineScene; p: Palette }> = ({ scene, p }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical, fps } = useLayout();
  const v = scene.visual;
  const items: string[] = v.items;
  const titleSize = fitSize(v.title, box.width, (vertical ? 88 : 80) * s, { lines: 2 });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 * s }}>
        <div style={{ ...riseStyle(reveal(frame, 0, 14), 40 * s), fontFamily: FONTS.display, fontWeight: 900, fontSize: titleSize, lineHeight: 1.02, letterSpacing: '-0.03em', color: p.text }}>{v.title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: vertical || items.length < 4 ? '1fr' : '1fr 1fr', gap: `${22 * s}px ${40 * s}px` }}>
          {items.map((item, i) => {
            const pr = reveal(frame, Math.round((0.6 + i * 0.45) * fps), 12);
            return (
              <div key={i} style={{ ...riseStyle(pr, 30 * s, 8), display: 'flex', alignItems: 'center', gap: 22 * s, padding: `${20 * s}px ${26 * s}px`, borderRadius: 18 * s, background: p.surface, border: `${1.5 * s}px solid ${p.line}` }}>
                <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30 * s, color: p.accent, minWidth: 48 * s }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: FONTS.text, fontWeight: 500, fontSize: (vertical ? 40 : 36) * s, color: p.text, lineHeight: 1.25 }}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
