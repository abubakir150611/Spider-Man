import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { FONTS, fitSize, labels, type Palette } from '../theme';
import { pop, reveal, riseStyle } from '../components/motion';
import { Accented, BellIcon, stripStars } from '../components/ui';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

export const OutroScene: React.FC<{ scene: TimelineScene; p: Palette; lang: string }> = ({ scene, p, lang }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical, fps } = useLayout();
  const v = scene.visual;
  const L = labels(lang);
  const size = fitSize(stripStars(v.headline), box.width, (vertical ? 110 : 100) * s, { lines: 3 });
  const btn = pop(frame, fps, 14, 11);
  const pulse = 1 + Math.sin(frame / 6) * 0.025 * Math.min(1, Math.max(0, (frame - 30) / 10));
  const ring = interpolate((frame - 24) % 36, [0, 36], [0, 1]);
  const bellSwing = Math.sin(frame / 3) * 14 * Math.exp(-Math.max(0, frame - 20) / 25) * (frame > 20 ? 1 : 0);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: vertical ? 'flex-start' : 'center', textAlign: vertical ? 'left' : 'center', gap: 48 * s }}>
        <div style={{ ...riseStyle(reveal(frame, 0, 16), 40 * s), fontFamily: FONTS.display, fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.03em', color: p.text }}>
          <Accented text={v.headline} p={p} underline={reveal(frame, 12, 16)} />
        </div>
        <div style={{ position: 'relative', transform: `scale(${btn * pulse})`, transformOrigin: vertical ? 'left center' : 'center' }}>
          {frame > 24 && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `${3 * s}px solid ${p.accent}`, transform: `scale(${1 + ring * 0.25})`, opacity: 1 - ring }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 * s, padding: `${26 * s}px ${48 * s}px`, borderRadius: 999, background: p.accent, color: p.onAccent, fontFamily: FONTS.display, fontWeight: 900, fontSize: (vertical ? 52 : 46) * s }}>
            <span style={{ display: 'inline-flex', transform: `rotate(${bellSwing}deg)`, transformOrigin: 'top center' }}>
              <BellIcon size={50 * s} color={p.onAccent} />
            </span>
            {v.cta || L.subscribe}
          </div>
        </div>
        <div style={{ ...riseStyle(reveal(frame, 26, 14), 20 * s), fontFamily: FONTS.mono, fontSize: 28 * s, color: p.muted, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
          {v.handle && <span style={{ color: p.text, fontWeight: 700 }}>{v.handle}</span>}
          <span>↓ {L.links}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
