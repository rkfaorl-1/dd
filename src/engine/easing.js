/**
 * Easing curves for camera moves and transitions. All map t in [0, 1] -> [0, 1].
 */
export const EASINGS = {
  linear: (t) => t,
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  // Very gentle start and stop - good for long, slow dolly moves.
  smootherstep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

export function ease(name, t) {
  const fn = EASINGS[name] || EASINGS.easeInOutSine;
  return fn(Math.min(1, Math.max(0, t)));
}
