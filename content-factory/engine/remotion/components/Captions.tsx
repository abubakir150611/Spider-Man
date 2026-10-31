import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Cue } from '../types';
import { FONTS, type Palette } from '../theme';
import { clamp } from './motion';

/** Karaoke-style captions: active word lights up in the accent colour. */
export const Captions: React.FC<{ cues: Cue[]; p: Palette; vertical: boolean }> = ({ cues, p, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.start - 0.05 && t < c.end + 0.05);
  if (!cue) return null;
  const s = Math.min(width, height) / 1080;
  const appear = spring({ frame: frame - Math.round(cue.start * fps), fps, config: { damping: 16, stiffness: 220, mass: 0.6 } });
  const fontSize = (vertical ? 74 : 58) * s;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: vertical ? height * 0.655 : undefined,
          bottom: vertical ? undefined : height * 0.075,
          width: width * (vertical ? 0.86 : 0.8),
          textAlign: 'center',
          fontFamily: FONTS.display,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.12,
          letterSpacing: '-0.01em',
          color: p.text,
          transform: `translateY(${(1 - appear) * 18 * s}px) scale(${0.94 + appear * 0.06})`,
          opacity: interpolate(appear, [0, 0.4], [0, 1], clamp),
          textShadow: '0 4px 24px rgba(0,0,0,0.75), 0 2px 4px rgba(0,0,0,0.9)',
          WebkitTextStroke: `${2 * s}px rgba(0,0,0,0.35)`,
          paintOrder: 'stroke fill',
        }}
      >
        {cue.words.map((w, i) => {
          const spoken = t >= w.start - 0.03;
          const next = cue.words[i + 1];
          const active = spoken && (!next || t < next.start - 0.03);
          return (
            <React.Fragment key={i}>
            <span
              style={{
                display: 'inline-block',
                margin: '0 0.15em',
                color: active ? p.accent : spoken ? p.text : 'rgba(243,244,246,0.72)',
                transform: active ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              {w.text}
            </span>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
