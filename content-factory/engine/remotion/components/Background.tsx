import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Palette } from '../theme';

/** Living, restrained backdrop: drifting light, fine grid, film grain and vignette. */
export const Background: React.FC<{ p: Palette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;
  const orbX = 50 + Math.sin(t * 0.21) * 18;
  const orbY = 30 + Math.cos(t * 0.17) * 12;
  const orb2X = 70 + Math.cos(t * 0.13) * 20;
  const orb2Y = 80 + Math.sin(t * 0.19) * 10;
  const cell = Math.round(Math.min(width, height) / 14);
  const grainSeed = Math.floor(frame / 2) % 50;
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${orbX}% ${orbY}%, ${p.accent}26 0%, transparent 42%), radial-gradient(circle at ${orb2X}% ${orb2Y}%, ${p.accent2}17 0%, transparent 38%), linear-gradient(180deg, ${p.bg2} 0%, ${p.bg} 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${p.line} 1px, transparent 1px), linear-gradient(90deg, ${p.line} 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${(frame * 0.25) % cell}px ${(frame * 0.4) % cell}px`,
          opacity: 0.35,
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 10%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 10%, transparent 75%)',
        }}
      />
      <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: 'overlay' }}>
        <svg width={width} height={height}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={grainSeed} stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};
