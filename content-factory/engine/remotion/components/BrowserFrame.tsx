import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FONTS, type Palette } from '../theme';
import { clamp, easeInOut } from './motion';

/** A browser window that "screen-records" a captured page with a smooth scroll. */
export const BrowserFrame: React.FC<{
  p: Palette;
  s: number;
  width: number;
  height: number;
  src: string;
  imageRatio: number; // image height / width
  domain: string;
  durationInFrames: number;
}> = ({ p, s, width, height, src, imageRatio, domain, durationInFrames }) => {
  const frame = useCurrentFrame();
  const barH = 56 * s;
  const viewH = height - barH;
  const imgH = width * imageRatio;
  const maxScroll = Math.max(0, Math.min(imgH - viewH, viewH * 1.2));
  const scroll = interpolate(frame, [18, Math.max(19, durationInFrames - 12)], [0, maxScroll], { ...clamp, easing: easeInOut });
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.04], clamp);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 22 * s,
        overflow: 'hidden',
        background: p.bg2,
        border: `${2 * s}px solid ${p.line}`,
        boxShadow: `0 ${40 * s}px ${100 * s}px rgba(0,0,0,0.55), 0 0 0 ${1 * s}px rgba(255,255,255,0.04) inset`,
      }}
    >
      <div style={{ height: barH, display: 'flex', alignItems: 'center', gap: 12 * s, padding: `0 ${22 * s}px`, borderBottom: `${1.5 * s}px solid ${p.line}` }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{ width: 16 * s, height: 16 * s, borderRadius: 99, background: c, opacity: 0.9 }} />
        ))}
        <div
          style={{
            marginLeft: 18 * s,
            flex: 1,
            height: 34 * s,
            borderRadius: 10 * s,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${16 * s}px`,
            fontFamily: FONTS.mono,
            fontSize: 21 * s,
            color: p.muted,
            gap: 10 * s,
          }}
        >
          <span style={{ color: p.success }}>●</span> {domain}
        </div>
      </div>
      <div style={{ height: viewH, overflow: 'hidden', position: 'relative' }}>
        <Img src={staticFile(src)} style={{ width, position: 'absolute', top: 0, left: 0, transform: `translateY(${-scroll}px) scale(${zoom})`, transformOrigin: 'top center' }} />
      </div>
    </div>
  );
};

/** A framed static image (e.g. a GitHub social card) with a slow Ken Burns drift. */
export const ImageCard: React.FC<{ p: Palette; s: number; width: number; height: number; src: string; durationInFrames: number }> = ({ p, s, width, height, src, durationInFrames }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.1], clamp);
  return (
    <div style={{ width, height, borderRadius: 22 * s, overflow: 'hidden', border: `${2 * s}px solid ${p.line}`, boxShadow: `0 ${40 * s}px ${100 * s}px rgba(0,0,0,0.55)`, background: p.bg2 }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }} />
    </div>
  );
};
