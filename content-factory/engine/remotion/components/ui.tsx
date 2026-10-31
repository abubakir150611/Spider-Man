import React from 'react';
import { FONTS, type Palette } from '../theme';

/** Renders text where *starred* fragments are highlighted with the accent colour. */
export const Accented: React.FC<{ text: string; p: Palette; underline?: number }> = ({ text, p, underline = 1 }) => {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('*') ? (
          <span key={i} style={{ color: p.accent, position: 'relative', whiteSpace: 'nowrap' }}>
            {part.slice(1, -1)}
            <span
              style={{
                position: 'absolute',
                left: 0,
                bottom: '0.04em',
                height: '0.09em',
                width: `${underline * 100}%`,
                background: p.accent,
                opacity: 0.35,
                borderRadius: 4,
              }}
            />
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

export const stripStars = (text: string) => text.replace(/\*/g, '');

export const Chip: React.FC<{ p: Palette; s: number; children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }> = ({ p, s, children, accent, style }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12 * s,
      padding: `${10 * s}px ${22 * s}px`,
      borderRadius: 999,
      border: `${2 * s}px solid ${accent ? p.accent : p.line}`,
      background: accent ? `${p.accent}1A` : p.surface,
      color: accent ? p.accent : p.text,
      fontFamily: FONTS.mono,
      fontWeight: 700,
      fontSize: 28 * s,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

export const GlobeIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5S9.4 5.3 12 2.5z" />
  </svg>
);

export const GithubIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 .5A11.5 11.5 0 0 0 8.4 22.9c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

export const CheckIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const BellIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
