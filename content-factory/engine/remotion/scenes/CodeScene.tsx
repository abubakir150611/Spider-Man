import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, type Palette } from '../theme';
import { reveal, riseStyle } from '../components/motion';
import { useLayout } from './common';
import type { Timeline, TimelineScene } from '../types';

function highlight(line: string, p: Palette) {
  if (line.trim().startsWith('#')) return [<span key="c" style={{ color: p.muted }}>{line}</span>];
  const tokens = line.split(/(\s+|"[^"]*"|'[^']*')/g).filter((t) => t !== '');
  let first = true;
  return tokens.map((t, i) => {
    if (/^\s+$/.test(t)) return <span key={i}>{t}</span>;
    let color = p.text;
    if (first) {
      color = p.accent;
      first = false;
    } else if (/^-{1,2}[\w-]+/.test(t)) color = p.accent2;
    else if (/^["']/.test(t)) color = '#FBBF77';
    else if (/^(&&|\||>|\\)$/.test(t)) {
      color = p.muted;
      first = t === '&&' || t === '|';
    }
    return <span key={i} style={{ color }}>{t}</span>;
  });
}

/** Terminal window with a real-time typed command and its output. */
export const CodeScene: React.FC<{ scene: TimelineScene; p: Palette; typing: Timeline['typing'] }> = ({ scene, p, typing }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical, fps } = useLayout();
  const v = scene.visual;
  const lines: string[] = v.lines;
  const output: string[] = v.output ?? [];
  const t = frame / fps;
  let cursorT = typing.startSec;
  const typed = lines.map((line) => {
    const start = cursorT;
    const dur = line.length / typing.charsPerSec;
    cursorT += dur + typing.lineGapSec;
    const chars = Math.max(0, Math.min(line.length, Math.floor((t - start) * typing.charsPerSec)));
    return { line, chars, started: t >= start, done: chars >= line.length };
  });
  const typingDone = t >= cursorT;
  const activeLine = typed.findIndex((l) => l.started && !l.done);
  const winW = vertical ? box.width : box.width * 0.78;
  const fontSize = (vertical ? 40 : 34) * s;
  const enter = reveal(frame, 0, 14);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: vertical ? 'stretch' : 'center', gap: 34 * s }}>
        {v.title && (
          <div style={{ ...riseStyle(enter, 30 * s), fontFamily: FONTS.display, fontWeight: 900, fontSize: (vertical ? 76 : 70) * s, letterSpacing: '-0.025em', color: p.text, width: winW }}>
            {v.title}
          </div>
        )}
        <div
          style={{
            ...riseStyle(reveal(frame, 3, 16), 50 * s),
            width: winW,
            borderRadius: 22 * s,
            background: 'rgba(8,9,12,0.86)',
            border: `${2 * s}px solid ${p.line}`,
            boxShadow: `0 ${40 * s}px ${110 * s}px rgba(0,0,0,0.6), 0 0 ${80 * s}px ${p.accent}14`,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 58 * s, display: 'flex', alignItems: 'center', gap: 12 * s, padding: `0 ${24 * s}px`, borderBottom: `${1.5 * s}px solid ${p.line}` }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div key={c} style={{ width: 16 * s, height: 16 * s, borderRadius: 99, background: c }} />
            ))}
            <span style={{ marginLeft: 16 * s, fontFamily: FONTS.mono, fontSize: 22 * s, color: p.muted }}>{v.language === 'bash' || !v.language ? 'terminal' : v.language}</span>
          </div>
          <div style={{ padding: `${30 * s}px ${32 * s}px ${36 * s}px`, fontFamily: FONTS.mono, fontSize, lineHeight: 1.6, color: p.text, display: 'flex', flexDirection: 'column', gap: 4 * s }}>
            {typed.map((l, i) =>
              l.started ? (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <span style={{ color: p.success }}>{'❯ '}</span>
                  {highlight(l.line.slice(0, l.chars), p)}
                  {(i === activeLine || (typingDone && i === typed.length - 1 && !output.length)) && (
                    <span style={{ display: 'inline-block', width: fontSize * 0.55, height: fontSize * 1.05, background: p.accent, verticalAlign: 'text-bottom', marginLeft: 2, opacity: Math.floor(frame / 9) % 2 ? 0.2 : 1 }} />
                  )}
                </div>
              ) : null,
            )}
            {typingDone &&
              output.map((o, i) => {
                const pr = reveal(frame, Math.round(cursorT * fps) + i * 9, 10);
                return (
                  <div key={`o${i}`} style={{ ...riseStyle(pr, 10 * s, 3), color: /^(✓|✔|done|ok)/i.test(o) ? p.success : p.muted }}>
                    {o}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
