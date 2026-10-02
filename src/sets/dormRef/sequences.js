/**
 * Storyboards for the reference-look room (step format: see src/sets/dorm/sequences.js).
 * Background only: no characters are shown.
 */
export const SEQUENCES = [
  {
    id: 'roomTour',
    title: 'Room tour (night)',
    fadeIn: 1.0,
    fadeOut: 1.4,
    steps: [
      { shot: 'R', duration: 6, lighting: 'reference', set: { door: 'open' }, characters: {} },
      { shot: 'B', duration: 9 },
      { shot: 'C', duration: 6 },
      { shot: 'E', duration: 8 },
      { shot: 'G', duration: 7, lighting: 'flicker', handheld: 0.5 },
      { shot: 'H', duration: 7, lighting: 'night', lightingFade: 2.5, transition: 'fade' },
    ],
  },
  {
    id: 'lightingTest',
    title: 'Lighting test (all presets)',
    fadeIn: 0.5,
    fadeOut: 0.5,
    steps: [
      { shot: 'R', duration: 4, lighting: 'reference', characters: {} },
      { shot: 'R', duration: 4, lighting: 'night', lightingFade: 1.5 },
      { shot: 'R', duration: 4, lighting: 'day', lightingFade: 1.5 },
      { shot: 'R', duration: 4, lighting: 'overcast', lightingFade: 1.5 },
      { shot: 'R', duration: 4, lighting: 'evening', lightingFade: 1.5 },
      { shot: 'R', duration: 6, lighting: 'flicker', lightingFade: 0.3 },
    ],
  },
];
