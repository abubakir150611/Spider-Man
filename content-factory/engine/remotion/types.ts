export type Word = { text: string; start: number; end: number };
export type Cue = { start: number; end: number; text: string; words: Word[] };

export type SceneVisual = Record<string, any>;

export type TimelineScene = {
  index: number;
  id: string;
  type: 'hook' | 'title' | 'item' | 'code' | 'stat' | 'bullets' | 'fact' | 'outro';
  chapter?: string;
  transition: 'none' | 'slide' | 'zoom' | 'wipe' | 'blur';
  narration: string;
  visual: SceneVisual;
  from: number;
  durationInFrames: number;
  startSec: number;
  endSec: number;
  words: Word[];
};

export type Timeline = {
  version: number;
  fps: number;
  width: number;
  height: number;
  orientation: 'vertical' | 'horizontal';
  durationInFrames: number;
  durationSec: number;
  title: string;
  language: 'ru' | 'en' | 'ky';
  platform: string;
  theme: string;
  typing: { startSec: number; charsPerSec: number; lineGapSec: number };
  scenes: TimelineScene[];
  captions: Cue[];
  chapters: { title: string; startSec: number }[];
};
