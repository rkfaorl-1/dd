/**
 * Dorm room floor plan - the single source of truth for dimensions and placement.
 *
 * Units are meters. Axes:  +X = right (seen from the door),  +Y = up,
 * +Z = toward the entrance / hallway. The room interior spans
 * x: -1.8 .. 1.8 and z: 0 (entrance wall) .. -5.2 (window wall).
 *
 *                      WINDOW WALL (z = -5.2)
 *        +---------------[ window ]-----------------+
 *        | narrator bed  [roommate desk]  roommate bed |
 *        | (head @ wall)    + chair      (head @ wall) |
 *        |                                           |
 *        |                 rug      ######  <- roommate wardrobe used as a
 *        | [fridge]                 ######     room divider: hides the
 *        |                                     roommate's bed from the door
 *        | narrator desk + chair        [dresser]   |
 *        |                                           |
 *        | [narrator wardrobe]                       |
 *        +------------------switch-[ door ]----------+
 *                      HALLWAY (z > 0.15)
 *
 * The narrator's desk is right by the entrance. The roommate's bed sits deep
 * in the far-right corner behind a wardrobe that students turned into a room
 * divider - an ordinary arrangement that makes the deep part of the room only
 * partially visible from the door.
 */

export const ROOM = {
  x0: -1.8,
  x1: 1.8,
  z0: 0, // entrance wall (inside face)
  z1: -5.2, // window wall (inside face)
  height: 2.55,
  wall: 0.15, // interior partition thickness
  extWall: 0.26, // exterior wall thickness
};

export const DOOR = {
  x0: 0.4, // latch side
  x1: 1.32, // hinge side
  height: 2.04,
  leafThickness: 0.045,
  // Opening angles in degrees for each door state.
  states: { closed: 0, ajar: 21, open: 86 },
  order: ['closed', 'ajar', 'open'],
};

export const WINDOW = {
  x0: -0.6,
  x1: 0.6,
  sill: 0.92,
  top: 2.12,
  blindsBottom: 1.5, // blinds lowered to this height
};

export const SWITCH = { x: 0.2, y: 1.22 };

export const HALL = {
  z0: 0.15, // room-side wall face (hallway side)
  z1: 2.15, // opposite wall face
  x0: -7.2,
  x1: 7.2,
  ceiling: 2.45,
};

/** Neighbouring doors along the hallway (decorative). */
export const HALL_DOORS = [
  { x0: -3.25, x1: -2.33, side: 'north', number: '212' },
  { x0: 3.9, x1: 4.82, side: 'north', number: '216' },
  { x0: -1.75, x1: -0.83, side: 'south', number: '213' },
  { x0: 2.0, x1: 2.92, side: 'south', number: '215' },
  { x0: 5.6, x1: 6.52, side: 'south', number: '217' },
];

/** Furniture footprints: x/z ranges in meters (used for geometry AND the baked floor AO). */
export const FURNITURE = {
  narratorWardrobe: { x0: -1.8, x1: -0.86, z0: 0, z1: -0.62, height: 2.0 },
  narratorDesk: { x0: -1.8, x1: -1.2, z0: -0.72, z1: -1.79, height: 0.76 },
  narratorChair: { x: -0.97, z: -1.24, facing: -90 },
  fridge: { x0: -1.79, x1: -1.31, z0: -1.94, z1: -2.42, height: 0.85 },
  narratorBed: { x0: -1.79, x1: -0.8, z0: -3.12, z1: -5.15 },
  roommateDesk: { x0: -0.535, x1: 0.535, z0: -4.58, z1: -5.19, height: 0.76 },
  roommateChair: { x: 0.08, z: -4.18, facing: 168 },
  roommateBed: { x0: 0.8, x1: 1.79, z0: -3.12, z1: -5.15 },
  // Divider: the wardrobe's back faces the entrance, doors face the roommate's bed.
  roommateWardrobe: { x0: 0.86, x1: 1.8, z0: -1.95, z1: -2.57, height: 2.0 },
  roommateDresser: { x0: 1.36, x1: 1.8, z0: -1.0, z1: -1.82, height: 0.78 },
  rug: { x0: -0.58, x1: 0.62, z0: -1.95, z1: -3.6 },
  hamper: { x: 1.58, z: -0.38 },
  trash: { x: -1.06, z: -0.84 },
};

export const BED_DECK_HEIGHT = 0.47; // top of the bed deck (mattress sits on it)
export const MATTRESS_THICKNESS = 0.16;
