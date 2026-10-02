/**
 * Procedural canvas textures.
 *
 * No image assets are needed for the set: every surface texture is painted into a
 * <canvas> at startup from seeded noise. Most textures are near-white "detail"
 * maps that get tinted by `material.color`, so one texture can serve several
 * paint / laminate / fabric colours.
 */
import * as THREE from 'three';
import { mulberry32, tileableNoise } from './noise.js';

const cache = new Map();
function cached(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Wrap a canvas in a texture. `color` textures are sRGB, data textures (bump, alpha) are linear. */
export function canvasTexture(canvas, { color = true, repeat = true, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Fill a canvas pixel-by-pixel. `shade(x, y)` returns [r, g, b] or [r, g, b, a] in 0..255. */
function paintPixels(canvas, shade) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = shade(x, y);
      const i = (y * width + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Draw a soft-edged filled rectangle (canvas shadow trick; works in every browser). */
export function softRect(ctx, x, y, w, h, blur, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 20000;
  ctx.fillStyle = color;
  ctx.fillRect(x - 20000, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Architectural surfaces
// ---------------------------------------------------------------------------

/** Worn institutional loop-pile carpet. One tile = 1 m. Full colour (not tinted). */
export function carpetTextures() {
  return cached('carpet', () => {
    const S = 1024;
    const rand = mulberry32(91);
    const mottle = tileableNoise(rand, 5);
    const clump = tileableNoise(rand, 40);
    const tuft = tileableNoise(rand, 220);
    const base = [104, 98, 90];
    const blueFleck = [82, 88, 96];
    const brownFleck = [76, 66, 57];

    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const u = x / S, v = y / S;
      const m = mottle(u * 5, v * 5);
      const c = clump(u * 40, v * 40);
      const t = tuft(u * 220, v * 220);
      const r = rand();
      const k = 1 + (m - 0.5) * 0.12 + (c - 0.5) * 0.12 + (t - 0.5) * 0.22 + (r - 0.5) * 0.16;
      // Tweed: clusters of blue-grey and brown yarn mixed into the taupe base.
      const mix = c > 0.62 ? (c - 0.62) * 2.4 : 0;
      const fleck = r > 0.5 ? blueFleck : brownFleck;
      return [
        (base[0] + (fleck[0] - base[0]) * mix) * k,
        (base[1] + (fleck[1] - base[1]) * mix) * k,
        (base[2] + (fleck[2] - base[2]) * mix) * k,
      ];
    });

    const bump = paintPixels(makeCanvas(S / 2, S / 2), (x, y) => {
      const u = (x * 2) / S, v = (y * 2) / S;
      const t = tuft(u * 220, v * 220);
      const b = 128 + (t - 0.5) * 150 + (rand() - 0.5) * 70;
      return [b, b, b];
    });

    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/**
 * Painted concrete block (CMU) - the classic American dorm wall.
 * One tile = 2 blocks x 4 courses = 0.8128 m square. Near-white, tinted by paint colour.
 */
export const CMU_TILE = 0.8128;
export function cmuTextures() {
  return cached('cmu', () => {
    const S = 512;
    const blockW = S / 2;
    const course = S / 4;
    const joint = 5;
    const rand = mulberry32(7);
    const peel = tileableNoise(rand, 64);
    const blockTone = Array.from({ length: 16 }, () => (rand() - 0.5) * 0.05);

    // Distance (in px) to the nearest mortar joint, plus the block index.
    const jointInfo = (x, y) => {
      const row = Math.floor(y / course);
      const offset = (row % 2) * (blockW / 2);
      const xs = (x + offset) % S;
      const col = Math.floor(xs / blockW);
      const dx = Math.min(xs % blockW, blockW - (xs % blockW));
      const dy = Math.min(y % course, course - (y % course));
      return { d: Math.min(dx, dy), block: row * 2 + col };
    };

    const pores = new Float32Array(S * S);
    for (let i = 0; i < 2600; i++) {
      const px = Math.floor(rand() * S), py = Math.floor(rand() * S);
      const r = rand() < 0.85 ? 1 : 2;
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          pores[((py + oy + S) % S) * S + ((px + ox + S) % S)] = 1;
        }
      }
    }

    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const { d, block } = jointInfo(x, y);
      const p = peel((x / S) * 64, (y / S) * 64);
      let k = 0.94 + blockTone[block % 16] + (p - 0.5) * 0.04;
      if (d < joint) k -= 0.06 * (1 - d / joint);
      if (pores[y * S + x]) k -= 0.05;
      const g = 255 * k;
      return [g, g * 0.995, g * 0.985];
    });

    const bump = paintPixels(makeCanvas(S, S), (x, y) => {
      const { d } = jointInfo(x, y);
      const p = peel((x / S) * 64, (y / S) * 64);
      let b = 190 + (p - 0.5) * 40;
      if (d < joint) b = 90 + 100 * Math.pow(d / joint, 2);
      if (pores[y * S + x]) b -= 45;
      return [b, b, b];
    });

    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/** Subtle orange-peel / plaster noise used as a bump map on smooth painted surfaces. */
export function plasterBump() {
  return cached('plaster', () => {
    const S = 256;
    const rand = mulberry32(3);
    const n = tileableNoise(rand, 48);
    const canvas = paintPixels(makeCanvas(S, S), (x, y) => {
      const b = 128 + (n((x / S) * 48, (y / S) * 48) - 0.5) * 90 + (rand() - 0.5) * 30;
      return [b, b, b];
    });
    return canvasTexture(canvas, { color: false });
  });
}

/** Wood-grain laminate. Grain runs along U. Near-white, tinted by material colour. Tile = 1 m. */
export function woodTexture() {
  return cached('wood', () => {
    const S = 512;
    const rand = mulberry32(12);
    const warp = tileableNoise(rand, 8);
    const streak = tileableNoise(rand, 32);
    const fine = tileableNoise(rand, 128);
    const canvas = paintPixels(makeCanvas(S, S), (x, y) => {
      const u = x / S, v = y / S;
      const w = warp(u * 8, v * 8);
      const rings = Math.sin((v * 22 + w * 1.6) * Math.PI * 2) * 0.5 + 0.5;
      const s = streak(u * 4, v * 32);
      const f = fine(u * 16, v * 128);
      const k = 0.88 + rings * 0.05 + (s - 0.5) * 0.07 + (f - 0.5) * 0.04;
      return [255 * k, 245 * k, 232 * k];
    });
    return canvasTexture(canvas);
  });
}

/** Woven fabric (bedding, upholstery). Near-white, tinted. Tile = 0.25 m. */
export function fabricTextures() {
  return cached('fabric', () => {
    const S = 256;
    const rand = mulberry32(5);
    const n = tileableNoise(rand, 16);
    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? 1 : 0.94;
      const k = weave * (0.9 + (n((x / S) * 16, (y / S) * 16) - 0.5) * 0.12 + (rand() - 0.5) * 0.06);
      return [255 * k, 255 * k, 255 * k];
    });
    const bump = paintPixels(makeCanvas(S, S), (x, y) => {
      const b = ((x >> 1) + (y >> 1)) % 2 === 0 ? 170 : 110;
      return [b, b, b];
    });
    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/** Hallway vinyl composition tile (VCT). 4x4 tiles of 12" = 1.2192 m per texture tile. */
export const VCT_TILE = 1.2192;
export function vctTexture() {
  return cached('vct', () => {
    const S = 1024;
    const cell = S / 4;
    const rand = mulberry32(44);
    const chips = tileableNoise(rand, 96);
    const palette = [
      [196, 188, 172],
      [188, 183, 174],
      [201, 194, 180],
      [192, 186, 176],
      [176, 169, 157],
    ];
    const tiles = Array.from({ length: 16 }, () => palette[rand() < 0.08 ? 4 : Math.floor(rand() * 4)]);
    const canvas = paintPixels(makeCanvas(S, S), (x, y) => {
      const tx = Math.floor(x / cell), ty = Math.floor(y / cell);
      const base = tiles[ty * 4 + tx];
      const gx = Math.min(x % cell, cell - (x % cell));
      const gy = Math.min(y % cell, cell - (y % cell));
      const c = chips((x / S) * 96, (y / S) * 96);
      let k = 1 + (c > 0.66 ? 0.04 : c < 0.3 ? -0.035 : 0) + (rand() - 0.5) * 0.04;
      if (Math.min(gx, gy) < 1.5) k *= 0.84;
      return [base[0] * k, base[1] * k, base[2] * k];
    });
    return canvasTexture(canvas);
  });
}

/** 2'x4' acoustic drop-ceiling tile with T-bar grid. Texture covers one tile (0.61 x 1.22 m). */
export function ceilingTileTexture() {
  return cached('ceilingTile', () => {
    const W = 256, H = 512;
    const rand = mulberry32(8);
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e9e6de';
    ctx.fillRect(0, 0, W, H);
    // Fissured mineral-fibre pattern.
    ctx.strokeStyle = 'rgba(120, 112, 100, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = rand() * W, y = rand() * H, len = 2 + rand() * 6, a = rand() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len, y + rand() * 3, x + Math.cos(a + 0.6) * len * 1.6, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // T-bar grid around the edge.
    ctx.fillStyle = '#f3f1ec';
    ctx.fillRect(0, 0, W, 6);
    ctx.fillRect(0, 0, 6, H);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(6, 6, W - 6, 2);
    ctx.fillRect(6, 6, 2, H - 6);
    return canvasTexture(canvas);
  });
}

// ---------------------------------------------------------------------------
// Alpha / decal helpers
// ---------------------------------------------------------------------------

// Note: three.js reads `alphaMap` from the GREEN channel, so these masks are
// painted as grey levels on an opaque black canvas (white = opaque).

/** Soft radial blob (white centre -> black edge), used for contact shadows. */
export function blobTexture() {
  return cached('blob', () => {
    const S = 128;
    const canvas = makeCanvas(S, S);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, '#8c8c8c');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return canvasTexture(canvas, { color: false, repeat: false });
  });
}

/** Linear fade (opaque at v=0 -> transparent at v=1), used for corner ambient occlusion strips. */
export function edgeFadeTexture() {
  return cached('edgeFade', () => {
    const canvas = makeCanvas(4, 128);
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.2, '#6e6e6e');
    g.addColorStop(0.55, '#1c1c1c');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    return canvasTexture(canvas, { color: false, repeat: false });
  });
}

// ---------------------------------------------------------------------------
// Graphic textures (signs, screens, posters, exterior backdrop)
// ---------------------------------------------------------------------------

/** Generic text label (room number plates, exit sign, clock digits). */
export function labelTexture({
  text,
  width = 256,
  height = 128,
  background = '#000',
  color = '#fff',
  font = 'bold 72px Arial, Helvetica, sans-serif',
  border = null,
  glow = 0,
}) {
  return cached(`label:${text}:${width}:${height}:${background}:${color}:${font}:${border}:${glow}`, () => {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.max(2, height * 0.04);
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, width - ctx.lineWidth * 2, height - ctx.lineWidth * 2);
    }
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillText(text, width / 2, height / 2 + height * 0.04);
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Seven-segment style alarm clock face. */
export function clockTexture(text) {
  return labelTexture({
    text,
    width: 256,
    height: 112,
    background: '#060404',
    color: '#ff3b2f',
    font: 'bold 86px "Courier New", monospace',
    glow: 6,
  });
}

/** Laptop screen: a dim desktop with a document window. */
export function laptopScreenTexture() {
  return cached('laptop', () => {
    const W = 512, H = 320;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#22334d');
    g.addColorStop(1, '#0d1626');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8ecf2';
    ctx.fillRect(70, 40, 330, 230);
    ctx.fillStyle = '#c9d0db';
    ctx.fillRect(70, 40, 330, 18);
    ctx.fillStyle = '#9aa3b0';
    for (let i = 0; i < 11; i++) ctx.fillRect(92, 76 + i * 16, 220 + ((i * 37) % 70), 5);
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, H - 18, W, 18);
    return canvasTexture(canvas, { repeat: false });
  });
}

/** A faded mountain-landscape print, the kind every dorm has. */
export function posterTexture() {
  return cached('poster', () => {
    const W = 360, H = 512;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#c9b896');
    sky.addColorStop(0.55, '#d8c7a4');
    sky.addColorStop(1, '#a99a7c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e9dcbc';
    ctx.beginPath();
    ctx.arc(W * 0.66, H * 0.3, 34, 0, Math.PI * 2);
    ctx.fill();
    const ridges = ['#8d8a7a', '#6f7066', '#55584f', '#3e403a'];
    const rand = mulberry32(17);
    ridges.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      const base = H * (0.45 + i * 0.1);
      ctx.moveTo(0, H);
      ctx.lineTo(0, base);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, base - Math.abs(Math.sin(x * 0.012 + i * 1.7)) * 70 * (1 - i * 0.15) - rand() * 14);
      ctx.lineTo(W, H);
      ctx.fill();
    });
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = '#3e403a';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('NORTH RIDGE', W / 2, H - 30);
    // Sun fading / paper texture
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(255,250,235,${rand() * 0.08})`;
      ctx.fillRect(rand() * W, rand() * H, 2, 2);
    }
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Wall calendar (taped to the back of the wardrobe). */
export function calendarTexture() {
  return cached('calendar', () => {
    const W = 256, H = 360;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ece8df';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7b8a83';
    ctx.fillRect(0, 0, W, 150);
    ctx.fillStyle = '#ece8df';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OCTOBER', W / 2, 190);
    ctx.strokeStyle = '#9d988d';
    ctx.lineWidth = 1;
    const gx = 14, gy = 210, cw = (W - 28) / 7, ch = 26;
    for (let r = 0; r <= 5; r++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + r * ch);
      ctx.lineTo(W - gx, gy + r * ch);
      ctx.stroke();
    }
    for (let c = 0; c <= 7; c++) {
      ctx.beginPath();
      ctx.moveTo(gx + c * cw, gy);
      ctx.lineTo(gx + c * cw, gy + 5 * ch);
      ctx.stroke();
    }
    // Days crossed off in red marker.
    ctx.strokeStyle = 'rgba(150, 40, 35, 0.8)';
    ctx.lineWidth = 2;
    for (let d = 0; d < 13; d++) {
      const r = Math.floor((d + 4) / 7), c = (d + 4) % 7;
      const x = gx + c * cw, y = gy + r * ch;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5);
      ctx.lineTo(x + cw - 5, y + ch - 5);
      ctx.moveTo(x + cw - 5, y + 5);
      ctx.lineTo(x + 5, y + ch - 5);
      ctx.stroke();
    }
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Cork board with a few pinned papers. */
export function corkboardTexture() {
  return cached('cork', () => {
    const W = 384, H = 256;
    const rand = mulberry32(23);
    const canvas = paintPixels(makeCanvas(W, H), () => {
      const k = 0.85 + rand() * 0.25;
      return [176 * k, 136 * k, 96 * k];
    });
    const ctx = canvas.getContext('2d');
    const papers = [
      [30, 30, 90, 120, '#e9e5da'],
      [140, 24, 110, 80, '#d9d2b8'],
      [270, 40, 80, 100, '#e4e0d4'],
      [150, 125, 90, 100, '#cfd6d4'],
    ];
    for (const [x, y, w, h, col] of papers) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((rand() - 0.5) * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
      ctx.fillStyle = col;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = 'rgba(60,60,60,0.55)';
      for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + 8, -h / 2 + 14 + i * 12, w - 16 - rand() * 20, 3);
      ctx.fillStyle = '#9b3a32';
      ctx.beginPath();
      ctx.arc(0, -h / 2 + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#6d5a43';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, W, H);
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Low-pile area rug with a simple border. */
export function rugTexture() {
  return cached('rug', () => {
    const W = 384, H = 544;
    const rand = mulberry32(31);
    const n = tileableNoise(rand, 24);
    const canvas = paintPixels(makeCanvas(W, H), (x, y) => {
      const bx = Math.min(x, W - x), by = Math.min(y, H - y);
      const b = Math.min(bx, by);
      let col = [92, 74, 64];
      if (b < 30) col = [70, 62, 58];
      else if (b < 40) col = [140, 124, 100];
      else if (b < 52) col = [84, 70, 62];
      const k = 0.9 + (n((x / W) * 24, (y / H) * 24) - 0.5) * 0.2 + (rand() - 0.5) * 0.12;
      return [col[0] * k, col[1] * k, col[2] * k];
    });
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Building across the quad: brick facade + window grid. Returns { map, lights } (lights = lit-window mask). */
export function facadeTextures() {
  return cached('facade', () => {
    const W = 1024, H = 512;
    const rand = mulberry32(57);
    const brick = makeCanvas(W, H);
    const ctx = brick.getContext('2d');
    ctx.fillStyle = '#6e5546';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const l = 0.75 + rand() * 0.4;
      ctx.fillStyle = `rgba(${110 * l},${80 * l},${66 * l},0.35)`;
      ctx.fillRect(rand() * W, rand() * H, 6, 3);
    }
    const lights = makeCanvas(W, H);
    const lctx = lights.getContext('2d');
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, W, H);
    const cols = 14, rows = 5;
    const ww = 34, wh = 50;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 24 + c * ((W - 48) / cols);
        const y = 40 + r * 92;
        ctx.fillStyle = '#c9c3b8';
        ctx.fillRect(x - 3, y - 3, ww + 6, wh + 8);
        ctx.fillStyle = '#2a2f36';
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = 'rgba(160,180,200,0.18)';
        ctx.fillRect(x, y, ww, wh * 0.45);
        // Roughly a third of the windows are lit at night.
        if (rand() < 0.32) {
          const warm = rand() < 0.75;
          lctx.fillStyle = warm ? '#ffc88a' : '#a9c4ff';
          lctx.fillRect(x + 1, y + 1, ww - 2, wh - 2);
          if (rand() < 0.5) {
            lctx.fillStyle = 'rgba(0,0,0,0.55)';
            lctx.fillRect(x + 1, y + 1, ww - 2, (wh - 2) * (0.3 + rand() * 0.5));
          }
        }
      }
    }
    return { map: canvasTexture(brick, { repeat: false }), lights: canvasTexture(lights, { repeat: false }) };
  });
}

/** Bare tree silhouette (alpha) - late-autumn branches outside the window. */
export function treeTexture() {
  return cached('tree', () => {
    const S = 1024;
    const rand = mulberry32(64);
    const canvas = makeCanvas(S, S);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; // used as an alphaMap (green channel): black = transparent
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    const branch = (x, y, angle, length, width, depth) => {
      if (depth === 0 || width < 0.6) return;
      const x2 = x + Math.cos(angle) * length;
      const y2 = y - Math.sin(angle) * length;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        (x + x2) / 2 + (rand() - 0.5) * length * 0.3,
        (y + y2) / 2 + (rand() - 0.5) * length * 0.3,
        x2,
        y2,
      );
      ctx.stroke();
      const n = depth > 4 ? 2 : 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        branch(x2, y2, angle + (rand() - 0.5) * 1.3, length * (0.62 + rand() * 0.2), width * 0.68, depth - 1);
      }
    };
    branch(S * 0.3, S, Math.PI / 2 + 0.08, S * 0.28, 34, 9);
    branch(S * 0.3, S * 0.72, Math.PI / 2 - 0.7, S * 0.2, 16, 7);
    return canvasTexture(canvas, { color: false, repeat: false });
  });
}

// ---------------------------------------------------------------------------
// "Reference look" textures (grungier, darker dorm)
// ---------------------------------------------------------------------------

/**
 * Old, grimy painted plaster: mottling, darker blotches and faint water streaks.
 * Near-white, tinted by material colour. One tile = PLASTER_TILE meters.
 */
export const PLASTER_TILE = 2.6;
export function grungyPlasterTextures() {
  return cached('grungyPlaster', () => {
    const S = 1024;
    const rand = mulberry32(2718);
    const big = tileableNoise(rand, 3);
    const mid = tileableNoise(rand, 10);
    const small = tileableNoise(rand, 36);
    const fine = tileableNoise(rand, 140);
    const blotch = tileableNoise(rand, 6);
    // Faint vertical water streaks: [u position, width, strength, start v, length] (canvas v grows downward = world down).
    const streaks = Array.from({ length: 22 }, () => [rand(), 0.002 + rand() * 0.007, 0.03 + rand() * 0.08, rand(), 0.15 + rand() * 0.45]);
    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const u = x / S, v = y / S;
      let k =
        0.84 +
        (big(u * 3, v * 3) - 0.5) * 0.16 +
        (mid(u * 10, v * 10) - 0.5) * 0.1 +
        (small(u * 36, v * 36) - 0.5) * 0.06 +
        (fine(u * 140, v * 140) - 0.5) * 0.05 +
        (rand() - 0.5) * 0.025;
      const b = blotch(u * 6, v * 6);
      if (b > 0.62) k -= (b - 0.62) * 0.5;
      for (const [su, w, a, sv, len] of streaks) {
        let dx = Math.abs(u - su);
        dx = Math.min(dx, 1 - dx);
        if (dx > w * 3) continue;
        let dv = v - sv;
        if (dv < 0) dv += 1;
        if (dv < len) k -= a * Math.exp(-(dx * dx) / (w * w)) * (1 - dv / len);
      }
      return [255 * k, 250 * k, 241 * k];
    });
    const half = S / 2;
    const bump = paintPixels(makeCanvas(half, half), (x, y) => {
      const u = x / half, v = y / half;
      let b = 128 + (small(u * 36, v * 36) - 0.5) * 70 + (fine(u * 140, v * 140) - 0.5) * 90 + (rand() - 0.5) * 26;
      if (rand() < 0.0015) b -= 70; // pits
      return [b, b, b];
    });
    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/**
 * Dark commercial loop carpet with a subtle diagonal lattice, like the reference photo.
 * Full colour. One tile = PATTERN_CARPET_TILE meters.
 */
export const PATTERN_CARPET_TILE = 0.6;
export function patternedCarpetTextures() {
  return cached('patternCarpet', () => {
    const S = 1024;
    const cell = 8;
    const n = S / cell;
    const rand = mulberry32(77);
    const mottle = tileableNoise(rand, 5);
    const palette = [
      [56, 60, 70],
      [38, 40, 47],
      [86, 91, 102],
      [66, 62, 58],
    ];
    const tone = new Uint8Array(n * n);
    const jx = new Float32Array(n * n);
    const jy = new Float32Array(n * n);
    for (let cy = 0; cy < n; cy++) {
      for (let cx = 0; cx < n; cx++) {
        const i = cy * n + cx;
        const r = rand();
        tone[i] = r < 0.56 ? 0 : r < 0.82 ? 1 : r < 0.96 ? 2 : 3;
        // Diagonal lattice of lighter loops (the carpet's pattern).
        if ((cx + cy) % 12 === 0 || (((cx - cy) % 12) + 12) % 12 === 0) tone[i] = rand() < 0.75 ? 2 : 0;
        jx[i] = (rand() - 0.5) * 2;
        jy[i] = (rand() - 0.5) * 2;
      }
    }
    const loop = (x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const i = (cy % n) * n + (cx % n);
      const dx = (x % cell) - cell / 2 - jx[i];
      const dy = (y % cell) - cell / 2 - jy[i];
      return { i, d: Math.sqrt(dx * dx + dy * dy) / (cell * 0.62) };
    };
    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const { i, d } = loop(x, y);
      const c = palette[tone[i]];
      const m = mottle((x / S) * 5, (y / S) * 5);
      const k = (1.05 - Math.min(1, d) * 0.45) * (0.9 + (m - 0.5) * 0.25) * (0.94 + rand() * 0.12);
      return [c[0] * k, c[1] * k, c[2] * k];
    });
    const half = S / 2;
    const bump = paintPixels(makeCanvas(half, half), (x, y) => {
      const { d } = loop(x * 2, y * 2);
      const b = 200 - Math.min(1, d) * 150 + (rand() - 0.5) * 30;
      return [b, b, b];
    });
    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/** Quilted comforter: woven fabric with stitched squares. Near-white, tinted. One tile = 0.6 m. */
export function quiltTextures() {
  return cached('quilt', () => {
    const S = 512;
    const rand = mulberry32(19);
    const n = tileableNoise(rand, 12);
    const square = S / 2; // 0.3 m squares
    const stitch = (x, y) => {
      const dx = Math.min(x % square, square - (x % square));
      const dy = Math.min(y % square, square - (y % square));
      return Math.min(dx, dy);
    };
    const map = paintPixels(makeCanvas(S, S), (x, y) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 === 0 ? 1 : 0.95;
      const s = stitch(x, y);
      let k = weave * (0.88 + (n((x / S) * 12, (y / S) * 12) - 0.5) * 0.12 + (rand() - 0.5) * 0.05);
      if (s < 3) k *= 0.8;
      return [255 * k, 255 * k, 255 * k];
    });
    const bump = paintPixels(makeCanvas(S, S), (x, y) => {
      const s = stitch(x, y);
      // Puffy squares: high in the middle, pinched at the stitches.
      const puff = Math.min(1, s / (square * 0.35));
      const b = 60 + puff * 150 + (((x >> 1) + (y >> 1)) % 2) * 12;
      return [b, b, b];
    });
    return { map: canvasTexture(map), bumpMap: canvasTexture(bump, { color: false }) };
  });
}

/**
 * Pine tree silhouettes as an alpha mask (white trees on black).
 * `trees` optionally fixes the composition: [[x 0..1, height 0..1], ...].
 */
export function pinesTexture(seed = 5, trees = null) {
  return cached(`pines:${seed}:${JSON.stringify(trees)}`, () => {
    const W = 1024, H = 512;
    const rand = mulberry32(seed);
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    const pine = (x, base, height, width) => {
      ctx.fillRect(x - width * 0.02, base - height * 0.15, width * 0.04, height * 0.15);
      ctx.lineWidth = Math.max(1, width * 0.022);
      ctx.beginPath();
      ctx.moveTo(x, base - height * 0.1);
      ctx.lineTo(x, base - height);
      ctx.stroke();
      // Drooping branches, each covered in needle clumps; a few gaps let the sky through.
      const branches = Math.round(24 + height / 10);
      for (let i = 0; i < branches; i++) {
        const t = 0.1 + (0.88 * i) / branches + (rand() - 0.5) * 0.03; // 0 = bottom, 1 = top
        const y = base - height * t;
        const reach = (width / 2) * Math.pow(1 - t, 0.85) * (0.7 + rand() * 0.45);
        for (const dir of [-1, 1]) {
          if (rand() < 0.12) continue;
          const L = reach * (0.75 + rand() * 0.35);
          const droop = height * (0.012 + rand() * 0.028);
          ctx.lineWidth = Math.max(1, width * 0.012);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + dir * L * 0.5, y - droop * 0.3, x + dir * L, y + droop);
          ctx.stroke();
          const clumps = Math.max(3, Math.round(L / (width * 0.035)));
          for (let k = 0; k < clumps; k++) {
            const s = (k + rand() * 0.8) / clumps;
            const r = width * (0.02 + rand() * 0.024) * (1.25 - s * 0.5);
            ctx.beginPath();
            ctx.ellipse(x + dir * L * s, y + droop * s * s + r * 0.3, r * 1.3, r * 0.75, dir * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };
    const list = trees || Array.from({ length: 9 }, () => [rand(), 0.55 + rand() * 0.45]);
    for (const [x, hFrac] of list) {
      const h = H * hFrac;
      pine(x * W, H, h, h * (0.42 + rand() * 0.18));
    }
    return canvasTexture(canvas, { color: false, repeat: false });
  });
}

/** Dark mountain print (the kind of poster in the reference). */
export function darkPosterTexture(seed = 1) {
  return cached(`darkPoster:${seed}`, () => {
    const W = 300, H = 420;
    const rand = mulberry32(seed * 31 + 7);
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2c333c');
    sky.addColorStop(0.6, '#3c434b');
    sky.addColorStop(1, '#14171b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const peakX = W * (0.4 + rand() * 0.2);
    const peakY = H * (0.25 + rand() * 0.1);
    ctx.fillStyle = '#5f666e';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.75);
    ctx.lineTo(peakX - W * 0.18, peakY + H * 0.2);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(peakX + W * 0.22, peakY + H * 0.25);
    ctx.lineTo(W, H * 0.7);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    // Snow highlights on the lit flank.
    ctx.fillStyle = 'rgba(205, 210, 214, 0.75)';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX - W * 0.07, peakY + H * 0.1);
    ctx.lineTo(peakX - W * 0.02, peakY + H * 0.08);
    ctx.lineTo(peakX + W * 0.03, peakY + H * 0.12);
    ctx.lineTo(peakX + W * 0.06, peakY + H * 0.07);
    ctx.fill();
    ctx.fillStyle = '#0e1013';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.82);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H * (0.8 + rand() * 0.04));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    return canvasTexture(canvas, { repeat: false });
  });
}

/** Tall cork board with a pinned mountain photo and two notes. */
export function photoCorkboardTexture() {
  return cached('photoCork', () => {
    const W = 300, H = 460;
    const rand = mulberry32(41);
    const canvas = paintPixels(makeCanvas(W, H), () => {
      const k = 0.78 + rand() * 0.28;
      return [150 * k, 112 * k, 78 * k];
    });
    const ctx = canvas.getContext('2d');
    const card = (x, y, w, h, angle, fill, draw) => {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      draw?.(w, h);
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(0, -h / 2 + 7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    card(95, 48, 110, 140, 0.02, '#e8e6e1', (w, h) => {
      ctx.fillStyle = '#2b2f33';
      ctx.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 30);
      ctx.fillStyle = '#8b9096';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 8, h / 2 - 30);
      ctx.lineTo(-6, -h / 2 + 30);
      ctx.lineTo(w / 2 - 8, h / 2 - 40);
      ctx.lineTo(w / 2 - 8, h / 2 - 22);
      ctx.lineTo(-w / 2 + 8, h / 2 - 22);
      ctx.fill();
    });
    const lines = (w, h) => {
      ctx.fillStyle = 'rgba(70,70,70,0.6)';
      for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + 8, -h / 2 + 18 + i * 12, w - 16 - rand() * 18, 3);
    };
    card(28, 230, 96, 110, -0.05, '#dcd9d0', lines);
    card(150, 290, 100, 120, 0.04, '#e3e0d6', lines);
    ctx.strokeStyle = '#4a3423';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    return canvasTexture(canvas, { repeat: false });
  });
}
