import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { FONTS, domainOf, fitSize, repoOf, type Palette } from '../theme';
import { pop, reveal, riseStyle } from '../components/motion';
import { BrowserFrame, ImageCard } from '../components/BrowserFrame';
import { CheckIcon, Chip, GithubIcon, GlobeIcon } from '../components/ui';
import { useLayout } from './common';
import type { TimelineScene } from '../types';

/** A tool / repo / product card: index, name, tagline, media, links and install command. */
export const ItemScene: React.FC<{ scene: TimelineScene; p: Palette }> = ({ scene, p }) => {
  const frame = useCurrentFrame();
  const { s, box, vertical, fps } = useLayout();
  const v = scene.visual;
  const idx = String(v.index).padStart(2, '0');
  const total = v.total ? String(v.total).padStart(2, '0') : null;
  const hasShot = Boolean(v.screenshotSrc);
  const hasImage = !hasShot && Boolean(v.imageSrc);
  const hasMedia = hasShot || hasImage;

  const textWidth = vertical ? box.width : hasMedia ? box.width * 0.44 : box.width * 0.9;
  const big = vertical && !hasMedia;
  const nameSize = fitSize(v.name, textWidth, (big ? 150 : vertical ? 118 : 104) * s, { lines: 2, ratio: 0.58 });
  const indexPop = pop(frame, fps, 0, 12);

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 * s }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 * s }}>
        <span
          style={{
            fontFamily: FONTS.display,
            fontWeight: 900,
            fontSize: (vertical ? 120 : 110) * s,
            lineHeight: 0.9,
            color: 'transparent',
            WebkitTextStroke: `${3 * s}px ${p.accent}`,
            transform: `scale(${0.6 + indexPop * 0.4})`,
            transformOrigin: 'left bottom',
            display: 'inline-block',
            opacity: indexPop,
          }}
        >
          {idx}
        </span>
        {total && <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30 * s, color: p.muted, opacity: reveal(frame, 6) }}>/ {total}</span>}
        {v.badge && (
          <span style={{ marginLeft: 'auto', opacity: reveal(frame, 10) }}>
            <Chip p={p} s={s} accent>{v.badge}</Chip>
          </span>
        )}
      </div>
      <div style={{ ...riseStyle(reveal(frame, 4, 14), 40 * s), fontFamily: FONTS.display, fontWeight: 900, fontSize: nameSize, lineHeight: 0.98, letterSpacing: '-0.03em', color: p.text }}>{v.name}</div>
      <div style={{ ...riseStyle(reveal(frame, 9, 14), 24 * s), fontFamily: FONTS.text, fontWeight: 500, fontSize: (big ? 48 : vertical ? 40 : 36) * s, lineHeight: 1.3, color: p.muted }}>{v.tagline}</div>
    </div>
  );

  const links = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 * s, opacity: reveal(frame, 16) }}>
      {v.website && (
        <Chip p={p} s={s}>
          <GlobeIcon size={26 * s} color={p.accent} />
          {domainOf(v.website)}
        </Chip>
      )}
      {v.github && (
        <Chip p={p} s={s}>
          <GithubIcon size={26 * s} color={p.text} />
          {repoOf(v.github)}
        </Chip>
      )}
    </div>
  );

  const bullets = (v.bullets as string[]).length > 0 && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 * s }}>
      {(v.bullets as string[]).slice(0, hasMedia && vertical ? 2 : 4).map((b, i) => {
        const pr = reveal(frame, 14 + i * 6, 12);
        return (
          <div key={i} style={{ ...riseStyle(pr, 20 * s, 6), display: 'flex', alignItems: 'center', gap: 16 * s, fontFamily: FONTS.text, fontWeight: 500, fontSize: (big ? 42 : vertical ? 36 : 32) * s, color: p.text }}>
            <span style={{ width: 44 * s, height: 44 * s, borderRadius: 12 * s, background: `${p.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckIcon size={26 * s} color={p.accent} />
            </span>
            {b}
          </div>
        );
      })}
    </div>
  );

  const command = v.command && (
    <div
      style={{
        ...riseStyle(reveal(frame, 20, 12), 16 * s, 4),
        fontFamily: FONTS.mono,
        fontSize: (vertical ? 28 : 26) * s,
        color: p.text,
        background: 'rgba(0,0,0,0.45)',
        border: `${1.5 * s}px solid ${p.line}`,
        borderRadius: 14 * s,
        padding: `${14 * s}px ${20 * s}px`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span style={{ color: p.accent }}>$ </span>
      {v.command}
    </div>
  );

  const mediaW = vertical ? box.width : box.width * 0.5;
  const mediaH = vertical ? box.width * 0.58 : box.height * 0.86;
  const mediaP = reveal(frame, 8, 18);
  const media = hasMedia && (
    <div style={{ opacity: mediaP, transform: `translateY(${(1 - mediaP) * 60 * s}px) rotate(${(1 - mediaP) * (vertical ? 0 : -2)}deg)` }}>
      {hasShot ? (
        <BrowserFrame p={p} s={s} width={mediaW} height={mediaH} src={v.screenshotSrc} imageRatio={v.screenshotRatio ?? 1.6} domain={domainOf(v.website)} durationInFrames={scene.durationInFrames} />
      ) : (
        <ImageCard p={p} s={s} width={mediaW} height={vertical ? mediaW / 2 : mediaW / 2} src={v.imageSrc} durationInFrames={scene.durationInFrames} />
      )}
    </div>
  );

  if (vertical) {
    return (
      <AbsoluteFill>
        {big && (
          <div style={{ position: 'absolute', right: box.left * 0.4, top: box.top + box.height * 0.42, fontFamily: FONTS.display, fontWeight: 900, fontSize: 520 * s, lineHeight: 0.8, color: 'transparent', WebkitTextStroke: `${2 * s}px ${p.accent}`, opacity: 0.12 * indexPop, transform: `translateY(${(1 - indexPop) * 80 * s}px)` }}>{idx}</div>
        )}
        <div style={{ position: 'absolute', left: box.left, top: box.top * 0.85, width: box.width, height: box.height * 1.08, display: 'flex', flexDirection: 'column', justifyContent: big ? 'center' : 'flex-start', gap: (big ? 40 : 30) * s }}>
          {header}
          {media}
          {hasMedia ? links : bullets}
          {!hasMedia && links}
          {command}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {!hasMedia && (
        <div style={{ position: 'absolute', right: box.left, top: box.top + box.height * 0.5, transform: `translateY(-50%) translateX(${(1 - indexPop) * 60 * s}px)`, fontFamily: FONTS.display, fontWeight: 900, fontSize: 640 * s, lineHeight: 0.8, color: 'transparent', WebkitTextStroke: `${2.5 * s}px ${p.accent}`, opacity: 0.16 * indexPop }}>{idx}</div>
      )}
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, display: 'flex', alignItems: 'center', gap: box.width * 0.06 }}>
        <div style={{ width: textWidth, display: 'flex', flexDirection: 'column', gap: 30 * s }}>
          {header}
          {bullets}
          {links}
          {command}
        </div>
        {media}
      </div>
    </AbsoluteFill>
  );
};
