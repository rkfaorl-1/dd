import { hash1, smoothNoise1 } from './noise.js';

/**
 * Practical-light instability (shared by all sets): a faint constant shimmer, a slow wander and
 * occasional short dropouts (a failing ballast / loose bulb). Deterministic in
 * time, so a recorded take can be reproduced exactly.
 */
export function flickerMultiplier(t, amount, seed = 0) {
  if (amount <= 0) return 1;
  const shimmer = (smoothNoise1(t * 31 + seed * 7.1) - 0.5) * 0.07;
  const wander = (smoothNoise1(t * 0.9 + seed * 3.3) - 0.5) * 0.14;
  const rate = 2.4;
  const slotTime = t * rate + seed * 0.37;
  const slot = Math.floor(slotTime);
  const local = slotTime - slot;
  let dip = 0;
  if (hash1(slot * 1.37 + seed) < 0.22 * amount) {
    const start = hash1(slot + 11.5) * 0.6;
    const length = 0.05 + hash1(slot + 21.7) * 0.16;
    if (local > start && local < start + length) {
      dip = 0.3 + hash1(slot + 31.9) * 0.6;
      // Double-blink inside some dropouts.
      if (hash1(slot + 41.3) > 0.6 && local > start + length * 0.4 && local < start + length * 0.6) dip *= 0.25;
    }
  }
  return Math.max(0, 1 + (shimmer + wander) * amount - dip * amount);
}
