/**
 * "Reference look" dorm room - floor plan measured from the user's reference image
 * (perspective of the back wall, window, beds, desks and wardrobe).
 *
 * Units: meters. +X right (seen from the door), +Y up, +Z toward the entrance.
 * Room interior: x -1.84 .. 1.84 (12 ft), z 0 (entrance wall) .. -6.07 (window wall), 2.44 high.
 *
 *                       WINDOW WALL (z = -6.07)
 *        +------------[   window   ]-------------+
 *        |  left bed    [ wall unit ]   right bed |   <- beds, heads at the window wall
 *        |  (posts)                     (posts)   |
 *        |  backpack              [wardrobe] gap  |   <- free-standing wardrobe hides the right bed's foot
 *        |  corkboard                             |
 *        |  [left desk] chair      chair [right desk]
 *        |######  <- entry closet                 |
 *        |###### switch |door swung in            |
 *        +--------------[ door ]------------------+
 *                       HALLWAY (z > 0.15)
 */

export const ROOM = {
  x0: -1.84,
  x1: 1.84,
  z0: 0,
  z1: -6.07,
  height: 2.44,
  wall: 0.15,
  extWall: 0.26,
};

/** Built-in entry closet left of the door. Its side (facing the entry) carries the light switch. */
export const CLOSET = { x0: ROOM.x0, x1: -0.36, z0: 0, z1: -0.8, trim: 0.075 };

export const DOOR = {
  x0: -0.32, // latch side
  x1: 0.59, // hinge side
  height: 2.06,
  leafThickness: 0.045,
  // Swings into the room, hinged on the right. Angles in degrees. "Open" leaves the leaf
  // angled toward the room so its lock shows at the right edge of the reference view.
  states: { closed: 0, ajar: 24, open: 76 },
  order: ['closed', 'ajar', 'open'],
};

export const SWITCH = { x: CLOSET.x1, y: 1.25, z: -0.68 };

export const WINDOW = { x0: -0.88, x1: 0.82, sill: 0.77, top: 2.03, headrailTop: 2.29 };

/** Through-wall heating/AC unit under the window. */
export const WALL_UNIT = { x0: -0.66, x1: 0.59, z0: ROOM.z1 + 0.3, z1: ROOM.z1, height: 0.64 };

export const HALL = { z0: 0.15, z1: 2.15, x0: -3.2, x1: 3.4, ceiling: 2.48 };

export const BED_DECK = 0.62; // bed deck height (storage underneath)
export const MATTRESS = 0.18;

export const FURNITURE = {
  leftDesk: { x0: ROOM.x0, x1: -0.99, z0: -2.0, z1: -3.1, height: 0.76 },
  leftChair: { x: -0.72, z: -2.62, facing: -78 },
  leftBed: { x0: -1.8, x1: -0.78, z0: -3.98, z1: -6.04 },
  rightBed: { x0: 0.78, x1: 1.8, z0: -3.98, z1: -6.04 },
  // Free-standing, ~0.3 m off the right wall (the reference shows wall + poster in the gap).
  wardrobe: { x0: 0.98, x1: 1.56, z0: -3.28, z1: -3.94, height: 1.84 },
  rightDesk: { x0: 1.15, x1: ROOM.x1, z0: -2.05, z1: -3.15, height: 0.76 },
  rightChair: { x: 0.98, z: -2.72, facing: 90 },
  underBedDrawer: { x0: -1.72, x1: -0.86, z0: -4.1, z1: -4.75, height: 0.4 },
  trash: { x: 1.28, z: -2.58 },
  backpack: { x: -0.64, z: -3.86 },
  corkboard: { z0: -2.9, z1: -3.66, y0: 1.05, y1: 1.95 },
};

/** Ceiling dome light position. */
export const DOME = { x: -0.04, z: -4.0 };

/** The camera pose that reproduces the reference image (see shots.js, shot R). */
export const REFERENCE_CAMERA = { pos: [0, 1.35, -0.26], lens: 20, shift: [-0.046, 0.182] };
