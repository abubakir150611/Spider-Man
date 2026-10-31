import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeOut } from './motion';

/** Wraps a scene with its entrance transition, a subtle exit and a slow camera push-in. */
export const SceneFrame: React.FC<{ transition: string; durationInFrames: number; children: React.ReactNode }> = ({ transition, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const inP = interpolate(frame, [0, 11], [0, 1], { ...clamp, easing: easeOut });
  const outP = interpolate(frame, [durationInFrames - 7, durationInFrames], [0, 1], clamp);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.035], clamp);

  let transform = `scale(${push})`;
  let filter = '';
  let clipPath: string | undefined;
  let opacity = 1;
  switch (transition) {
    case 'slide':
      transform = `translateX(${(1 - inP) * width * 0.12}px) scale(${push})`;
      filter = `blur(${(1 - inP) * 14}px)`;
      opacity = inP;
      break;
    case 'zoom':
      transform = `scale(${push * (1 + (1 - inP) * 0.18)})`;
      filter = `blur(${(1 - inP) * 18}px)`;
      opacity = inP;
      break;
    case 'wipe':
      clipPath = `inset(0 ${(1 - inP) * 100}% 0 0)`;
      break;
    case 'blur':
      filter = `blur(${(1 - inP) * 24}px)`;
      opacity = inP;
      break;
    default:
      break;
  }
  if (outP > 0) {
    opacity *= 1 - outP;
    transform += ` scale(${1 + outP * 0.04})`;
    filter += ` blur(${outP * 8}px)`;
  }
  return (
    <AbsoluteFill style={{ transform, filter: filter.trim() || undefined, clipPath, opacity }}>
      {children}
    </AbsoluteFill>
  );
};
