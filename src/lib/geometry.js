/**
 * Geometry helpers for building sets out of simple procedural primitives.
 */
import * as THREE from 'three';
import { mulberry32, tileableNoise } from './noise.js';

/**
 * Create a box mesh from min/max bounds (meters). Much easier to lay out
 * architecture and furniture this way than with centre + size.
 */
export function boxFromBounds(x0, x1, y0, y1, z0, z1, material, { cast = true, receive = true } = {}) {
  const geometry = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/** Box from size; origin at the bottom centre (handy for furniture parts). */
export function boxOnFloor(w, h, d, material, { cast = true, receive = true } = {}) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Planar "box projection" UVs in world space, so tiled textures (CMU block,
 * carpet, wood grain) keep a constant real-world scale on every piece.
 *
 * @param {THREE.Mesh} mesh  must already be positioned (rotation is respected)
 * @param {number} tile      texture tile size in meters
 * @param {'x'|'y'|'z'|null} grain  if set, U runs along this world axis whenever possible
 */
export function applyWorldUVs(mesh, tile = 1, grain = null) {
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv || new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, v;
    if (ax >= ay && ax >= az) {
      // Face looks along X: project on ZY.
      [u, v] = grain === 'y' ? [p.y, p.z] : [p.z, p.y];
    } else if (ay >= az) {
      // Face looks along Y: project on XZ.
      [u, v] = grain === 'z' ? [p.z, p.x] : [p.x, p.z];
    } else {
      // Face looks along Z: project on XY.
      [u, v] = grain === 'y' ? [p.y, p.x] : [p.x, p.y];
    }
    uv.setXY(i, u / tile, v / tile);
  }
  geometry.setAttribute('uv', uv);
  uv.needsUpdate = true;
  return mesh;
}

/**
 * Rounded, slightly lumpy box for soft goods (mattress, pillows, cushions).
 * Built from a subdivided box whose vertices are pulled onto a rounded shell,
 * then nudged with smooth noise so nothing looks perfectly machined.
 */
export function softBox(w, h, d, { radius = 0.04, segments = 10, lump = 0.0, seed = 1, sag = 0 } = {}) {
  const geometry = new THREE.BoxGeometry(w, h, d, segments, Math.max(2, Math.round(segments / 2)), segments);
  const pos = geometry.attributes.position;
  const rand = mulberry32(seed);
  const noise = tileableNoise(rand, 8);
  const inner = new THREE.Vector3(w / 2 - radius, h / 2 - radius, d / 2 - radius);
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(p.x, -inner.x, inner.x),
      THREE.MathUtils.clamp(p.y, -inner.y, inner.y),
      THREE.MathUtils.clamp(p.z, -inner.z, inner.z),
    );
    const dir = p.clone().sub(c);
    if (dir.lengthSq() > 1e-10) {
      dir.normalize().multiplyScalar(radius);
      p.copy(c).add(dir);
    }
    if (lump > 0) {
      const k = noise((p.x / w + 0.5) * 4, (p.z / d + 0.5) * 4) - 0.5;
      p.y += k * lump * (p.y > 0 ? 1 : 0.3);
      p.x += k * lump * 0.4 * Math.sign(p.x);
    }
    if (sag > 0) {
      // Centre of the top surface sinks a little (pillows, cushions).
      const fx = 1 - Math.pow((2 * p.x) / w, 2);
      const fz = 1 - Math.pow((2 * p.z) / d, 2);
      if (p.y > 0) p.y -= sag * Math.max(0, fx) * Math.max(0, fz);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Cloth draped over a bed: a grid that lies flat on top of the mattress and
 * hangs down over the two long sides and the foot end, with rumples.
 *
 * Coordinates: local X across the bed (width), local Z along the bed, foot at +Z.
 * Returns a BufferGeometry whose top surface sits at y = 0.
 *
 * @param {object} o
 * @param {number} o.width   mattress width covered
 * @param {number} o.length  length covered (from fold line to foot)
 * @param {number} o.drop    how far it hangs over the sides
 * @param {number} [o.footDrop] how far it hangs over the foot end (0 when tucked against a footboard)
 * @param {number} o.rumple  wrinkle amplitude (m)
 * @param {Array<{x:number,z:number,rx:number,rz:number,h:number}>} [o.lumps] body-shaped bulges
 */
export function drapedCloth({ width, length, drop, footDrop = drop, rumple = 0.02, seed = 1, lumps = [], foldBack = 0 }) {
  const rand = mulberry32(seed);
  const noise = tileableNoise(rand, 16);
  const segW = 36;
  const segL = 48;
  const totalW = width + drop * 2;
  const totalL = length + footDrop;
  const geometry = new THREE.PlaneGeometry(totalW, totalL, segW, segL);
  geometry.rotateX(-Math.PI / 2); // lie flat, +Z toward the foot
  const pos = geometry.attributes.position;
  const corner = 0.035; // rounded edge where the cloth bends over the mattress

  for (let i = 0; i < pos.count; i++) {
    const fx = pos.getX(i); // -totalW/2 .. totalW/2
    const fz = pos.getZ(i) + totalL / 2; // 0 .. totalL from the head end (fold line)
    let x = fx;
    let y = 0;
    let z = fz - length / 2;

    // Hang down past the long edges.
    const overX = Math.abs(fx) - width / 2;
    if (overX > 0) {
      const bend = Math.min(overX, corner);
      const hang = Math.max(0, overX - corner);
      x = Math.sign(fx) * (width / 2 + Math.sin((bend / corner) * (Math.PI / 2)) * corner * 0.64 + hang * 0.06);
      y = -(1 - Math.cos((bend / corner) * (Math.PI / 2))) * corner * 0.64 - hang;
    }
    // Hang down past the foot end.
    const overZ = fz - length;
    if (overZ > 0) {
      const bend = Math.min(overZ, corner);
      const hang = Math.max(0, overZ - corner);
      z = length / 2 + Math.sin((bend / corner) * (Math.PI / 2)) * corner * 0.64 + hang * 0.06;
      y = Math.min(y, 0) - (1 - Math.cos((bend / corner) * (Math.PI / 2))) * corner * 0.64 - hang;
    }

    // Rumples: stronger on the hanging parts, softer on top.
    const n1 = noise((fx / totalW) * 5 + 3, (fz / totalL) * 7);
    const n2 = noise((fx / totalW) * 13, (fz / totalL) * 17 + 5);
    const wrinkle = (n1 - 0.5) * rumple + (n2 - 0.5) * rumple * 0.35;
    if (y > -0.001) y += wrinkle + rumple * 0.5;
    else {
      x += Math.sign(fx) * wrinkle * 0.6 * (overX > 0 ? 1 : 0);
      z += wrinkle * 0.6 * (overZ > 0 ? 1 : 0);
    }

    // Body-shaped lumps (someone - or something - under the covers).
    for (const lump of lumps) {
      const dx = (x - lump.x) / lump.rx;
      const dz = (z - lump.z) / lump.rz;
      const r2 = dx * dx + dz * dz;
      if (r2 < 1 && y > -0.02) y += lump.h * Math.pow(1 - r2, 1.6);
    }

    // Folded-back top edge: a thicker roll along the head end.
    if (foldBack > 0 && fz < foldBack) {
      y += Math.sin((fz / foldBack) * Math.PI) * 0.03;
    }

    pos.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Merge child meshes that share a material into one mesh per material (fewer draw calls). */
export function mergeByMaterial(group, mergeGeometries) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  group.traverse((obj) => {
    if (!obj.isMesh || obj.userData.noMerge) return;
    const key = obj.material.uuid + (obj.castShadow ? 'c' : '') + (obj.receiveShadow ? 'r' : '');
    if (!buckets.has(key)) buckets.set(key, { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, geos: [] });
    const g = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    // Normalise attribute sets so geometries can merge.
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    buckets.get(key).geos.push(g.index ? g.toNonIndexed() : g);
    keep.push(obj);
  });
  const merged = new THREE.Group();
  for (const { material, cast, receive, geos } of buckets.values()) {
    const geometry = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    merged.add(mesh);
  }
  return { merged, sourceMeshes: keep };
}
