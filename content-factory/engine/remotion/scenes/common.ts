import { useVideoConfig } from 'remotion';

/** Layout helpers shared by scenes: scale unit and the safe content box. */
export function useLayout() {
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  const s = Math.min(width, height) / 1080;
  // Vertical: keep content clear of captions (~65%) and platform UI (bottom ~20%, right rail).
  const box = vertical
    ? { left: width * 0.075, top: height * 0.1, width: width * 0.85, height: height * 0.52 }
    : { left: width * 0.07, top: height * 0.1, width: width * 0.86, height: height * 0.68 };
  return { width, height, fps, vertical, s, box };
}
