import {Easing} from 'remotion';

export type EasingFn = (x: number) => number;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 0..1 progress of time `t` (seconds) through [start, end], optionally eased. */
export const progress = (t: number, start: number, end: number, easing: EasingFn = (x) => x) =>
  easing(clamp01((t - start) / (end - start)));

/** Piecewise interpolation through [time, value] keyframes. */
export const keyframes = (t: number, frames: [number, number][], easing: EasingFn = (x) => x) => {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return lerp(v0, v1, easing((t - t0) / (t1 - t0)));
    }
  }
  return frames[frames.length - 1][1];
};

/** Fade-in opacity of character `index` for a typewriter effect. */
export const typeOpacity = (t: number, start: number, perChar: number, index: number, fade = 0.1) =>
  progress(t, start + index * perChar, start + index * perChar + fade);

/** Ease-out with adjustable strength: 1 - (1 - x)^power */
export const easeOutPow = (power: number): EasingFn => (x) => 1 - Math.pow(1 - x, power);

// Easing curves. The bezier ones were fitted to motion measured in the reference video.
export const EASE = {
  linear: ((x) => x) as EasingFn,
  outQuad: Easing.out(Easing.quad),
  outCubic: Easing.out(Easing.cubic),
  inOutQuad: Easing.inOut(Easing.quad),
  inOutCubic: Easing.inOut(Easing.cubic),
  jump: Easing.bezier(0.62, 0.03, 0.46, 0.91),
  extend: Easing.bezier(0.775, 0, 0.592, 1),
  rescale: Easing.bezier(0.68, 0.04, 0.29, 0.97),
  brownLine: Easing.bezier(0.347, 0.132, 0.442, 1),
  blueLine: Easing.bezier(0.642, 0.068, 0.52, 0.906),
  legend1: Easing.bezier(0.615, 0.18, 0.212, 0.852),
  legend2: Easing.bezier(0.714, 0.103, 0.299, 0.948),
};
