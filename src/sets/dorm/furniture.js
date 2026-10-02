/**
 * Dorm furniture and props, built from simple primitives.
 *
 * Each builder works in a local frame (width along X, depth along Z, front at +Z,
 * origin at the floor centre of the footprint) and is then rotated/placed using
 * the footprints in layout.js.
 */
import * as THREE from 'three';
import { boxFromBounds, applyWorldUVs, softBox, drapedCloth } from '../../lib/geometry.js';
import { clockTexture, laptopScreenTexture, posterTexture, calendarTexture, corkboardTexture, rugTexture } from '../../lib/textures.js';
import { mulberry32 } from '../../lib/noise.js';
import { FURNITURE as F, BED_DECK_HEIGHT, MATTRESS_THICKNESS, ROOM } from './layout.js';

const deg = THREE.MathUtils.degToRad;

/** Place a local-frame group on a footprint. `front` = world direction the front faces. */
function placeOnFootprint(group, f, front) {
  const yaw = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[front];
  group.position.set((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
  group.rotation.y = yaw;
  return group;
}

/** Width/depth of a footprint in the local frame for a given facing. */
function localSize(f, front) {
  const sx = Math.abs(f.x1 - f.x0), sz = Math.abs(f.z1 - f.z0);
  return front === '+z' || front === '-z' ? { w: sx, d: sz } : { w: sz, d: sx };
}

/** Recursively enable shadows + world-space UVs for laminate pieces. */
function finish(group, uvTile = 1) {
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !o.userData.noShadow;
    o.receiveShadow = true;
    if (o.userData.woodGrain) applyWorldUVs(o, uvTile, o.userData.woodGrain);
  });
  return group;
}

function wood(mesh, grain) {
  mesh.userData.woodGrain = grain;
  return mesh;
}

export function buildFurniture(M, root) {
  const handles = {};

  // --- Narrator side (left) ---
  const desk = buildDesk(M, F.narratorDesk, '+x', { drawersOnLeft: false });
  root.add(desk);
  root.add(buildChair(M, F.narratorChair));
  root.add(buildFridge(M, F.fridge));
  root.add(buildWardrobe(M, F.narratorWardrobe, '-z'));
  const narratorBed = buildBed(M, F.narratorBed, { comforter: M.comforterNarrator, rumple: 0.018, seed: 4 });
  root.add(narratorBed.group);

  // --- Roommate side (right / deep) ---
  root.add(buildDesk(M, F.roommateDesk, '+z', { drawersOnLeft: true }));
  root.add(buildChair(M, F.roommateChair));
  const divider = buildWardrobe(M, F.roommateWardrobe, '-z');
  root.add(divider);
  root.add(buildDresser(M, F.roommateDresser, '-x'));
  const roommateBed = buildBed(M, F.roommateBed, {
    comforter: M.comforterRoommate,
    rumple: 0.045,
    seed: 9,
    messy: true,
    occupiedLumps: [
      { x: 0.06, z: -0.28, rx: 0.24, rz: 0.48, h: 0.15 },
      { x: 0.1, z: 0.42, rx: 0.2, rz: 0.42, h: 0.1 },
      { x: -0.02, z: -0.82, rx: 0.17, rz: 0.16, h: 0.09 },
    ],
  });
  root.add(roommateBed.group);
  handles.roommateBed = roommateBed;

  // --- Props ---
  Object.assign(handles, buildDeskProps(M, root));
  Object.assign(handles, buildRoomProps(M, root));
  handles.dividerBack = divider;

  return handles;
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

function buildDesk(M, f, front, { drawersOnLeft }) {
  const { w, d } = localSize(f, front);
  const h = f.height;
  const g = new THREE.Group();
  const top = 0.03;
  const panel = 0.022;
  // Top
  g.add(wood(boxFromBounds(-w / 2, w / 2, h - top, h, -d / 2, d / 2, M.laminate), 'x'));
  // Pedestal with three drawers on one side, plain panel leg on the other.
  const pedW = 0.4;
  const px0 = drawersOnLeft ? -w / 2 : w / 2 - pedW;
  const px1 = px0 + pedW;
  g.add(wood(boxFromBounds(px0, px1, 0.02, h - top, -d / 2, d / 2 - 0.01, M.laminate), 'y'));
  g.add(boxFromBounds(px0 + 0.01, px1 - 0.01, 0, 0.02, -d / 2 + 0.02, d / 2 - 0.04, M.coveBase));
  const drawerH = (h - top - 0.04) / 3;
  for (let i = 0; i < 3; i++) {
    const y0 = 0.03 + i * drawerH;
    g.add(wood(boxFromBounds(px0 + 0.012, px1 - 0.012, y0 + 0.006, y0 + drawerH - 0.006, d / 2 - 0.01, d / 2 + 0.008, M.laminateDark), 'x'));
    g.add(boxFromBounds(-0.05 + (px0 + px1) / 2, 0.05 + (px0 + px1) / 2, y0 + drawerH * 0.72, y0 + drawerH * 0.72 + 0.012, d / 2 + 0.008, d / 2 + 0.026, M.metal));
  }
  // Leg panel + modesty panel
  const lx = drawersOnLeft ? w / 2 - panel : -w / 2;
  g.add(wood(boxFromBounds(lx, lx + panel, 0, h - top, -d / 2, d / 2 - 0.02, M.laminate), 'y'));
  g.add(wood(boxFromBounds(-w / 2, w / 2, 0.3, h - top, -d / 2 + 0.02, -d / 2 + 0.04, M.laminate), 'x'));
  placeOnFootprint(g, f, front);
  return finish(g);
}

// ---------------------------------------------------------------------------
// Chair (wooden sled-base dorm chair)
// ---------------------------------------------------------------------------

function buildChair(M, c) {
  const g = new THREE.Group();
  const seatH = 0.46;
  const sw = 0.44, sd = 0.42;
  const seat = new THREE.Mesh(softBox(sw, 0.035, sd, { radius: 0.012, segments: 4 }), M.chairWood);
  seat.position.y = seatH;
  g.add(wood(seat, 'z'));
  // Back: two posts + curved-ish back panel
  for (const sx of [-1, 1]) {
    g.add(wood(boxFromBounds(sx * sw / 2 - 0.02 * sx - 0.012, sx * sw / 2 - 0.02 * sx + 0.012, seatH, 0.86, -sd / 2 + 0.005, -sd / 2 + 0.035, M.chairWood), 'y'));
  }
  const back = new THREE.Mesh(softBox(sw - 0.02, 0.17, 0.022, { radius: 0.008, segments: 4 }), M.chairWood);
  back.position.set(0, 0.76, -sd / 2 + 0.02);
  back.rotation.x = deg(-6);
  g.add(wood(back, 'x'));
  g.add(wood(boxFromBounds(-sw / 2 + 0.03, sw / 2 - 0.03, 0.56, 0.6, -sd / 2 + 0.01, -sd / 2 + 0.03, M.chairWood), 'x'));
  // Legs + sled runners
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(wood(boxFromBounds(sx * (sw / 2 - 0.035) - 0.014, sx * (sw / 2 - 0.035) + 0.014, 0.02, seatH, sz * (sd / 2 - 0.04) - 0.014, sz * (sd / 2 - 0.04) + 0.014, M.chairWood), 'y'));
    }
    g.add(wood(boxFromBounds(sx * (sw / 2 - 0.035) - 0.016, sx * (sw / 2 - 0.035) + 0.016, 0, 0.025, -sd / 2 + 0.01, sd / 2 - 0.01, M.chairWood), 'z'));
  }
  g.position.set(c.x, 0, c.z);
  g.rotation.y = deg(c.facing);
  return finish(g);
}

// ---------------------------------------------------------------------------
// Wardrobe / dresser / fridge
// ---------------------------------------------------------------------------

function buildWardrobe(M, f, front) {
  const { w, d } = localSize(f, front);
  const h = f.height;
  const g = new THREE.Group();
  const t = 0.02;
  // Carcass: sides, top, plinth, hardboard back
  g.add(wood(boxFromBounds(-w / 2, -w / 2 + t, 0, h, -d / 2, d / 2, M.laminate), 'y'));
  g.add(wood(boxFromBounds(w / 2 - t, w / 2, 0, h, -d / 2, d / 2, M.laminate), 'y'));
  g.add(wood(boxFromBounds(-w / 2, w / 2, h - t, h, -d / 2, d / 2, M.laminate), 'x'));
  g.add(wood(boxFromBounds(-w / 2 - 0.01, w / 2 + 0.01, h, h + 0.035, -d / 2 - 0.01, d / 2 + 0.012, M.laminateDark), 'x'));
  g.add(boxFromBounds(-w / 2 + t, w / 2 - t, 0, 0.08, -d / 2 + 0.02, d / 2 - 0.03, M.coveBase));
  g.add(boxFromBounds(-w / 2 + t, w / 2 - t, 0.08, h - t, -d / 2, -d / 2 + 0.006, M.hardboard));
  // Two doors with a reveal between them + bar pulls
  const doorW = (w - 0.006) / 2;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 : 0.003;
    g.add(wood(boxFromBounds(x0, x0 + doorW, 0.085, h - 0.005, d / 2 - 0.002, d / 2 + 0.018, M.laminate), 'y'));
    const px = s < 0 ? -0.04 : 0.04;
    g.add(boxFromBounds(px - 0.006, px + 0.006, h * 0.45, h * 0.45 + 0.16, d / 2 + 0.018, d / 2 + 0.04, M.metal));
  }
  placeOnFootprint(g, f, front);
  return finish(g);
}

function buildDresser(M, f, front) {
  const { w, d } = localSize(f, front);
  const h = f.height;
  const g = new THREE.Group();
  g.add(wood(boxFromBounds(-w / 2, w / 2, 0.05, h, -d / 2, d / 2 - 0.01, M.laminate), 'x'));
  g.add(boxFromBounds(-w / 2 + 0.02, w / 2 - 0.02, 0, 0.05, -d / 2 + 0.02, d / 2 - 0.04, M.coveBase));
  const dh = (h - 0.08) / 3;
  for (let i = 0; i < 3; i++) {
    const y0 = 0.055 + i * dh;
    g.add(wood(boxFromBounds(-w / 2 + 0.012, w / 2 - 0.012, y0 + 0.006, y0 + dh - 0.006, d / 2 - 0.01, d / 2 + 0.008, M.laminateDark), 'x'));
    g.add(boxFromBounds(-0.07, 0.07, y0 + dh * 0.6, y0 + dh * 0.6 + 0.012, d / 2 + 0.008, d / 2 + 0.026, M.metal));
  }
  placeOnFootprint(g, f, front);
  return finish(g);
}

function buildFridge(M, f) {
  const front = '+x';
  const { w, d } = localSize(f, front);
  const g = new THREE.Group();
  const body = new THREE.Mesh(softBox(w, f.height, d, { radius: 0.015, segments: 3 }), M.plasticBlack);
  body.position.y = f.height / 2;
  g.add(body);
  g.add(boxFromBounds(-w / 2 + 0.01, w / 2 - 0.01, f.height - 0.2, f.height - 0.196, d / 2 - 0.004, d / 2 + 0.002, M.darkMetal));
  g.add(boxFromBounds(w / 2 - 0.06, w / 2 - 0.04, 0.35, 0.7, d / 2, d / 2 + 0.03, M.darkMetal));
  // Microwave on top.
  const mw = new THREE.Mesh(softBox(0.44, 0.25, 0.34, { radius: 0.01, segments: 3 }), M.plasticWhite);
  mw.position.set(0, f.height + 0.125, -0.02);
  g.add(mw);
  g.add(boxFromBounds(-0.2, 0.08, f.height + 0.04, f.height + 0.21, 0.15, 0.152, M.plasticBlack));
  placeOnFootprint(g, f, front);
  return finish(g);
}

// ---------------------------------------------------------------------------
// Twin XL bed
// ---------------------------------------------------------------------------

function buildBed(M, f, { comforter, rumple, seed, messy = false, occupiedLumps = null }) {
  // Local frame: X across the bed, Z along it, head at -Z (against the window wall), foot at +Z.
  const w = Math.abs(f.x1 - f.x0);
  const l = Math.abs(f.z1 - f.z0);
  const g = new THREE.Group();
  const t = 0.035;
  const deck = BED_DECK_HEIGHT;
  // Headboard / footboard panels with posts
  g.add(wood(boxFromBounds(-w / 2, w / 2, 0.06, 0.98, -l / 2, -l / 2 + t, M.laminate), 'x'));
  g.add(wood(boxFromBounds(-w / 2, w / 2, 0.06, 0.74, l / 2 - t, l / 2, M.laminate), 'x'));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const top = sz < 0 ? 1.0 : 0.76;
      g.add(wood(boxFromBounds(sx * w / 2 - 0.025, sx * w / 2 + 0.025, 0, top, sz * l / 2 - 0.025, sz * l / 2 + 0.025, M.laminateDark), 'y'));
    }
    // Side rails
    g.add(wood(boxFromBounds(sx * w / 2 - 0.02, sx * w / 2 + 0.02, deck - 0.12, deck, -l / 2 + t, l / 2 - t, M.laminate), 'z'));
  }
  g.add(boxFromBounds(-w / 2 + 0.02, w / 2 - 0.02, deck - 0.025, deck, -l / 2 + t, l / 2 - t, M.hardboard));

  // Mattress with a fitted sheet.
  const mattressW = w - 0.05, mattressL = l - t * 2 - 0.01;
  const mattress = new THREE.Mesh(softBox(mattressW, MATTRESS_THICKNESS, mattressL, { radius: 0.035, segments: 10, lump: 0.006, seed }), M.sheetWhite);
  mattress.position.y = deck + MATTRESS_THICKNESS / 2;
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  g.add(mattress);
  const mattressTop = deck + MATTRESS_THICKNESS;

  // Pillow(s) at the head.
  const pillow = new THREE.Mesh(softBox(0.62, 0.13, 0.4, { radius: 0.06, segments: 8, sag: 0.03, lump: 0.01, seed: seed + 1 }), M.pillow);
  pillow.position.set(messy ? 0.05 : 0, mattressTop + 0.055, -l / 2 + t + 0.27);
  pillow.rotation.y = messy ? deg(9) : deg(-2);
  pillow.rotation.z = messy ? deg(4) : 0;
  pillow.castShadow = pillow.receiveShadow = true;
  g.add(pillow);

  // Comforter draped from the fold line to the foot.
  const fold = 0.5; // distance from the head end where the comforter starts
  const coverL = mattressL - fold;
  const makeCover = (lumps) => {
    const geo = drapedCloth({ width: mattressW + 0.07, length: coverL, drop: 0.22, footDrop: 0.0, rumple, seed, lumps, foldBack: 0.12 });
    const mesh = new THREE.Mesh(geo, comforter);
    mesh.position.set(0, mattressTop + 0.012, -l / 2 + t + fold + coverL / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (messy) mesh.rotation.y = deg(2.5);
    return mesh;
  };
  const coverEmpty = makeCover([]);
  g.add(coverEmpty);
  let coverOccupied = null;
  if (occupiedLumps) {
    coverOccupied = makeCover(occupiedLumps);
    coverOccupied.visible = false;
    g.add(coverOccupied);
  }

  g.position.set((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
  finish(g);
  return {
    group: g,
    setOccupied(occupied) {
      if (!coverOccupied) return;
      coverOccupied.visible = occupied;
      coverEmpty.visible = !occupied;
    },
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

function buildDeskProps(M, root) {
  const handles = {};
  const deskTop = F.narratorDesk.height;

  // Desk lamp (narrator's desk, back corner nearest the door).
  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.022, 32), M.plasticBlack);
  lampBase.position.y = 0.011;
  lamp.add(lampBase);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 10), M.darkMetal);
  arm1.position.set(0.03, 0.19, 0);
  arm1.rotation.z = deg(-12);
  lamp.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10), M.darkMetal);
  arm2.position.set(0.14, 0.4, 0);
  arm2.rotation.z = deg(-62);
  lamp.add(arm2);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.13, 32, 1, true), M.plasticBlack);
  shade.material = M.plasticBlack.clone();
  shade.material.side = THREE.DoubleSide;
  shade.position.set(0.25, 0.42, 0);
  shade.rotation.z = deg(18);
  lamp.add(shade);
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd59a', emissiveIntensity: 0, roughness: 0.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), bulbMaterial);
  bulb.position.set(0.255, 0.4, 0);
  lamp.add(bulb);
  lamp.traverse((o) => (o.castShadow = o.isMesh));
  bulb.castShadow = false;
  // Lamp sits near the wall, arm reaching toward the room (+x).
  lamp.position.set(-1.7, deskTop, -0.9);
  root.add(lamp);
  handles.lampBulb = bulbMaterial;
  handles.lampLightPosition = new THREE.Vector3(-1.7 + 0.25, deskTop + 0.38, -0.9);
  handles.lampTarget = new THREE.Vector3(-1.48, deskTop, -1.15);

  // Laptop: base + screen tilted back, display facing the chair (+x).
  const laptop = new THREE.Group();
  laptop.add(boxFromBounds(-0.115, 0.115, 0, 0.016, -0.165, 0.165, M.plasticGrey));
  const lid = new THREE.Group();
  lid.position.set(-0.115, 0.016, 0);
  lid.rotation.z = deg(18); // tilted back, away from the chair
  lid.add(boxFromBounds(-0.008, 0, 0, 0.22, -0.165, 0.165, M.plasticGrey));
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: '#050608',
    emissive: '#ffffff',
    emissiveMap: laptopScreenTexture(),
    emissiveIntensity: 0,
    roughness: 0.25,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), screenMaterial);
  screen.rotation.y = Math.PI / 2;
  screen.position.set(0.0012, 0.112, 0);
  lid.add(screen);
  laptop.add(lid);
  laptop.position.set(-1.5, deskTop, -1.28);
  laptop.rotation.y = deg(-6);
  laptop.traverse((o) => (o.castShadow = o.isMesh));
  root.add(laptop);
  handles.laptopScreen = screenMaterial;
  handles.laptopLightPosition = new THREE.Vector3(-1.38, deskTop + 0.14, -1.28);

  // Mug + notebook + pens.
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 24), M.ceramic);
  mug.position.set(-1.42, deskTop + 0.0475, -1.58);
  mug.castShadow = true;
  root.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), M.ceramic);
  handle.position.set(-1.42, deskTop + 0.05, -1.62);
  handle.rotation.set(0, Math.PI / 2, -Math.PI / 2);
  root.add(handle);
  const notebook = boxFromBounds(-0.105, 0.105, 0, 0.012, -0.15, 0.15, M.fabricOlive);
  notebook.position.set(-1.33, deskTop + 0.006, -1.05);
  notebook.rotation.y = deg(14);
  root.add(notebook);
  const pens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16, 1, true), M.plasticBlack);
  pens.material = M.plasticBlack.clone();
  pens.material.side = THREE.DoubleSide;
  pens.position.set(-1.72, deskTop + 0.05, -1.65);
  root.add(pens);

  // Wall shelf above the near half of the desk, with books.
  const shelfY = 1.38;
  root.add(boxFromBounds(ROOM.x0, ROOM.x0 + 0.24, shelfY - 0.022, shelfY, -0.8, -1.4, M.laminate));
  const bookColors = ['#6b5a4a', '#55606b', '#8a7d68', '#3f4a3f', '#7a4c3f', '#a49a86', '#4b4a55', '#6f6656'];
  const rand = mulberry32(77);
  let bz = -0.86;
  for (let i = 0; i < 11 && bz > -1.3; i++) {
    const bw = 0.025 + rand() * 0.025, bh = 0.18 + rand() * 0.07, bd = 0.15 + rand() * 0.05;
    const mat = new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.8 });
    const book = boxFromBounds(ROOM.x0 + 0.02, ROOM.x0 + 0.02 + bd, shelfY, shelfY + bh, bz - bw, bz, mat);
    if (i === 7) book.rotation.x = deg(-12);
    root.add(book);
    bz -= bw + 0.003;
  }
  // Cork board above the desk.
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.44), new THREE.MeshStandardMaterial({ map: corkboardTexture(), roughness: 0.9 }));
  cork.position.set(ROOM.x0 + 0.012, 1.76, -1.12);
  cork.rotation.y = Math.PI / 2;
  root.add(cork);

  // Alarm clock on the roommate's desk, facing into the room.
  const clockMaterial = new THREE.MeshStandardMaterial({
    color: '#050404',
    emissive: '#ffffff',
    emissiveMap: clockTexture('3:12'),
    emissiveIntensity: 1,
    roughness: 0.3,
  });
  const clockBody = new THREE.Mesh(softBox(0.14, 0.065, 0.07, { radius: 0.012, segments: 3 }), M.plasticBlack);
  clockBody.position.set(0.38, F.roommateDesk.height + 0.0325, -4.72);
  clockBody.rotation.y = deg(24); // angled between the room and the roommate's bed
  clockBody.castShadow = true;
  root.add(clockBody);
  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.045), clockMaterial);
  clockFace.position.set(0, 0.002, 0.0355);
  clockBody.add(clockFace);
  handles.clock = clockMaterial;

  // A few things on the roommate's desk.
  const stack = boxFromBounds(-0.12, 0.12, 0, 0.06, -0.16, 0.16, M.paper);
  stack.position.set(-0.25, F.roommateDesk.height + 0.03, -4.88);
  stack.rotation.y = deg(-8);
  root.add(stack);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), M.metal);
  can.position.set(0.12, F.roommateDesk.height + 0.06, -4.7);
  root.add(can);

  return handles;
}

function buildRoomProps(M, root) {
  const handles = {};

  // Rug
  const r = F.rug;
  const rug = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 0.008, r.z0 - r.z1), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.position.set((r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2);
  rug.receiveShadow = true;
  root.add(rug);

  // Backpack slumped against the narrator's desk.
  const pack = new THREE.Mesh(softBox(0.3, 0.42, 0.18, { radius: 0.06, segments: 6, lump: 0.02, seed: 21 }), M.fabricDark);
  pack.position.set(-1.12, 0.2, -2.62);
  pack.rotation.set(deg(-8), deg(70), deg(6));
  pack.castShadow = pack.receiveShadow = true;
  root.add(pack);

  // Trash can and laundry hamper.
  const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.34, 24, 1, true), M.plasticGrey.clone());
  trash.material.side = THREE.DoubleSide;
  trash.position.set(F.trash.x, 0.17, F.trash.z);
  trash.castShadow = true;
  root.add(trash);
  const hamper = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.58, 24, 1, true), M.fabricOlive.clone());
  hamper.material.side = THREE.DoubleSide;
  hamper.position.set(F.hamper.x, 0.29, F.hamper.z);
  hamper.castShadow = true;
  root.add(hamper);
  const laundry = new THREE.Mesh(softBox(0.36, 0.12, 0.34, { radius: 0.05, segments: 6, lump: 0.05, seed: 3 }), M.fabricDark);
  laundry.position.set(F.hamper.x, 0.55, F.hamper.z);
  root.add(laundry);

  // Under-bed storage bins (narrator), darkness under the roommate's bed.
  for (const z of [-3.55, -4.25]) {
    const bin = boxFromBounds(-1.62, -0.98, 0, 0.3, z - 0.28, z + 0.28, M.binClear);
    bin.castShadow = false;
    root.add(bin);
    root.add(boxFromBounds(-1.64, -0.96, 0.3, 0.32, z - 0.3, z + 0.3, M.plasticWhite));
  }

  // Poster above the narrator's bed.
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.85 }));
  poster.position.set(ROOM.x0 + 0.006, 1.62, -4.1);
  poster.rotation.y = Math.PI / 2;
  root.add(poster);

  // Calendar taped to the back of the divider wardrobe (faces the entrance).
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.9 }));
  cal.position.set(1.42, 1.42, F.roommateWardrobe.z0 + 0.008);
  root.add(cal);

  // Outlets.
  for (const [x, z, yaw] of [
    [ROOM.x0 + 0.004, -1.65, Math.PI / 2],
    [ROOM.x1 - 0.004, -3.0, -Math.PI / 2],
    [-0.9, ROOM.z1 + 0.004, 0],
  ]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.115, 0.006), M.switchPlate);
    plate.position.set(x, 0.38, z);
    plate.rotation.y = yaw;
    root.add(plate);
  }

  // A towel hung over the end of the roommate's bed footboard.
  root.add(boxFromBounds(1.0, 1.58, 0.5, 0.775, F.roommateBed.z0 - 0.048, F.roommateBed.z0 + 0.012, M.fabricOlive));

  return handles;
}
