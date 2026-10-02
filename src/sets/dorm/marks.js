/**
 * Character marks: named spots where a 2D character cutout can stand or sit.
 *
 *   pos    [x, y, z]  feet position on the floor (meters)
 *   yaw    facing direction in degrees when "Fixed" facing is used
 *          (0 = facing the entrance / +Z, 90 = facing +X, -90 = facing -X, 180 = facing the window)
 *   pose   'standing' | 'seated' - picks which image of the character slot to show
 */
export const MARKS = {
  nearDesk: {
    label: 'Near narrator desk',
    pos: [-0.6, 0, -1.62],
    yaw: 70,
    pose: 'standing',
  },
  seatedAtDesk: {
    label: 'Seated at desk',
    pos: [-0.99, 0, -1.24],
    yaw: -90,
    pose: 'seated',
  },
  entrance: {
    label: 'Near entrance',
    pos: [0.72, 0, -0.55],
    yaw: 180,
    pose: 'standing',
  },
  deepBed: {
    label: 'Deep bed area',
    pos: [0.68, 0, -3.8],
    yaw: 10,
    pose: 'standing',
  },
  // --- extra marks ---
  doorway: {
    label: 'In the doorway',
    pos: [0.86, 0, 0.12],
    yaw: 180,
    pose: 'standing',
  },
  hiddenCorner: {
    label: 'Behind the wardrobe',
    pos: [1.28, 0, -2.86],
    yaw: -60,
    pose: 'standing',
  },
  bedEdge: {
    label: "On roommate's bed",
    pos: [0.62, 0, -4.0],
    yaw: -90,
    pose: 'seated',
  },
  window: {
    label: 'By the window',
    pos: [-0.6, 0, -4.4],
    yaw: 20,
    pose: 'standing',
  },
  hallway: {
    label: 'Hallway',
    pos: [-1.35, 0, 1.25],
    yaw: 70,
    pose: 'standing',
  },
};
