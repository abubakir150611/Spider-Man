import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, type Palette } from '../theme';
import { reveal, riseStyle } from '../components/motion';
import { Accented, Chip, stripStars } from '../components/ui';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

export const TitleScene: React.FC<{ scene: TimelineScene; p: Palette }> = ({ scene, p }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical } = useLayout();
  const { title, subtitle, label } = scene.visual;
  const fontSize = fitSize(stripStars(title), box.width, (vertical ? 120 : 112) * s, { lines: vertical ? 4 : 2 });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 * s }}>
        {label && (
          <div style={riseStyle(reveal(frame, 0), 20, 6)}>
            <Chip p={p} s={s} accent>{label}</Chip>
          </div>
        )}
        <div style={{ ...riseStyle(reveal(frame, 4, 16), 50 * s), fontFamily: FONTS.display, fontWeight: 900, fontSize, lineHeight: 1.02, letterSpacing: '-0.03em', color: p.text }}>
          <Accented text={title} p={p} underline={reveal(frame, 14, 18)} />
        </div>
        {subtitle && (
          <div style={{ ...riseStyle(reveal(frame, 12, 16), 30 * s), fontFamily: FONTS.text, fontWeight: 500, fontSize: (vertical ? 44 : 40) * s, lineHeight: 1.35, color: p.muted, maxWidth: box.width * 0.92 }}>
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
