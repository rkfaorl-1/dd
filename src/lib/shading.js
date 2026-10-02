/**
 * Cheap "baked" ambient occlusion for box-shaped rooms:
 *  - addCornerShading: dark gradient strips where walls meet floor / ceiling and in corners
 *  - floorShading: a canvas painted with soft contact shadows under furniture,
 *    laid over the floor as one transparent decal
 *
 * Room bounds: x0..x1 left/right, z0 = entrance wall (larger z), z1 = far wall (smaller z).
 */
import * as THREE from 'three';
import { edgeFadeTexture, makeCanvas, canvasTexture, softRect } from './textures.js';

function decalMaterial(alphaMap, opacity) {
  return new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function addCornerShading(
  root,
  { x0, x1, z0, z1, height },
  { floor = 0.38, floorHeight = 0.32, ceiling = 0.22, ceilingHeight = 0.26, corner = 0.26, cornerWidth = 0.22 } = {},
) {
  const fade = edgeFadeTexture();
  const floorMat = decalMaterial(fade, floor);
  const ceilingMat = decalMaterial(fade, ceiling);
  const cornerMat = decalMaterial(fade, corner);
  const W = x1 - x0;
  const D = z0 - z1;
  const off = 0.003;
  const strip = (width, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);

  // [center x, center z, yaw, length] for each wall, facing into the room.
  const walls = [
    [(x0 + x1) / 2, z1 + off, 0, W],
    [(x0 + x1) / 2, z0 - off, Math.PI, W],
    [x0 + off, (z0 + z1) / 2, Math.PI / 2, D],
    [x1 - off, (z0 + z1) / 2, -Math.PI / 2, D],
  ];
  for (const [cx, cz, yaw, len] of walls) {
    const f = strip(len, floorHeight, floorMat);
    f.position.set(cx, floorHeight / 2, cz);
    f.rotation.y = yaw;
    root.add(f);
    const c = strip(len, ceilingHeight, ceilingMat);
    c.position.set(cx, height - ceilingHeight / 2, cz);
    c.rotation.set(0, yaw, 0);
    c.rotateZ(Math.PI); // dark edge at the top
    root.add(c);
  }

  // Vertical corners: a strip on each of the two walls, fading away from the corner.
  const corners = [
    [x0, z1, 1, 1],
    [x1, z1, -1, 1],
    [x0, z0, 1, -1],
    [x1, z0, -1, -1],
  ];
  const half = cornerWidth / 2;
  for (const [cx, cz, sx, sz] of corners) {
    const a = strip(height, cornerWidth, cornerMat);
    a.rotation.set(0, sz > 0 ? 0 : Math.PI, sx * sz > 0 ? -Math.PI / 2 : Math.PI / 2);
    a.position.set(cx + sx * half, height / 2, cz + sz * off);
    root.add(a);
    const b = strip(height, cornerWidth, cornerMat);
    b.rotation.set(0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx * sz > 0 ? Math.PI / 2 : -Math.PI / 2);
    b.position.set(cx + sx * off, height / 2, cz + sz * half);
    root.add(b);
  }
}

/**
 * Painter for the floor shading decal. Paint with white (= darker floor), then build().
 *   const shade = floorShading(room);
 *   shade.footprint(bed, 0.6, 30);
 *   shade.blob(chair.x, chair.z, 0.35, 0.35);
 *   shade.build(root);
 */
export function floorShading({ x0, x1, z0, z1 }, { pxPerMeter = 160, wallGrime = 0.35, opacity = 0.85 } = {}) {
  const PX = pxPerMeter;
  const W = Math.round((x1 - x0) * PX);
  const H = Math.round((z0 - z1) * PX);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // World (x, z) -> canvas pixels. Canvas top is the far wall.
  const px = (x) => (x - x0) * PX;
  const pz = (z) => (z - z1) * PX;

  if (wallGrime > 0) {
    const c = `rgba(255,255,255,${wallGrime})`;
    softRect(ctx, 0, 0, W, 14, 18, c);
    softRect(ctx, 0, H - 14, W, 14, 18, c);
    softRect(ctx, 0, 0, 14, H, 18, c);
    softRect(ctx, W - 14, 0, 14, H, 18, c);
  }

  return {
    /** Soft rectangle under a footprint { x0, x1, z0, z1 }. */
    footprint(f, strength = 0.6, blur = 26, inset = 0) {
      const xa = px(Math.min(f.x0, f.x1)) + inset;
      const xb = px(Math.max(f.x0, f.x1)) - inset;
      const za = pz(Math.min(f.z0, f.z1)) + inset;
      const zb = pz(Math.max(f.z0, f.z1)) - inset;
      softRect(ctx, xa, za, xb - xa, zb - za, blur, `rgba(255,255,255,${strength})`);
    },
    /** Radial soft spot. */
    blob(x, z, r, a) {
      const g = ctx.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * PX);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px(x) - r * PX, pz(z) - r * PX, r * 2 * PX, r * 2 * PX);
    },
    /** Free drawing: fn(ctx, px, pz, pixelsPerMeter). */
    draw(fn) {
      ctx.save();
      fn(ctx, px, pz, PX);
      ctx.restore();
    },
    build(root, y = 0.002) {
      const material = decalMaterial(canvasTexture(canvas, { color: false, repeat: false }), opacity);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z0 - z1), material);
      decal.rotation.x = -Math.PI / 2; // plane +Y -> world -Z (the far wall = canvas top)
      decal.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      root.add(decal);
      return decal;
    },
  };
}
