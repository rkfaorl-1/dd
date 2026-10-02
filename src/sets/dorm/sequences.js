/**
 * Storyboard sequences for the dorm set.
 *
 * A sequence is an ordered list of steps. Each step is one shot:
 *
 *   shot          shot id from shots.js ('A'..'L')
 *   duration      seconds (defaults to the shot's own duration)
 *   lighting      lighting preset id (omit = keep the current lighting)
 *   lightingFade  seconds to blend into the new lighting (0 / omitted = hard cut)
 *   lightingDelay seconds into the shot before the lighting change starts
 *   characters    who is visible in this shot. Omit the key to leave characters as they are;
 *                 {} hides everyone. Each entry is either a mark id or an object:
 *                 { mark, scale, facing: 'camera' | 'fixed', yaw, mirror, silhouette }
 *   set           set state, e.g. { door: 'ajar', roommateBed: 'occupied' }
 *                 door can also animate: { door: { state: 'open', delay: 1.5, duration: 3 } }
 *   handheld      0..1 camera shake for this shot (0 = locked off)
 *   transition    'cut' (default) or 'fade' - how we get INTO this shot
 *   note          narration / script line shown in the HUD while the shot plays (not recorded)
 *
 * Character slot ids ('A' = Narrator, 'B' = Roommate) are defined in src/config.js.
 */
export const SEQUENCES = [
  {
    id: 'nightReturn',
    title: 'Night return (demo scene)',
    fadeIn: 1.2,
    fadeOut: 1.6,
    steps: [
      {
        shot: 'A',
        duration: 7,
        lighting: 'night',
        set: { door: 'ajar', roommateBed: 'occupied' },
        characters: {},
        note: 'I got back to the dorm a little after three. Our door was open a crack.',
      },
      {
        shot: 'B',
        duration: 8,
        set: { door: { state: 'open', duration: 2.5 } },
        note: 'The room was dark. Jake was asleep. Or I assumed he was.',
      },
      {
        shot: 'I',
        duration: 3.5,
        note: "I didn't turn on the big light. I didn't want to wake him.",
      },
      {
        shot: 'M',
        duration: 7,
        lighting: 'nightLamp',
        lightingDelay: 1.4,
        lightingFade: 0.12,
        characters: { A: 'seatedAtDesk' },
        note: 'I switched on my desk lamp and sat down to finish my essay.',
      },
      {
        shot: 'D',
        duration: 7,
        note: 'His bed is in the far corner, behind the wardrobe. From the front of the room you only see the end of it.',
      },
      {
        shot: 'E',
        duration: 9,
        characters: { B: { mark: 'deepBed', silhouette: true } },
        note: 'Around four I heard the carpet creak. I leaned back to look... and he was standing next to his bed.',
      },
      {
        shot: 'G',
        duration: 7,
        lighting: 'flicker',
        handheld: 0.6,
        note: 'Then the ceiling light came on by itself. It would not stop flickering.',
      },
      {
        shot: 'H',
        duration: 8,
        lighting: 'night',
        transition: 'fade',
        characters: { B: { mark: 'doorway', silhouette: true } },
        note: 'When it went dark again he was in the doorway. And his bed still was not empty.',
      },
    ],
  },
  {
    id: 'dayCoverage',
    title: 'Day coverage',
    fadeIn: 0.8,
    fadeOut: 1.0,
    steps: [
      { shot: 'F', duration: 6, lighting: 'day', set: { door: 'closed', roommateBed: 'empty' }, characters: {} },
      { shot: 'C', duration: 6, characters: { B: 'bedEdge' } },
      { shot: 'M', duration: 6, lighting: 'overcast', characters: { A: 'seatedAtDesk', B: 'bedEdge' } },
      { shot: 'E', duration: 8, characters: { B: 'deepBed' } },
      { shot: 'H', duration: 7, lighting: 'evening', lightingFade: 4, characters: { A: 'nearDesk' } },
    ],
  },
  {
    id: 'lightingTest',
    title: 'Lighting test (all presets)',
    fadeIn: 0.5,
    fadeOut: 0.5,
    steps: [
      { shot: 'F', duration: 4, lighting: 'day', characters: {} },
      { shot: 'F', duration: 4, lighting: 'overcast', lightingFade: 1.5 },
      { shot: 'F', duration: 4, lighting: 'evening', lightingFade: 1.5 },
      { shot: 'F', duration: 4, lighting: 'night', lightingFade: 1.5 },
      { shot: 'F', duration: 4, lighting: 'nightLamp', lightingFade: 0.3 },
      { shot: 'F', duration: 6, lighting: 'flicker', lightingFade: 0.3 },
    ],
  },
];
