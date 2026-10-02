/**
 * Furniture and props for the reference-look room.
 * Builders work in a local frame (width along X, depth along Z, front at +Z)
 * and are placed on the footprints from layout.js.
 */
import * as THREE from 'three';
import { boxFromBounds, applyWorldUVs, softBox, drapedCloth } from '../../lib/geometry.js';
import { photoCorkboardTexture, darkPosterTexture } from '../../lib/textures.js';
import { mulberry32 } from '../../lib/noise.js';
import { ROOM, FURNITURE as F, BED_DECK, MATTRESS } from './layout.js';

const deg = THREE.MathUtils.degToRad;

function place(group, f, front) {
  const yaw = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[front];
  group.position.set((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
  group.rotation.y = yaw;
  return group;
}

function size(f, front) {
  const sx = Math.abs(f.x1 - f.x0), sz = Math.abs(f.z1 - f.z0);
  return front === '+z' || front === '-z' ? { w: sx, d: sz } : { w: sz, d: sx };
}

const grain = (mesh, axis) => {
  mesh.userData.grain = axis;
  return mesh;
};

function finish(group) {
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.userData.grain) applyWorldUVs(o, 1, o.userData.grain);
  });
  return group;
}

export function buildFurniture(M, root) {
  root.add(buildDesk(M, F.leftDesk, '+x', true));
  root.add(buildDesk(M, F.rightDesk, '-x', true));
  root.add(buildChair(M, F.leftChair));
  root.add(buildChair(M, F.rightChair));
  root.add(buildWardrobe(M, F.wardrobe));
  root.add(buildBed(M, F.leftBed, M.comforterCharcoal, 3));
  root.add(buildBed(M, F.rightBed, M.comforterGreen, 8));
  buildUnderBed(M, root);
  buildDeskProps(M, root);
  buildWallDecor(M, root);
  return {};
}

// ---------------------------------------------------------------------------

function buildDesk(M, f, front, drawersNearDoor) {
  const { w, d } = size(f, front);
  const h = f.height;
  const g = new THREE.Group();
  g.add(grain(boxFromBounds(-w / 2, w / 2, h - 0.035, h, -d / 2, d / 2 + 0.01, M.oak), 'x'));
  // Local +X points away from the door for a desk facing +x, toward it for one facing -x.
  const pedW = 0.42;
  const doorSideIsPlus = front === '-x';
  const pedOnPlus = drawersNearDoor ? doorSideIsPlus : !doorSideIsPlus;
  const px0 = pedOnPlus ? w / 2 - pedW : -w / 2;
  const px1 = px0 + pedW;
  g.add(grain(boxFromBounds(px0, px1, 0.03, h - 0.035, -d / 2, d / 2 - 0.012, M.oak), 'y'));
  g.add(boxFromBounds(px0 + 0.015, px1 - 0.015, 0, 0.03, -d / 2 + 0.03, d / 2 - 0.05, M.plasticBlack));
  const dh = (h - 0.035 - 0.05) / 3;
  for (let i = 0; i < 3; i++) {
    const y0 = 0.04 + i * dh;
    g.add(grain(boxFromBounds(px0 + 0.012, px1 - 0.012, y0 + 0.008, y0 + dh - 0.006, d / 2 - 0.012, d / 2 + 0.01, M.oakDark), 'x'));
    g.add(boxFromBounds((px0 + px1) / 2 - 0.06, (px0 + px1) / 2 + 0.06, y0 + dh * 0.7, y0 + dh * 0.7 + 0.014, d / 2 + 0.01, d / 2 + 0.03, M.blackMetal));
  }
  // Leg panel on the other end, modesty panel and a shallow pencil drawer.
  const lx = pedOnPlus ? -w / 2 : w / 2 - 0.03;
  g.add(grain(boxFromBounds(lx, lx + 0.03, 0, h - 0.035, -d / 2, d / 2 - 0.02, M.oak), 'y'));
  g.add(grain(boxFromBounds(-w / 2, w / 2, 0.32, h - 0.035, -d / 2 + 0.01, -d / 2 + 0.03, M.oak), 'x'));
  const kx0 = pedOnPlus ? -w / 2 + 0.05 : px1 + 0.02;
  const kx1 = pedOnPlus ? px0 - 0.02 : w / 2 - 0.05;
  g.add(grain(boxFromBounds(kx0, kx1, h - 0.12, h - 0.04, d / 2 - 0.03, d / 2, M.oakDark), 'x'));
  place(g, f, front);
  return finish(g);
}

function buildChair(M, c) {
  const g = new THREE.Group();
  const sw = 0.46, sd = 0.44, seat = 0.44;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const top = sz < 0 ? 0.9 : seat;
      g.add(grain(boxFromBounds(sx * (sw / 2) - 0.02, sx * (sw / 2) + 0.02, 0, top, sz * (sd / 2) - 0.02, sz * (sd / 2) + 0.02, M.oak), 'y'));
    }
    // Side stretchers.
    g.add(grain(boxFromBounds(sx * (sw / 2) - 0.015, sx * (sw / 2) + 0.015, 0.14, 0.17, -sd / 2, sd / 2, M.oak), 'z'));
  }
  g.add(grain(boxFromBounds(-sw / 2, sw / 2, seat - 0.05, seat, -sd / 2, sd / 2, M.oak), 'x'));
  const cushion = new THREE.Mesh(softBox(sw - 0.02, 0.06, sd - 0.03, { radius: 0.02, segments: 5, sag: 0.008 }), M.upholstery);
  cushion.position.set(0, seat + 0.025, 0.01);
  g.add(cushion);
  // Back: upholstered panel between the rear posts + top rail.
  const back = new THREE.Mesh(softBox(sw - 0.04, 0.3, 0.045, { radius: 0.015, segments: 4 }), M.upholstery);
  back.position.set(0, 0.69, -sd / 2 + 0.005);
  back.rotation.x = deg(-4);
  g.add(back);
  g.add(grain(boxFromBounds(-sw / 2, sw / 2, 0.86, 0.9, -sd / 2 - 0.02, -sd / 2 + 0.02, M.oak), 'x'));
  g.add(grain(boxFromBounds(-sw / 2, sw / 2, 0.5, 0.53, -sd / 2 - 0.018, -sd / 2 + 0.018, M.oak), 'x'));
  g.position.set(c.x, 0, c.z);
  g.rotation.y = deg(c.facing);
  return finish(g);
}

function buildWardrobe(M, f) {
  const front = '-x';
  const { w, d } = size(f, front);
  const h = f.height;
  const g = new THREE.Group();
  const t = 0.022;
  g.add(grain(boxFromBounds(-w / 2, -w / 2 + t, 0, h, -d / 2, d / 2, M.oak), 'y'));
  g.add(grain(boxFromBounds(w / 2 - t, w / 2, 0, h, -d / 2, d / 2, M.oak), 'y'));
  g.add(grain(boxFromBounds(-w / 2 - 0.01, w / 2 + 0.01, h - 0.03, h, -d / 2 - 0.01, d / 2 + 0.015, M.oakDark), 'x'));
  g.add(boxFromBounds(-w / 2 + t, w / 2 - t, 0, 0.08, -d / 2 + 0.02, d / 2 - 0.03, M.plasticBlack));
  g.add(boxFromBounds(-w / 2 + t, w / 2 - t, 0.08, h - t, -d / 2, -d / 2 + 0.008, M.oakDark));
  const doorW = (w - 0.006) / 2;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 : 0.003;
    g.add(grain(boxFromBounds(x0, x0 + doorW, 0.085, h - 0.035, d / 2 - 0.002, d / 2 + 0.018, M.oak), 'y'));
    // Recessed panel lines.
    g.add(boxFromBounds(x0 + 0.06, x0 + doorW - 0.06, 0.2, h - 0.15, d / 2 + 0.018, d / 2 + 0.021, M.oakDark));
    const hx = s < 0 ? -0.035 : 0.035;
    g.add(boxFromBounds(hx - 0.007, hx + 0.007, 0.93, 1.1, d / 2 + 0.02, d / 2 + 0.045, M.blackMetal));
  }
  // Black storage box on top.
  const box = new THREE.Mesh(softBox(0.5, 0.27, 0.42, { radius: 0.012, segments: 3 }), M.plasticDark);
  box.position.set(-0.06, h + 0.135, -0.02);
  box.rotation.y = deg(3);
  g.add(box);
  g.add(boxFromBounds(-0.26, 0.2, h + 0.265, h + 0.285, -0.22, 0.2, M.plasticBlack));
  place(g, f, front);
  return finish(g);
}

/** Wooden bed with storage space underneath: tall head posts at the window wall, low foot posts. */
function buildBed(M, f, comforter, seed) {
  const w = Math.abs(f.x1 - f.x0);
  const l = Math.abs(f.z1 - f.z0);
  const g = new THREE.Group();
  const p = 0.035; // half post size
  const headH = 1.1, footH = 0.84; // local -z = head (window wall)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const postH = sz < 0 ? headH : footH;
      g.add(grain(boxFromBounds(sx * (w / 2 - p) - p, sx * (w / 2 - p) + p, 0, postH, sz * (l / 2 - p) - p, sz * (l / 2 - p) + p, M.oak), 'y'));
    }
    // Side rails at deck height.
    g.add(grain(boxFromBounds(sx * (w / 2 - p) - 0.022, sx * (w / 2 - p) + 0.022, BED_DECK - 0.15, BED_DECK, -l / 2 + p, l / 2 - p, M.oak), 'z'));
  }
  const rail = (z, y0, y1) => g.add(grain(boxFromBounds(-w / 2 + p, w / 2 - p, y0, y1, z - 0.022, z + 0.022, M.oak), 'x'));
  // Head: top rail + panel; foot: one deep board at deck level and a low stretcher.
  const zh = -(l / 2 - p), zf = l / 2 - p;
  rail(zh, 0.93, 1.03);
  rail(zh, 0.3, 0.37);
  rail(zf, BED_DECK - 0.04, BED_DECK + 0.14);
  rail(zf, 0.32, 0.39);
  g.add(grain(boxFromBounds(-w / 2 + p, w / 2 - p, BED_DECK - 0.1, 0.93, zh - 0.012, zh + 0.012, M.oak), 'x'));
  g.add(boxFromBounds(-w / 2 + p, w / 2 - p, BED_DECK - 0.03, BED_DECK, -l / 2 + p, l / 2 - p, M.oakDark));

  const mw = w - 2 * p - 0.02, ml = l - 2 * p - 0.02;
  const mattress = new THREE.Mesh(softBox(mw, MATTRESS, ml, { radius: 0.04, segments: 10, lump: 0.006, seed }), M.sheet);
  mattress.position.y = BED_DECK + MATTRESS / 2;
  g.add(mattress);
  const top = BED_DECK + MATTRESS;
  const pillow = new THREE.Mesh(softBox(0.62, 0.13, 0.4, { radius: 0.06, segments: 8, sag: 0.03, lump: 0.01, seed: seed + 1 }), M.pillow);
  pillow.position.set(0.02, top + 0.055, -l / 2 + p + 0.28);
  pillow.rotation.y = deg(seed % 2 ? 4 : -3);
  g.add(pillow);
  const fold = 0.52;
  const coverL = ml - fold;
  const cover = new THREE.Mesh(
    drapedCloth({ width: mw + 0.05, length: coverL, drop: 0.16, footDrop: 0, rumple: 0.03, seed, foldBack: 0.12 }),
    comforter,
  );
  cover.position.set(0, top + 0.012, -l / 2 + p + 0.01 + fold + coverL / 2);
  g.add(cover);

  g.position.set((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
  return finish(g);
}

function buildUnderBed(M, root) {
  const u = F.underBedDrawer;
  root.add(boxFromBounds(u.x0, u.x1, 0.02, u.height, u.z1, u.z0, M.plasticDark));
  root.add(boxFromBounds(u.x1, u.x1 + 0.012, 0.06, u.height - 0.03, u.z1 + 0.03, u.z0 - 0.03, M.plasticBlack));
  root.add(boxFromBounds(u.x1 + 0.012, u.x1 + 0.03, 0.25, 0.28, (u.z0 + u.z1) / 2 - 0.08, (u.z0 + u.z1) / 2 + 0.08, M.blackMetal));
  // Backpack slumped against the foot of the left bed.
  const pack = new THREE.Mesh(softBox(0.32, 0.44, 0.2, { radius: 0.07, segments: 6, lump: 0.025, seed: 12 }), M.fabricBlack);
  pack.position.set(F.backpack.x, 0.21, F.backpack.z);
  pack.rotation.set(deg(-10), deg(-20), deg(4));
  pack.castShadow = pack.receiveShadow = true;
  root.add(pack);
  const flap = new THREE.Mesh(softBox(0.28, 0.16, 0.06, { radius: 0.03, segments: 4 }), M.fabricBlack);
  flap.position.set(F.backpack.x + 0.03, 0.27, F.backpack.z + 0.12);
  flap.rotation.copy(pack.rotation);
  root.add(flap);
  // Trash can by the right desk.
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.38, 28, 1, true), M.plasticBlack.clone());
  bin.material.side = THREE.DoubleSide;
  bin.position.set(F.trash.x, 0.19, F.trash.z);
  bin.castShadow = bin.receiveShadow = true;
  root.add(bin);
  const binBottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), M.plasticBlack);
  binBottom.rotation.x = -Math.PI / 2;
  binBottom.position.set(F.trash.x, 0.01, F.trash.z);
  root.add(binBottom);
}

function buildDeskProps(M, root) {
  const rand = mulberry32(23);
  const top = F.leftDesk.height;
  const addMesh = (mesh, x, y, z, ry = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const laptop = (x, z, ry) => {
    addMesh(new THREE.Mesh(softBox(0.24, 0.02, 0.34, { radius: 0.006, segments: 2 }), M.laptop), x, top + 0.01, z, ry);
  };
  const books = (x, z, ry, n) => {
    const colors = ['#2a2d31', '#3a3530', '#1f2a33', '#463a2e'];
    let y = top;
    for (let i = 0; i < n; i++) {
      const hgt = 0.025 + rand() * 0.015;
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.8 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.17 + rand() * 0.04, hgt, 0.24 + rand() * 0.03), mat);
      addMesh(b, x + (rand() - 0.5) * 0.02, y + hgt / 2, z + (rand() - 0.5) * 0.02, ry + (rand() - 0.5) * 0.15);
      y += hgt;
    }
  };
  const penCup = (x, z) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.11, 20, 1, true), M.plasticBlack.clone());
    cup.material.side = THREE.DoubleSide;
    addMesh(cup, x, top + 0.055, z);
    for (let i = 0; i < 4; i++) {
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), i % 2 ? M.plasticDark : M.satinMetal);
      addMesh(pen, x + (rand() - 0.5) * 0.03, top + 0.11, z + (rand() - 0.5) * 0.03).rotation.set((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
    }
  };

  // Left desk (along the left wall; positions measured from the reference).
  const L = F.leftDesk;
  laptop(-1.3, L.z0 - 0.55, deg(84));
  books(-1.32, L.z1 + 0.14, deg(84), 3);
  penCup(-1.5, L.z0 - 0.7);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.21, 20), M.plasticBlack);
  addMesh(bottle, -1.46, top + 0.105, L.z0 - 0.86);
  addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.045, 16), M.plasticBlack), -1.46, top + 0.232, L.z0 - 0.86);
  addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.014, 0.18), M.plasticDark), -1.24, top + 0.007, L.z0 - 0.22, deg(-4));

  // Right desk (along the right wall).
  const R = F.rightDesk;
  laptop(1.42, R.z0 - 0.55, deg(-80));
  books(1.4, R.z1 + 0.22, deg(-86), 3);
  penCup(1.62, R.z1 + 0.13);
}

function buildWallDecor(M, root) {
  const frameMat = M.oakDark;
  // Cork board above the left desk.
  const corkMat = new THREE.MeshStandardMaterial({ map: photoCorkboardTexture(), roughness: 0.9 });
  const C = F.corkboard;
  const cork = new THREE.Mesh(new THREE.BoxGeometry(0.02, C.y1 - C.y0, C.z0 - C.z1), [corkMat, frameMat, frameMat, frameMat, frameMat, frameMat]);
  cork.position.set(ROOM.x0 + 0.01, (C.y0 + C.y1) / 2, (C.z0 + C.z1) / 2);
  cork.receiveShadow = true;
  root.add(cork);

  const poster = (seed, w, h, x, y, z, faceX) => {
    const mat = new THREE.MeshStandardMaterial({ map: darkPosterTexture(seed), roughness: 0.55 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = faceX > 0 ? Math.PI / 2 : -Math.PI / 2;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  poster(1, 0.52, 0.94, ROOM.x0 + 0.006, 1.57, -5.14, 1);
  poster(2, 0.2, 0.3, ROOM.x0 + 0.006, 1.32, -5.72, 1);
  poster(3, 0.34, 0.52, ROOM.x1 - 0.006, 1.37, -3.55, -1);
}
