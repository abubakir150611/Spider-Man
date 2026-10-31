import { interpolate, spring, Easing } from 'remotion';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 progress with a premium ease-out curve. */
export function reveal(frame: number, start: number, duration = 14) {
  return interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: easeOut });
}

export function pop(frame: number, fps: number, delay = 0, damping = 14) {
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 170, mass: 0.7 } });
}

/** Common "rise + unblur" entrance used across typography. */
export function riseStyle(p: number, distance = 40, blur = 10): React.CSSProperties {
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined,
  };
}
