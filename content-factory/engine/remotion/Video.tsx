import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from './components/Background';
import { Captions } from './components/Captions';
import { SceneFrame } from './components/SceneFrame';
import { ensureFonts } from './fonts';
import { BulletsScene } from './scenes/BulletsScene';
import { CodeScene } from './scenes/CodeScene';
import { FactScene } from './scenes/FactScene';
import { HookScene } from './scenes/HookScene';
import { ItemScene } from './scenes/ItemScene';
import { OutroScene } from './scenes/OutroScene';
import { StatScene } from './scenes/StatScene';
import { TitleScene } from './scenes/TitleScene';
import { FONTS, palette, type Palette } from './theme';
import type { Timeline, TimelineScene } from './types';

ensureFonts();

const SceneBody: React.FC<{ scene: TimelineScene; p: Palette; timeline: Timeline }> = ({ scene, p, timeline }) => {
  switch (scene.type) {
    case 'hook':
      return <HookScene scene={scene} p={p} />;
    case 'title':
      return <TitleScene scene={scene} p={p} />;
    case 'item':
      return <ItemScene scene={scene} p={p} />;
    case 'code':
      return <CodeScene scene={scene} p={p} typing={timeline.typing} />;
    case 'stat':
      return <StatScene scene={scene} p={p} lang={timeline.language} />;
    case 'bullets':
      return <BulletsScene scene={scene} p={p} />;
    case 'fact':
      return <FactScene scene={scene} p={p} lang={timeline.language} />;
    case 'outro':
      return <OutroScene scene={scene} p={p} lang={timeline.language} />;
    default:
      return null;
  }
};

const ProgressBar: React.FC<{ p: Palette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = Math.min(width, height) / 1080;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 6 * s, width: `${(frame / durationInFrames) * 100}%`, background: p.accent, boxShadow: `0 0 ${16 * s}px ${p.accent}` }} />
    </AbsoluteFill>
  );
};

/** Chapter label in the corner for long-form videos. */
const ChapterTag: React.FC<{ timeline: Timeline; p: Palette }> = ({ timeline, p }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (timeline.orientation !== 'horizontal' || !timeline.chapters.length) return null;
  const t = frame / fps;
  const current = [...timeline.chapters].reverse().find((c) => t >= c.startSec);
  if (!current) return null;
  const s = Math.min(width, height) / 1080;
  return (
    <div style={{ position: 'absolute', top: 44 * s, left: width * 0.07, fontFamily: FONTS.mono, fontSize: 24 * s, color: p.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <span style={{ color: p.accent }}>■</span> {current.title}
    </div>
  );
};

export const FactoryVideo: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const p = palette(timeline.theme);
  const vertical = timeline.orientation === 'vertical';
  return (
    <AbsoluteFill style={{ backgroundColor: p.bg, fontFamily: FONTS.text }}>
      <Background p={p} />
      {timeline.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={`${scene.index + 1}. ${scene.type}`}>
          <SceneFrame transition={scene.transition} durationInFrames={scene.durationInFrames}>
            <SceneBody scene={scene} p={p} timeline={timeline} />
          </SceneFrame>
        </Sequence>
      ))}
      <ChapterTag timeline={timeline} p={p} />
      <Captions cues={timeline.captions} p={p} vertical={vertical} />
      <ProgressBar p={p} />
    </AbsoluteFill>
  );
};
