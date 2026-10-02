/**
 * Camera shot presets for the dorm set.
 *
 * Each shot is a single camera move:
 *   startPos   [x, y, z]  camera position when the shot begins
 *   endPos     [x, y, z]  camera position when the shot ends
 *   target     [x, y, z]  look-at point
 *   endTarget  [x, y, z]  (optional) look-at point at the end - lets the camera pan during the move
 *   lens       focal length in mm (full-frame equivalent; 16 = very wide, 50 = normal-tight)
 *   endLens    (optional) focal length at the end - a slow zoom
 *   roll       (optional) dutch angle in degrees
 *   duration   seconds
 *   easing     name from engine/easing.js
 *   shift      (optional) [x, y] lens shift as a fraction of the frame - keeps verticals straight
 *              while moving the horizon (y > 0 shows more floor, x < 0 shows more of the left)
 *   insert     (optional) true = listed under "Inserts" in the panel
 *   requires   (optional) set state the shot needs, e.g. { door: 'open' } to dolly through the doorway
 *
 * Tip: switch on "Debug orbit", frame something, then use "Copy camera pose"
 * to get coordinates you can paste in here.
 */
export const SHOTS = [
  {
    id: 'A',
    name: 'Hallway → door',
    description: 'Hallway view toward the dorm door. Slow approach.',
    startPos: [3.05, 1.56, 1.9],
    endPos: [2.25, 1.52, 1.62],
    target: [0.86, 1.18, 0.12],
    endTarget: [0.8, 1.12, 0.1],
    lens: 26,
    endLens: 30,
    duration: 8,
    easing: 'easeInOutSine',
  },
  {
    id: 'B',
    name: 'Doorway push-in',
    description: 'From the doorway, slowly pushing into the room.',
    startPos: [0.86, 1.6, 0.72],
    endPos: [0.74, 1.55, -0.85],
    target: [-0.05, 1.08, -4.6],
    endTarget: [0.1, 1.02, -4.6],
    lens: 22,
    duration: 9,
    easing: 'easeInOutSine',
    requires: { door: 'open' },
  },
  {
    id: 'C',
    name: 'Over the desk',
    description: 'Over the narrator desk area, looking inward toward the deep side of the room.',
    startPos: [-1.7, 1.6, -1.68],
    endPos: [-1.6, 1.54, -1.86],
    target: [0.6, 0.8, -2.9],
    endTarget: [0.72, 0.8, -3.05],
    lens: 18,
    duration: 7,
    easing: 'easeInOutSine',
  },
  {
    id: 'D',
    name: 'Partial view → bed',
    description: "Toward the roommate's bed area, still partly hidden by the wardrobe.",
    startPos: [0.42, 1.48, -0.55],
    endPos: [0.5, 1.45, -0.98],
    target: [1.15, 0.88, -4.4],
    lens: 30,
    endLens: 33,
    duration: 7,
    easing: 'easeInOutSine',
  },
  {
    id: 'E',
    name: 'Lateral reveal',
    description: 'Camera slides sideways, revealing the hidden deep corner behind the wardrobe.',
    startPos: [1.02, 1.42, -1.15],
    endPos: [-0.62, 1.42, -1.15],
    target: [0.98, 0.95, -4.2],
    endTarget: [1.12, 0.92, -4.2],
    lens: 30,
    duration: 9,
    easing: 'easeInOutSine',
  },
  {
    id: 'F',
    name: 'Wide establishing',
    description: 'Wide view of the whole room from the high corner above the narrator desk.',
    startPos: [-1.56, 2.3, -0.8],
    endPos: [-1.46, 2.26, -0.98],
    target: [0.6, 0.55, -3.9],
    endTarget: [0.7, 0.55, -3.95],
    lens: 15,
    duration: 8,
    easing: 'easeInOutSine',
  },
  {
    id: 'G',
    name: 'Low push → deep room',
    description: 'Low-angle, subtle push toward the deeper part of the room.',
    startPos: [0.12, 0.38, -0.45],
    endPos: [0.22, 0.36, -1.7],
    target: [0.7, 0.5, -4.7],
    lens: 24,
    roll: 2.5,
    duration: 9,
    easing: 'easeInOutSine',
  },
  {
    id: 'H',
    name: 'Window → back',
    description: 'From the window side looking back into the room toward the door.',
    startPos: [-0.42, 1.52, -4.25],
    endPos: [-0.12, 1.48, -4.05],
    target: [0.86, 1.2, 0.0],
    lens: 22,
    duration: 8,
    easing: 'easeInOutSine',
  },

  // --- Extra coverage (inserts) ---
  {
    id: 'I',
    insert: true,
    name: 'Light switch (insert)',
    description: 'Close insert on the light switch by the entrance.',
    startPos: [0.42, 1.32, -0.55],
    endPos: [0.36, 1.29, -0.42],
    target: [0.2, 1.22, 0.0],
    lens: 50,
    duration: 4,
    easing: 'easeInOutSine',
  },
  {
    id: 'J',
    insert: true,
    name: 'Under the door',
    description: 'Floor-level view of the gap under the door.',
    startPos: [0.4, 0.1, -1.7],
    endPos: [0.55, 0.09, -1.25],
    target: [0.86, 0.04, 0.0],
    lens: 32,
    duration: 6,
    easing: 'easeInOutSine',
  },
  {
    id: 'K',
    insert: true,
    name: 'Desk POV',
    description: "Narrator's point of view at the desk: laptop and lamp. Hide the narrator cutout for this one.",
    startPos: [-0.86, 1.24, -1.2],
    endPos: [-0.93, 1.2, -1.24],
    target: [-1.6, 0.93, -1.3],
    lens: 30,
    duration: 5,
    easing: 'easeInOutSine',
  },
  {
    id: 'L',
    insert: true,
    name: 'Bed close',
    description: "Close on the roommate's bed from the foot of the room.",
    startPos: [0.2, 1.15, -3.0],
    endPos: [0.32, 1.1, -3.25],
    target: [1.3, 0.72, -4.65],
    lens: 32,
    duration: 6,
    easing: 'easeInOutSine',
  },
  {
    id: 'M',
    insert: true,
    name: 'Desk from the room',
    description: 'From the middle of the room toward the narrator at the desk.',
    startPos: [0.45, 1.45, -2.25],
    endPos: [0.22, 1.42, -2.05],
    target: [-1.35, 0.95, -1.2],
    lens: 28,
    duration: 7,
    easing: 'easeInOutSine',
  },
];
