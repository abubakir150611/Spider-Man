import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, type Palette } from '../theme';
import { reveal, riseStyle } from '../components/motion';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

/** Kinetic typography opener: words snap in one by one, accent words glow. */
export const HookScene: React.FC<{ scene: TimelineScene; p: Palette }> = ({ scene, p }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical } = useLayout();
  const headline: string = scene.visual.headline;
  const tokens = headline.split(/\s+/);
  const plain = headline.replace(/\*/g, '');
  const fontSize = fitSize(plain, box.width, (vertical ? 150 : 130) * s, { lines: vertical ? 4 : 2, ratio: 0.55 });
  let accentOpen = false;
  const kickerP = reveal(frame, 0, 10);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36 * s }}>
        {scene.visual.kicker && (
          <div style={{ ...riseStyle(kickerP, 20, 6), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 32 * s, color: p.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {scene.visual.kicker}
            <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>_</span>
          </div>
        )}
        <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize, lineHeight: 1.0, letterSpacing: '-0.035em', color: p.text }}>
          {tokens.map((token, i) => {
            const starts = token.startsWith('*');
            const ends = token.endsWith('*') || token.replace(/[.,!?:;…]+$/, '').endsWith('*');
            if (starts) accentOpen = true;
            const isAccent = accentOpen;
            if (ends) accentOpen = false;
            const pr = reveal(frame, 2 + i * 3, 12);
            const clean = token.replace(/\*/g, '');
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  marginRight: '0.22em',
                  color: isAccent ? p.accent : p.text,
                  textShadow: isAccent ? `0 0 ${40 * s}px ${p.accent}55` : undefined,
                  ...riseStyle(pr, 60 * s, 14),
                  transform: `translateY(${(1 - pr) * 60 * s}px) scale(${0.9 + pr * 0.1})`,
                }}
              >
                {clean}
              </span>
            );
          })}
        </div>
        <div style={{ height: 8 * s, width: `${reveal(frame, 8, 20) * 32}%`, background: p.accent, borderRadius: 8 }} />
      </div>
    </AbsoluteFill>
  );
};
