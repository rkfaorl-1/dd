/**
 * Project configuration: which set to load, character slots and output settings.
 * Edit this file to swap in your own character art.
 */

/**
 * Character slots. Each slot is one 2D cutout that can be placed on the set's marks.
 *
 *   images      transparent PNGs per pose. The figure should fill the full image
 *               height with the feet on the bottom edge. Missing images fall back
 *               to a drawn placeholder; 'seated' falls back to 'standing'.
 *   heights     real-world height (m) the image maps to, per pose
 *   placeholder style of the drawn fallback figure ('A' or 'B')
 *   mark        starting mark id (see src/sets/dorm/marks.js)
 *   visible     shown on load?
 *   scale / facing ('camera' | 'fixed') / yaw / mirror / silhouette  -> starting look
 */
export const CHARACTER_SLOTS = [
  {
    id: 'A',
    name: 'Narrator',
    images: {
      standing: 'assets/characters/narrator_standing.png',
      seated: 'assets/characters/narrator_seated.png',
    },
    heights: { standing: 1.74, seated: 1.3 },
    placeholder: 'A',
    mark: 'seatedAtDesk',
    visible: false,
  },
  {
    id: 'B',
    name: 'Roommate',
    images: {
      standing: 'assets/characters/roommate_standing.png',
      seated: 'assets/characters/roommate_seated.png',
    },
    heights: { standing: 1.8, seated: 1.32 },
    placeholder: 'B',
    mark: 'deepBed',
    visible: false,
  },
];

export const APP_CONFIG = {
  // 'auto' renders at screen resolution; '720p' / '1080p' render at a fixed size (best for recording).
  renderSize: 'auto',
  recordFps: 30,
  recordBitrate: 14_000_000,
  // Override the set's defaults if you like (shot id / lighting preset id).
  startShot: null,
  startLighting: null,
};
