import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, labels, type Palette } from '../theme';
import { reveal, riseStyle } from '../components/motion';
import { Accented, Chip, stripStars } from '../components/ui';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

export const FactScene: React.FC<{ scene: TimelineScene; p: Palette; lang: string }> = ({ scene, p, lang }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical } = useLayout();
  const v = scene.visual;
  const size = fitSize(stripStars(v.text), box.width * 0.92, (vertical ? 84 : 76) * s, { lines: vertical ? 6 : 3, ratio: 0.5 });
  const bar = reveal(frame, 2, 18);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 * s }}>
        <div style={riseStyle(reveal(frame, 0), 20, 6)}>
          <Chip p={p} s={s} accent>{v.label || labels(lang).fact}</Chip>
        </div>
        <div style={{ display: 'flex', gap: 36 * s }}>
          <div style={{ width: 10 * s, borderRadius: 10, background: p.accent, transform: `scaleY(${bar})`, transformOrigin: 'top' }} />
          <div style={{ ...riseStyle(reveal(frame, 6, 16), 30 * s), fontFamily: FONTS.display, fontWeight: 700, fontSize: size, lineHeight: 1.12, letterSpacing: '-0.02em', color: p.text }}>
            <Accented text={v.text} p={p} underline={reveal(frame, 16, 16)} />
          </div>
        </div>
        {v.source && <div style={{ opacity: reveal(frame, 18) * 0.85, fontFamily: FONTS.mono, fontSize: 24 * s, color: p.muted, paddingLeft: 46 * s }}>— {v.source}</div>}
      </div>
    </AbsoluteFill>
  );
};
