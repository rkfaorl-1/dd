/**
 * Dorm architecture: room shell, door, light switch, window + blinds,
 * ceiling fixture, hallway, and the exterior seen through the window.
 *
 * Everything is simple boxes/planes with procedural textures. Each builder
 * returns handles (door pivot, emissive materials, ...) that the lighting rig
 * and set-state controls drive at runtime.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxFromBounds, applyWorldUVs } from '../../lib/geometry.js';
import {
  CMU_TILE,
  VCT_TILE,
  ceilingTileTexture,
  edgeFadeTexture,
  labelTexture,
  corkboardTexture,
  facadeTextures,
  treeTexture,
  makeCanvas,
  canvasTexture,
  softRect,
} from '../../lib/textures.js';
import { ROOM, DOOR, WINDOW, SWITCH, HALL, HALL_DOORS, FURNITURE } from './layout.js';

const WALL_TOP = ROOM.height;

export function buildArchitecture(M, root) {
  const handles = {};
  const add = (mesh, uvTile = null, grain = null) => {
    root.add(mesh);
    if (uvTile) applyWorldUVs(mesh, uvTile, grain);
    return mesh;
  };

  buildRoomShell(M, add);
  buildCornerShading(root);
  buildFloorShading(root);
  handles.door = buildDoor(M, root);
  handles.switchToggle = buildLightSwitch(M, root);
  handles.blinds = buildWindow(M, root, add);
  Object.assign(handles, buildCeilingFixtures(M, root));
  Object.assign(handles, buildHallway(M, root, add));
  handles.exterior = buildExterior(root);
  return handles;
}

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------

function buildRoomShell(M, add) {
  const { x0, x1, z0, z1, wall, extWall } = ROOM;

  // Floor (carpet) and ceiling.
  add(boxFromBounds(x0, x1, -0.05, 0, z1, z0, M.carpet, { cast: false }), 1);
  add(boxFromBounds(x0 - wall, x1 + wall, WALL_TOP, WALL_TOP + 0.08, z1 - extWall, z0 + wall, M.ceiling), 1.2);

  // Side walls.
  add(boxFromBounds(x0 - wall, x0, 0, WALL_TOP, z1 - extWall, z0 + wall, M.wallRoom), CMU_TILE);
  add(boxFromBounds(x1, x1 + wall, 0, WALL_TOP, z1 - extWall, z0 + wall, M.wallRoom), CMU_TILE);

  // Exterior wall with the window opening.
  const wz0 = z1 - extWall, wz1 = z1;
  add(boxFromBounds(x0, WINDOW.x0, 0, WALL_TOP, wz0, wz1, M.wallRoom), CMU_TILE);
  add(boxFromBounds(WINDOW.x1, x1, 0, WALL_TOP, wz0, wz1, M.wallRoom), CMU_TILE);
  add(boxFromBounds(WINDOW.x0, WINDOW.x1, 0, WINDOW.sill, wz0, wz1, M.wallRoom), CMU_TILE);
  add(boxFromBounds(WINDOW.x0, WINDOW.x1, WINDOW.top, WALL_TOP, wz0, wz1, M.wallRoom), CMU_TILE);

  // Entrance wall: shared with the hallway, runs the full hallway length.
  // Only our door is a real opening; neighbour doors are surface-mounted slabs.
  const ez0 = z0, ez1 = z0 + wall;
  add(boxFromBounds(HALL.x0, DOOR.x0, 0, WALL_TOP, ez0, ez1, M.wallRoom), CMU_TILE);
  add(boxFromBounds(DOOR.x1, HALL.x1, 0, WALL_TOP, ez0, ez1, M.wallRoom), CMU_TILE);
  add(boxFromBounds(DOOR.x0, DOOR.x1, DOOR.height, WALL_TOP, ez0, ez1, M.wallRoom), CMU_TILE);

  // Rubber cove base along the room walls (skipping the door opening).
  const h = 0.1, t = 0.008;
  const coves = [
    [x0, x0 + t, z1, z0],
    [x1 - t, x1, z1, z0],
  ];
  for (const [ax0, ax1, az1, az0] of coves) add(boxFromBounds(ax0, ax1, 0, h, az1, az0, M.coveBase, { cast: false }));
  add(boxFromBounds(x0, x1, 0, h, z1, z1 + t, M.coveBase, { cast: false }));
  add(boxFromBounds(x0, DOOR.x0 - 0.05, 0, h, z0 - t, z0, M.coveBase, { cast: false }));
  add(boxFromBounds(DOOR.x1 + 0.05, x1, 0, h, z0 - t, z0, M.coveBase, { cast: false }));
}

/** Darkening strips where walls meet floor/ceiling and in vertical corners (fake ambient occlusion). */
function buildCornerShading(root) {
  const fade = edgeFadeTexture();
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: fade,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const ceilingMaterial = material.clone();
  ceilingMaterial.opacity = 0.22;

  const { x0, x1, z0, z1 } = ROOM;
  const W = x1 - x0, D = z0 - z1;
  const strip = (width, height, mat) => new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  const off = 0.003;

  // Each wall: [center x, center z, yaw, length]
  const walls = [
    [(x0 + x1) / 2, z1 + off, 0, W], // window wall, facing +z
    [(x0 + x1) / 2, z0 - off, Math.PI, W], // entrance wall, facing -z
    [x0 + off, (z0 + z1) / 2, Math.PI / 2, D], // left wall, facing +x
    [x1 - off, (z0 + z1) / 2, -Math.PI / 2, D], // right wall, facing -x
  ];
  for (const [cx, cz, yaw, len] of walls) {
    const floorStrip = strip(len, 0.32, material);
    floorStrip.position.set(cx, 0.16, cz);
    floorStrip.rotation.y = yaw;
    root.add(floorStrip);

    const ceilStrip = strip(len, 0.26, ceilingMaterial);
    ceilStrip.position.set(cx, WALL_TOP - 0.13, cz);
    ceilStrip.rotation.set(0, yaw, 0);
    ceilStrip.rotateZ(Math.PI); // gradient dark at the top edge
    root.add(ceilStrip);
  }

  // Vertical room corners.
  const cornerMat = material.clone();
  cornerMat.opacity = 0.26;
  const corners = [
    [x0, z1, 1, 1],
    [x1, z1, -1, 1],
    [x0, z0, 1, -1],
    [x1, z0, -1, -1],
  ];
  for (const [cx, cz, sx, sz] of corners) {
    for (const along of ['x', 'z']) {
      const s = strip(WALL_TOP, 0.22, cornerMat);
      if (along === 'x') {
        // Strip on the wall perpendicular to Z, fading away from the corner along X.
        s.rotation.set(0, sz > 0 ? 0 : Math.PI, sx * sz > 0 ? -Math.PI / 2 : Math.PI / 2);
        s.position.set(cx + sx * 0.11, WALL_TOP / 2, cz + sz * off);
      } else {
        s.rotation.set(0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx * sz > 0 ? Math.PI / 2 : -Math.PI / 2);
        s.position.set(cx + sx * off, WALL_TOP / 2, cz + sz * 0.11);
      }
      root.add(s);
    }
  }
}

/**
 * Baked floor shading: soft contact shadows under furniture, grime along the
 * walls and a darker traffic path from the door. Painted into one canvas
 * (white = darker) and laid over the carpet as a transparent decal.
 */
function buildFloorShading(root) {
  const { x0, x1, z0, z1 } = ROOM;
  const PX = 160; // pixels per meter
  const W = Math.round((x1 - x0) * PX), H = Math.round((z0 - z1) * PX);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // Map world (x, z) -> canvas pixels. Canvas top (y=0) is the window wall.
  const px = (x) => (x - x0) * PX;
  const pz = (z) => (z - z1) * PX;

  // Grime along the walls.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  softRect(ctx, 0, 0, W, 14, 18, 'rgba(255,255,255,0.35)');
  softRect(ctx, 0, H - 14, W, 14, 18, 'rgba(255,255,255,0.35)');
  softRect(ctx, 0, 0, 14, H, 18, 'rgba(255,255,255,0.35)');
  softRect(ctx, W - 14, 0, 14, H, 18, 'rgba(255,255,255,0.35)');

  // Traffic path: door -> centre of the room -> both desks.
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.shadowColor = 'rgba(255,255,255,0.10)';
  ctx.shadowBlur = 40;
  ctx.lineWidth = 0.55 * PX;
  ctx.beginPath();
  ctx.moveTo(px(0.86), pz(0));
  ctx.quadraticCurveTo(px(0.4), pz(-1.6), px(0.1), pz(-3.2));
  ctx.lineTo(px(0.05), pz(-4.1));
  ctx.moveTo(px(0.7), pz(-0.7));
  ctx.lineTo(px(-0.85), pz(-1.15));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Contact shadows under furniture footprints.
  const footprint = (f, strength = 0.6, blur = 26, inset = 0) => {
    const xa = px(Math.min(f.x0, f.x1)) + inset, xb = px(Math.max(f.x0, f.x1)) - inset;
    const za = pz(Math.min(f.z0, f.z1)) + inset, zb = pz(Math.max(f.z0, f.z1)) - inset;
    softRect(ctx, xa, za, xb - xa, zb - za, blur, `rgba(255,255,255,${strength})`);
  };
  footprint(FURNITURE.narratorDesk, 0.45, 30);
  footprint(FURNITURE.fridge, 0.7, 16);
  footprint(FURNITURE.narratorWardrobe, 0.75, 18);
  footprint(FURNITURE.roommateWardrobe, 0.75, 18);
  footprint(FURNITURE.roommateDresser, 0.7, 16);
  footprint(FURNITURE.narratorBed, 0.62, 34, 6);
  footprint(FURNITURE.roommateBed, 0.7, 34, 6);
  footprint(FURNITURE.roommateDesk, 0.45, 30);
  const blob = (x, z, r, a) => {
    const g = ctx.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * PX);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px(x) - r * PX, pz(z) - r * PX, r * 2 * PX, r * 2 * PX);
  };
  blob(FURNITURE.narratorChair.x, FURNITURE.narratorChair.z, 0.36, 0.35);
  blob(FURNITURE.roommateChair.x, FURNITURE.roommateChair.z, 0.36, 0.35);
  blob(FURNITURE.hamper.x, FURNITURE.hamper.z, 0.28, 0.5);
  blob(FURNITURE.trash.x, FURNITURE.trash.z, 0.22, 0.45);
  // A couple of old stains near the narrator's desk.
  blob(-0.7, -1.55, 0.07, 0.12);
  blob(-0.55, -1.4, 0.04, 0.1);

  const texture = canvasTexture(canvas, { color: false, repeat: false });
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: texture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z0 - z1), material);
  decal.rotation.x = -Math.PI / 2;
  // PlaneGeometry v=1 is +Y before rotation -> -Z after rotation, which is the window wall (canvas top).
  decal.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2);
  root.add(decal);
}

// ---------------------------------------------------------------------------
// Door
// ---------------------------------------------------------------------------

function buildDoor(M, root) {
  const { x0, x1, height, leafThickness: t } = DOOR;
  const z0 = ROOM.z0, z1 = ROOM.z0 + ROOM.wall;
  const face = 0.05;
  // Hollow-metal frame (both sides of the wall).
  root.add(boxFromBounds(x0 - face, x0, 0, height + face, z0 - 0.012, z1 + 0.012, M.doorFrame));
  root.add(boxFromBounds(x1, x1 + face, 0, height + face, z0 - 0.012, z1 + 0.012, M.doorFrame));
  root.add(boxFromBounds(x0 - face, x1 + face, height, height + face, z0 - 0.012, z1 + 0.012, M.doorFrame));
  // Threshold.
  root.add(boxFromBounds(x0, x1, 0, 0.006, z0 - 0.02, z1 + 0.02, M.metal, { cast: false }));

  // Door leaf on a pivot at the hinge edge (room-side face). Rotation.y < 0 swings it into the room.
  const pivot = new THREE.Group();
  pivot.position.set(x1 - 0.005, 0, z0 + 0.004);
  root.add(pivot);
  const width = x1 - x0 - 0.01;
  const leaf = boxFromBounds(-width, 0, 0.022, height - 0.004, 0, t, M.doorVeneer);
  applyWorldUVs(leaf, 1.0, 'y');
  pivot.add(leaf);

  // Hardware: lever handles both sides, closer, peephole, kick plate, number plate.
  const lever = (zSide) => {
    const g = new THREE.Group();
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 20), M.metal);
    rose.rotation.x = Math.PI / 2;
    g.add(rose);
    const handle = boxFromBounds(0, 0.12, -0.009, 0.009, -0.01, 0.01, M.metal);
    handle.position.z += zSide * 0.04;
    g.add(handle);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.045, 12), M.metal);
    neck.rotation.x = Math.PI / 2;
    neck.position.z = zSide * 0.022;
    g.add(neck);
    g.position.set(-width + 0.07, 1.0, zSide > 0 ? t : 0);
    g.traverse((o) => (o.castShadow = true));
    pivot.add(g);
  };
  lever(-1);
  lever(1);
  const closer = boxFromBounds(-0.42, -0.12, height - 0.13, height - 0.06, -0.055, 0, M.darkMetal);
  pivot.add(closer);
  const peephole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, t + 0.01, 16), M.brass);
  peephole.rotation.x = Math.PI / 2;
  peephole.position.set(-width / 2, 1.52, t / 2);
  pivot.add(peephole);
  pivot.add(boxFromBounds(-width + 0.02, -0.02, 0.02, 0.27, t, t + 0.002, M.metal, { cast: false }));

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.08),
    new THREE.MeshStandardMaterial({
      map: labelTexture({ text: '214', background: '#2b2a28', color: '#e8e2d2', border: '#b7ad95' }),
      roughness: 0.4,
    }),
  );
  plate.position.set(-width / 2, 1.66, t + 0.003);
  pivot.add(plate);

  // Light leaking under the closed door (driven by the lighting rig): a bright line at
  // the gap fanning out and fading across the carpet, with soft sides.
  const LW = 128, LH = 96;
  const leakCanvas = makeCanvas(LW, LH);
  const lctx = leakCanvas.getContext('2d');
  const leakImage = lctx.createImageData(LW, LH);
  for (let y = 0; y < LH; y++) {
    const d = (LH - 1 - y) / LH; // 0 at the door edge (canvas bottom) -> 1 into the room
    for (let x = 0; x < LW; x++) {
      const u = Math.abs(x / (LW - 1) - 0.5) * 2; // 0 centre -> 1 sides
      const spread = 0.82 + d * 0.5; // the fan widens away from the door
      const side = Math.max(0, Math.min(1, (spread - u) / 0.22));
      const a = (Math.exp(-d / 0.035) * 0.6 + Math.exp(-d / 0.16) * 0.4) * side * side;
      const i = (y * LW + x) * 4;
      // alphaMap reads the green channel: encode opacity as grey.
      leakImage.data[i] = leakImage.data[i + 1] = leakImage.data[i + 2] = Math.round(255 * a);
      leakImage.data[i + 3] = 255;
    }
  }
  lctx.putImageData(leakImage, 0, 0);
  const leakMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe9c4',
    alphaMap: canvasTexture(leakCanvas, { color: false, repeat: false }),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.1, 0.8), leakMaterial);
  leak.rotation.x = -Math.PI / 2;
  leak.position.set((x0 + x1) / 2, 0.004, z0 - 0.4);
  root.add(leak);

  return {
    pivot,
    leakMaterial,
    setAngle(deg) {
      pivot.rotation.y = -THREE.MathUtils.degToRad(deg);
    },
  };
}

function buildLightSwitch(M, root) {
  const z = ROOM.z0;
  const plate = boxFromBounds(SWITCH.x - 0.035, SWITCH.x + 0.035, SWITCH.y - 0.057, SWITCH.y + 0.057, z - 0.006, z, M.switchPlate);
  root.add(plate);
  const toggle = boxFromBounds(-0.005, 0.005, -0.012, 0.012, -0.014, 0, M.switchPlate);
  const pivot = new THREE.Group();
  pivot.position.set(SWITCH.x, SWITCH.y, z - 0.006);
  pivot.add(toggle);
  root.add(pivot);
  for (const dy of [-0.038, 0.038]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), M.metal);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(SWITCH.x, SWITCH.y + dy, z - 0.0065);
    root.add(screw);
  }
  return {
    setOn(on) {
      // US toggle: up = on.
      pivot.rotation.x = on ? -0.32 : 0.32;
    },
  };
}

// ---------------------------------------------------------------------------
// Window and blinds
// ---------------------------------------------------------------------------

function buildWindow(M, root) {
  const { x0, x1, sill, top, blindsBottom } = WINDOW;
  const zIn = ROOM.z1; // inside face of the exterior wall
  const zFrame = zIn - 0.17;

  // Interior stool (sill) protruding into the room.
  root.add(boxFromBounds(x0 - 0.06, x1 + 0.06, sill - 0.025, sill, zIn - 0.1, zIn + 0.05, M.sill));

  // Aluminium single-hung frame.
  const f = 0.045;
  const fz0 = zFrame - 0.03, fz1 = zFrame + 0.03;
  root.add(boxFromBounds(x0, x0 + f, sill, top, fz0, fz1, M.windowFrame));
  root.add(boxFromBounds(x1 - f, x1, sill, top, fz0, fz1, M.windowFrame));
  root.add(boxFromBounds(x0, x1, sill, sill + f, fz0, fz1, M.windowFrame));
  root.add(boxFromBounds(x0, x1, top - f, top, fz0, fz1, M.windowFrame));
  const meet = (sill + top) / 2;
  root.add(boxFromBounds(x0, x1, meet - 0.03, meet + 0.03, fz0 - 0.02, fz1, M.windowFrame));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - f * 2, top - sill - f * 2), M.glass);
  glass.position.set((x0 + x1) / 2, (sill + top) / 2, zFrame);
  glass.renderOrder = 2;
  root.add(glass);

  // Mini-blinds: headrail, tilted slats (merged into one mesh), bottom rail, wand.
  const bz = zIn - 0.045;
  root.add(boxFromBounds(x0 + 0.02, x1 - 0.02, top - 0.055, top - 0.005, bz - 0.025, bz + 0.025, M.blinds));
  const slats = [];
  const slatDepth = 0.025;
  const spacing = 0.021;
  const tilt = THREE.MathUtils.degToRad(48);
  for (let y = top - 0.07; y > blindsBottom + 0.02; y -= spacing) {
    const g = new THREE.BoxGeometry(x1 - x0 - 0.05, 0.0012, slatDepth);
    g.rotateX(tilt);
    g.translate((x0 + x1) / 2, y, bz);
    slats.push(g);
  }
  const slatMesh = new THREE.Mesh(mergeGeometries(slats), M.blinds);
  slatMesh.castShadow = true;
  slatMesh.receiveShadow = true;
  root.add(slatMesh);
  root.add(boxFromBounds(x0 + 0.025, x1 - 0.025, blindsBottom - 0.006, blindsBottom + 0.008, bz - 0.014, bz + 0.014, M.blinds));
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 8), M.plasticWhite);
  wand.position.set(x1 - 0.08, top - 0.35, bz + 0.03);
  wand.castShadow = true;
  root.add(wand);
  // Ladder cords.
  for (const cx of [x0 + 0.2, x1 - 0.2]) {
    root.add(boxFromBounds(cx - 0.0015, cx + 0.0015, blindsBottom, top - 0.05, bz - 0.012, bz - 0.009, M.blinds, { cast: false }));
    root.add(boxFromBounds(cx - 0.0015, cx + 0.0015, blindsBottom, top - 0.05, bz + 0.009, bz + 0.012, M.blinds, { cast: false }));
  }
  return slatMesh;
}

// ---------------------------------------------------------------------------
// Room ceiling fixture + smoke detector
// ---------------------------------------------------------------------------

function buildCeilingFixtures(M, root) {
  const cx = 0, cz = -2.45;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 40), M.plasticWhite);
  base.position.set(cx, WALL_TOP - 0.0125, cz);
  root.add(base);
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: '#efe9dc',
    emissive: '#fff3dd',
    emissiveIntensity: 0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.96,
  });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lensMaterial);
  lens.scale.y = 0.42;
  lens.position.set(cx, WALL_TOP - 0.025, cz);
  root.add(lens);

  const detector = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.035, 32), M.plasticWhite);
  detector.position.set(0.75, WALL_TOP - 0.0175, -1.35);
  root.add(detector);
  const ledMaterial = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), ledMaterial);
  led.position.set(0.75 + 0.04, WALL_TOP - 0.036, -1.35);
  root.add(led);

  return { ceilingLens: lensMaterial, ceilingLensPosition: new THREE.Vector3(cx, WALL_TOP - 0.06, cz), smokeLed: ledMaterial };
}

// ---------------------------------------------------------------------------
// Hallway
// ---------------------------------------------------------------------------

function buildHallway(M, root, add) {
  const { x0, x1, z0, z1, ceiling } = HALL;
  const t = 0.15;
  add(boxFromBounds(x0, x1, -0.05, 0, z0, z1, M.vct, { cast: false }), VCT_TILE);
  add(boxFromBounds(x0 - t, x1 + t, 0, WALL_TOP, z1, z1 + t, M.wallHall), CMU_TILE);
  add(boxFromBounds(x0 - t, x0, 0, WALL_TOP, z0, z1, M.wallHall), CMU_TILE);
  add(boxFromBounds(x1, x1 + t, 0, WALL_TOP, z0, z1, M.wallHall), CMU_TILE);

  // Drop ceiling (2'x4' tiles).
  const tiles = ceilingTileTexture();
  tiles.repeat.set(2, 1);
  const ceil = boxFromBounds(x0, x1, ceiling, ceiling + 0.02, z0, z1, M.hallCeiling, { cast: false });
  add(ceil, 1.2192);

  // Cove base.
  add(boxFromBounds(x0, x1, 0, 0.1, z1 - 0.008, z1, M.coveBase, { cast: false }));
  add(boxFromBounds(x0, DOOR.x0 - 0.05, 0, 0.1, z0, z0 + 0.008, M.coveBase, { cast: false }));
  add(boxFromBounds(DOOR.x1 + 0.05, x1, 0, 0.1, z0, z0 + 0.008, M.coveBase, { cast: false }));

  // Fluorescent troffers. The two nearest our door work (they have real lights, see lighting.js);
  // the ones at both ends of the hall are dead, so the corridor falls off into darkness.
  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#f4f2ea', emissive: '#f6f4ea', emissiveIntensity: 1, roughness: 0.5 });
  const deadPanel = new THREE.MeshStandardMaterial({ color: '#cfccc2', roughness: 0.5 });
  const troffers = [
    { x: -5.7, on: false },
    { x: -2.6, on: true },
    { x: 0.86, on: true },
    { x: 4.3, on: false },
  ];
  for (const { x: tx, on } of troffers) {
    root.add(boxFromBounds(tx - 0.62, tx + 0.62, ceiling - 0.012, ceiling + 0.002, 0.85, 1.45, M.plasticWhite, { cast: false }));
    const lens = boxFromBounds(tx - 0.58, tx + 0.58, ceiling - 0.016, ceiling - 0.01, 0.89, 1.41, on ? panelMaterial : deadPanel, { cast: false, receive: false });
    root.add(lens);
  }

  // Neighbour doors (closed slabs with frames, plates and levers).
  for (const d of HALL_DOORS) {
    const north = d.side === 'north';
    const wallZ = north ? z0 : z1;
    const dir = north ? 1 : -1; // +z points into the hallway on the north wall
    root.add(boxFromBounds(d.x0 - 0.05, d.x0, 0, DOOR.height + 0.05, wallZ, wallZ + dir * 0.018, M.doorFrame));
    root.add(boxFromBounds(d.x1, d.x1 + 0.05, 0, DOOR.height + 0.05, wallZ, wallZ + dir * 0.018, M.doorFrame));
    root.add(boxFromBounds(d.x0 - 0.05, d.x1 + 0.05, DOOR.height, DOOR.height + 0.05, wallZ, wallZ + dir * 0.018, M.doorFrame));
    const slab = boxFromBounds(d.x0, d.x1, 0.016, DOOR.height, wallZ, wallZ + dir * 0.012, M.doorVeneer);
    applyWorldUVs(slab, 1.0, 'y');
    root.add(slab);
    const lx = north ? d.x0 + 0.07 : d.x1 - 0.07;
    root.add(boxFromBounds(lx - 0.06, lx + 0.06, 0.99, 1.01, wallZ + dir * 0.03, wallZ + dir * 0.05, M.metal));
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.08),
      new THREE.MeshStandardMaterial({
        map: labelTexture({ text: d.number, background: '#2b2a28', color: '#e8e2d2', border: '#b7ad95' }),
        roughness: 0.4,
      }),
    );
    plate.position.set((d.x0 + d.x1) / 2, 1.66, wallZ + dir * 0.0135);
    if (!north) plate.rotation.y = Math.PI;
    root.add(plate);
  }

  // Stairwell door at the west end with an EXIT sign above it.
  root.add(boxFromBounds(x0, x0 + 0.015, 0.016, DOOR.height, 0.65, 1.65, M.doorFrame));
  const exitMaterial = new THREE.MeshStandardMaterial({
    color: '#300805',
    emissive: '#ff2b1c',
    emissiveMap: labelTexture({ text: 'EXIT', width: 256, height: 128, background: '#000', color: '#fff', font: 'bold 84px Arial, sans-serif' }),
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  const exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.17, 0.32), [
    exitMaterial,
    M.plasticWhite,
    M.plasticWhite,
    M.plasticWhite,
    M.plasticWhite,
    M.plasticWhite,
  ]);
  exitSign.position.set(x0 + 0.03, 2.2, 1.15);
  root.add(exitSign);

  // Bulletin board opposite our door.
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.68), new THREE.MeshStandardMaterial({ map: corkboardTexture(), roughness: 0.9 }));
  board.position.set(0.65, 1.45, z1 - 0.01);
  board.rotation.y = Math.PI;
  root.add(board);

  return { hallPanels: panelMaterial, exitSign: exitMaterial, hallLightX: troffers.filter((t) => t.on).map((t) => t.x) };
}

// ---------------------------------------------------------------------------
// Exterior backdrop (seen through the window)
// ---------------------------------------------------------------------------

function buildExterior(root) {
  const group = new THREE.Group();
  group.name = 'exterior';
  root.add(group);
  const groundY = -3.4; // the room is on the second floor

  // Sky: vertical gradient driven by the lighting preset.
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#5f7fa8') },
      horizonColor: { value: new THREE.Color('#c7d3df') },
      brightness: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float brightness;
      varying vec2 vUv;
      void main() {
        float h = clamp((vUv.y - 0.12) / 0.7, 0.0, 1.0);
        vec3 c = mix(horizonColor, topColor, pow(h, 0.65));
        gl_FragColor = vec4(c * brightness, 1.0);
      }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), skyMaterial);
  sky.position.set(0, 30, -70);
  group.add(sky);

  const facadeTex = facadeTextures();
  const facadeMaterial = new THREE.MeshBasicMaterial({ map: facadeTex.map, color: '#ffffff' });
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), facadeMaterial);
  facade.position.set(-2, groundY + 9, -26);
  group.add(facade);
  const facadeLightsMaterial = new THREE.MeshBasicMaterial({
    map: facadeTex.lights,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const facadeLights = new THREE.Mesh(facade.geometry, facadeLightsMaterial);
  facadeLights.position.copy(facade.position);
  facadeLights.position.z += 0.05;
  group.add(facadeLights);

  const groundMaterial = new THREE.MeshBasicMaterial({ color: '#4c4a3f' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, groundY, -36);
  group.add(ground);

  // Path / lawn variation so the ground isn't a flat colour.
  const pathMaterial = new THREE.MeshBasicMaterial({ color: '#6c6a62' });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(120, 2.2), pathMaterial);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, groundY + 0.01, -15);
  group.add(path);

  const treeMaterial = new THREE.MeshBasicMaterial({ color: '#1d1a17', alphaMap: treeTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  const tree = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), treeMaterial);
  tree.position.set(-2.4, groundY + 6.5, -12);
  group.add(tree);

  // Street lamp on the path.
  const poleMaterial = new THREE.MeshBasicMaterial({ color: '#202020' });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 8), poleMaterial);
  pole.position.set(3.2, groundY + 2.6, -14);
  group.add(pole);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
  const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), lampMaterial);
  lampHead.position.set(3.2, groundY + 5.3, -14);
  group.add(lampHead);

  group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  return {
    sky: skyMaterial,
    facade: facadeMaterial,
    facadeLights: facadeLightsMaterial,
    ground: groundMaterial,
    path: pathMaterial,
    tree: treeMaterial,
    pole: poleMaterial,
    lamp: lampMaterial,
  };
}
