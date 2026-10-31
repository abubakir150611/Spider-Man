import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { FactoryVideo } from './Video';
import { sampleTimeline } from './sample-timeline';
import type { Timeline } from './types';

type Props = { timeline: Timeline };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.timeline.durationInFrames,
  fps: props.timeline.fps,
  width: props.timeline.width,
  height: props.timeline.height,
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FactoryVideo"
    component={FactoryVideo}
    defaultProps={{ timeline: sampleTimeline }}
    calculateMetadata={calculateMetadata}
    durationInFrames={sampleTimeline.durationInFrames}
    fps={30}
    width={1080}
    height={1920}
  />
);
