/**
 * Reference-look dorm: room shell, entry closet (with the light switch), door,
 * window + wall heating unit, ceiling dome light, hallway and the night exterior.
 */
import * as THREE from 'three';
import { boxFromBounds, applyWorldUVs } from '../../lib/geometry.js';
import {
  PLASTER_TILE,
  PATTERN_CARPET_TILE,
  VCT_TILE,
  labelTexture,
  facadeTextures,
  pinesTexture,
  makeCanvas,
  canvasTexture,
} from '../../lib/textures.js';
import { addCornerShading, floorShading } from '../../lib/shading.js';
import { ROOM, CLOSET, DOOR, SWITCH, WINDOW, WALL_UNIT, HALL, FURNITURE, DOME } from './layout.js';

const H = ROOM.height;

export function buildArchitecture(M, root) {
  const add = (mesh, tile = null, grain = null) => {
    root.add(mesh);
    if (tile) applyWorldUVs(mesh, tile, grain);
    return mesh;
  };
  buildShell(M, add);
  buildCloset(M, root, add);
  addCornerShading(root, { ...ROOM, height: H }, { floor: 0.5, floorHeight: 0.55, ceiling: 0.35, ceilingHeight: 0.4, corner: 0.32 });
  buildFloorShade(root);
  const handles = {};
  handles.door = buildDoor(M, root);
  handles.doorway = { x0: DOOR.x0, x1: DOOR.x1 };
  handles.switchToggle = buildSwitch(M, root);
  buildWindow(M, root);
  buildWallUnit(M, root);
  Object.assign(handles, buildDomeLight(M, root));
  Object.assign(handles, buildHallway(M, root, add));
  handles.exterior = buildExterior(root);
  return handles;
}

// ---------------------------------------------------------------------------

function buildShell(M, add) {
  const { x0, x1, z0, z1, wall, extWall } = ROOM;
  add(boxFromBounds(x0, x1, -0.05, 0, z1, z0, M.carpet, { cast: false }), PATTERN_CARPET_TILE);
  add(boxFromBounds(x0 - wall, x1 + wall, H, H + 0.08, z1 - extWall, z0 + wall, M.ceiling), PLASTER_TILE);
  add(boxFromBounds(x0 - wall, x0, 0, H, z1 - extWall, z0 + wall, M.wall), PLASTER_TILE);
  add(boxFromBounds(x1, x1 + wall, 0, H, z1 - extWall, z0 + wall, M.wall), PLASTER_TILE);

  // Window wall.
  const wz0 = z1 - extWall;
  add(boxFromBounds(x0, WINDOW.x0, 0, H, wz0, z1, M.wall), PLASTER_TILE);
  add(boxFromBounds(WINDOW.x1, x1, 0, H, wz0, z1, M.wall), PLASTER_TILE);
  add(boxFromBounds(WINDOW.x0, WINDOW.x1, 0, WINDOW.sill, wz0, z1, M.wall), PLASTER_TILE);
  add(boxFromBounds(WINDOW.x0, WINDOW.x1, WINDOW.top, H, wz0, z1, M.wall), PLASTER_TILE);

  // Entrance wall (also the hallway's north wall) with the door opening.
  const ez1 = z0 + wall;
  add(boxFromBounds(HALL.x0, DOOR.x0 - 0.055, 0, H, z0, ez1, M.wall), PLASTER_TILE);
  add(boxFromBounds(DOOR.x1 + 0.055, HALL.x1, 0, H, z0, ez1, M.wall), PLASTER_TILE);
  add(boxFromBounds(DOOR.x0 - 0.055, DOOR.x1 + 0.055, DOOR.height + 0.06, H, z0, ez1, M.wall), PLASTER_TILE);

  // Dark rubber base.
  const b = 0.1, t = 0.01;
  add(boxFromBounds(x0, x0 + t, 0, b, z1, CLOSET.z1, M.baseboard, { cast: false }));
  add(boxFromBounds(x1 - t, x1, 0, b, z1, z0, M.baseboard, { cast: false }));
  add(boxFromBounds(x0, WALL_UNIT.x0, 0, b, z1, z1 + t, M.baseboard, { cast: false }));
  add(boxFromBounds(WALL_UNIT.x1, x1, 0, b, z1, z1 + t, M.baseboard, { cast: false }));
  add(boxFromBounds(DOOR.x1 + 0.055, x1, 0, b, z0 - t, z0, M.baseboard, { cast: false }));
}

/** Built-in closet in the front-left corner: forms the left side of the entry. */
function buildCloset(M, root, add) {
  const { x0, x1, z0, z1, trim } = CLOSET;
  add(boxFromBounds(x0, x1, 0, H, z1, z0, M.wall), PLASTER_TILE);
  // Dark steel frame where the closet ends (the dark band left of the reference view):
  // a near-black return, then the dark grey face with a strike plate.
  const split = z1 + trim * 0.45;
  root.add(boxFromBounds(x1, x1 + 0.016, 0, H, split, z1 + trim, M.frameShadow));
  root.add(boxFromBounds(x1, x1 + 0.016, 0, H, z1 - 0.012, split, M.darkTrim));
  root.add(boxFromBounds(x1 - 0.07, x1 + 0.016, 0, H, z1 - 0.014, z1, M.darkTrim));
  root.add(boxFromBounds(x1 + 0.016, x1 + 0.019, 0.98, 1.2, z1 + 0.012, z1 + 0.038, M.satinMetal));
  root.add(boxFromBounds(x1 + 0.016, x1 + 0.02, 1.06, 1.12, z1 + 0.018, z1 + 0.032, M.frameShadow));
  root.add(boxFromBounds(x1, x1 + 0.01, 0, 0.1, z1 + trim, z0, M.baseboard, { cast: false }));
  // Closet doors on the end facing the room (seen in reverse shots).
  const doorW = (x1 - 0.1 - (x0 + 0.12)) / 2;
  for (let i = 0; i < 2; i++) {
    const dx0 = x0 + 0.12 + i * doorW;
    const leaf = boxFromBounds(dx0 + 0.006, dx0 + doorW - 0.006, 0.04, 2.04, z1 - 0.03, z1, M.oakDark);
    applyWorldUVs(leaf, 1, 'y');
    root.add(leaf);
    const knobX = i === 0 ? dx0 + doorW - 0.08 : dx0 + 0.08;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 10), M.blackMetal);
    knob.position.set(knobX, 1.0, z1 - 0.05);
    root.add(knob);
  }
  root.add(boxFromBounds(x0 + 0.08, x1 - 0.06, 2.04, 2.1, z1 - 0.035, z1, M.darkTrim));
  root.add(boxFromBounds(x0 + 0.06, x1 - 0.06, 0, 0.1, z1 - 0.012, z1, M.baseboard, { cast: false }));
}

function buildFloorShade(root) {
  const shade = floorShading(ROOM, { wallGrime: 0.45 });
  const F = FURNITURE;
  shade.footprint(CLOSET, 0.75, 20);
  shade.footprint(F.leftDesk, 0.5, 30);
  shade.footprint(F.rightDesk, 0.5, 30);
  shade.footprint(F.wardrobe, 0.8, 18);
  shade.footprint(F.leftBed, 0.75, 36, 4);
  shade.footprint(F.rightBed, 0.75, 36, 4);
  shade.footprint(WALL_UNIT, 0.6, 18);
  shade.blob(F.leftChair.x, F.leftChair.z, 0.36, 0.4);
  shade.blob(F.rightChair.x, F.rightChair.z, 0.36, 0.4);
  shade.blob(F.trash.x, F.trash.z, 0.22, 0.5);
  shade.blob(F.backpack.x, F.backpack.z, 0.3, 0.5);
  // Worn, darker path from the door into the room.
  shade.draw((ctx, px, pz, PX) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.shadowColor = 'rgba(255,255,255,0.12)';
    ctx.shadowBlur = 50;
    ctx.lineWidth = 0.7 * PX;
    ctx.beginPath();
    ctx.moveTo(px(0.13), pz(0));
    ctx.lineTo(px(0.02), pz(-2.6));
    ctx.lineTo(px(-0.02), pz(-4.9));
    ctx.stroke();
  });
  shade.build(root);
}

// ---------------------------------------------------------------------------
// Door: swings into the room, hinged on the right. Hallway face carries the
// lever and deadbolt (that's the face you see from inside when it's open).
// ---------------------------------------------------------------------------

function buildDoor(M, root) {
  const { x0, x1, height, leafThickness: t } = DOOR;
  const z0 = ROOM.z0, z1 = ROOM.z0 + ROOM.wall;
  const f = 0.055;
  root.add(boxFromBounds(x0 - f, x0, 0, height + f, z0 - 0.015, z1 + 0.015, M.doorFrame));
  root.add(boxFromBounds(x1, x1 + f, 0, height + f, z0 - 0.015, z1 + 0.015, M.doorFrame));
  root.add(boxFromBounds(x0 - f, x1 + f, height, height + f, z0 - 0.015, z1 + 0.015, M.doorFrame));
  root.add(boxFromBounds(x0, x1, 0, 0.006, z0 - 0.02, z1 + 0.02, M.satinMetal, { cast: false }));

  const pivot = new THREE.Group();
  pivot.position.set(x1 - 0.004, 0, z0 + 0.03);
  root.add(pivot);
  const width = x1 - x0 - 0.008;
  const leaf = boxFromBounds(-width, 0, 0.022, height - 0.004, 0, t, M.doorWood);
  applyWorldUVs(leaf, 1.0, 'y');
  pivot.add(leaf);

  // Mortise lock trim on both faces (local +z = hallway face): a tall narrow escutcheon,
  // thumb turn / key cylinder above, lever below pointing toward the hinge.
  const hx = -width + 0.06;
  const hardware = (side) => {
    const z = side > 0 ? t : 0;
    const g = new THREE.Group();
    g.position.set(hx, 0, z);
    pivot.add(g);
    const plate = boxFromBounds(-0.021, 0.021, 1.0, 1.19, 0, side * 0.01, M.hardware);
    g.add(plate);
    const turn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 20), M.hardware);
    turn.rotation.x = Math.PI / 2;
    turn.position.set(0, 1.14, side * 0.016);
    g.add(turn);
    g.add(boxFromBounds(-0.004, 0.004, 1.12, 1.16, side * 0.022, side * 0.028, M.hardware));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.055, 12), M.hardware);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, 1.075, side * 0.03);
    g.add(neck);
    g.add(boxFromBounds(-0.1, 0.012, 1.064, 1.086, side * 0.05 - 0.011, side * 0.05 + 0.011, M.hardware));
    g.add(boxFromBounds(-0.1, -0.085, 1.048, 1.086, side * 0.05 - 0.011, side * 0.05 + 0.011, M.hardware));
  };
  hardware(1);
  hardware(-1);
  for (const y of [0.25, 1.05, 1.85]) pivot.add(boxFromBounds(-0.012, 0.004, y - 0.05, y + 0.05, -0.004, t + 0.004, M.satinMetal));
  const plateTex = labelTexture({ text: '207', background: '#202022', color: '#d9d4c7', border: '#77736a' });
  const number = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 }));
  number.position.set(-width / 2, 1.62, t + 0.002);
  pivot.add(number);

  // Hallway light under the door when it is closed (driven by the lighting rig).
  const LW = 128, LH = 96;
  const leakCanvas = makeCanvas(LW, LH);
  const lctx = leakCanvas.getContext('2d');
  const image = lctx.createImageData(LW, LH);
  for (let y = 0; y < LH; y++) {
    const d = (LH - 1 - y) / LH;
    for (let x = 0; x < LW; x++) {
      const u = Math.abs(x / (LW - 1) - 0.5) * 2;
      const side = Math.max(0, Math.min(1, (0.82 + d * 0.5 - u) / 0.22));
      const a = (Math.exp(-d / 0.035) * 0.6 + Math.exp(-d / 0.16) * 0.4) * side * side;
      const i = (y * LW + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(255 * a);
      image.data[i + 3] = 255;
    }
  }
  lctx.putImageData(image, 0, 0);
  const leakMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe8c2',
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

function buildSwitch(M, root) {
  const { x, y, z } = SWITCH;
  // Plate on the closet side, facing +x.
  root.add(boxFromBounds(x, x + 0.011, y - 0.058, y + 0.058, z - 0.031, z + 0.031, M.switchPlate));
  const pivot = new THREE.Group();
  pivot.position.set(x + 0.011, y, z);
  pivot.add(boxFromBounds(0, 0.016, -0.013, 0.013, -0.006, 0.006, M.switchPlate));
  root.add(pivot);
  for (const dy of [-0.038, 0.038]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), M.satinMetal);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(x + 0.0115, y + dy, z);
    root.add(screw);
  }
  return {
    setOn(on) {
      pivot.rotation.z = on ? 0.32 : -0.32; // toggle up = on
    },
  };
}

function buildWindow(M, root) {
  const { x0, x1, sill, top, headrailTop } = WINDOW;
  const zIn = ROOM.z1;
  const zf = zIn - 0.16;
  const fw = 0.055;
  // Frame, centre mullion and meeting rail.
  root.add(boxFromBounds(x0, x0 + fw, sill, top, zf - 0.04, zf + 0.04, M.windowFrame));
  root.add(boxFromBounds(x1 - fw, x1, sill, top, zf - 0.04, zf + 0.04, M.windowFrame));
  root.add(boxFromBounds(x0, x1, sill, sill + fw, zf - 0.04, zf + 0.04, M.windowFrame));
  root.add(boxFromBounds(x0, x1, top - fw, top, zf - 0.04, zf + 0.04, M.windowFrame));
  const mx = (x0 + x1) / 2;
  root.add(boxFromBounds(mx - 0.035, mx + 0.035, sill, top, zf - 0.05, zf + 0.04, M.windowFrame));
  const meet = sill + (top - sill) * 0.58;
  root.add(boxFromBounds(x0, x1, meet - 0.03, meet + 0.03, zf - 0.05, zf + 0.04, M.windowFrame));
  // Reveal liner (dark) so the deep opening reads like the reference.
  root.add(boxFromBounds(x0 - 0.04, x0, sill, top, zIn - 0.26, zIn, M.windowFrame));
  root.add(boxFromBounds(x1, x1 + 0.04, sill, top, zIn - 0.26, zIn, M.windowFrame));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, top - sill), M.glass);
  glass.position.set(mx, (sill + top) / 2, zf);
  glass.renderOrder = 2;
  root.add(glass);
  // Sill + apron.
  root.add(boxFromBounds(x0 - 0.05, x1 + 0.05, sill - 0.03, sill, zIn - 0.2, zIn + 0.05, M.sill));
  // Raised mini-blind: headrail with the slat stack under it.
  root.add(boxFromBounds(x0 - 0.04, x1 + 0.04, headrailTop - 0.04, headrailTop, zIn - 0.02, zIn + 0.07, M.windowFrame));
  root.add(boxFromBounds(x0 - 0.03, x1 + 0.03, top, headrailTop - 0.04, zIn - 0.01, zIn + 0.045, M.plasticDark));
  const slats = 11;
  for (let i = 0; i < slats; i++) {
    const y = top + 0.01 + ((headrailTop - 0.05 - top) * i) / (slats - 1);
    root.add(boxFromBounds(x0 - 0.025, x1 + 0.025, y - 0.006, y, zIn + 0.045, zIn + 0.06, M.blind, { cast: false }));
  }
}

/** Through-the-wall heating / AC unit under the window. */
function buildWallUnit(M, root) {
  const { x0, x1, z0, z1, height } = WALL_UNIT;
  root.add(boxFromBounds(x0, x1, 0.06, height, z1, z0, M.wallUnit));
  root.add(boxFromBounds(x0 + 0.02, x1 - 0.02, 0, 0.06, z1, z0 - 0.03, M.grille));
  // Discharge grille on top: dark slots.
  const slots = 16;
  for (let i = 0; i < slots; i++) {
    const sx = x0 + 0.07 + ((x1 - x0 - 0.14) * (i + 0.5)) / slots;
    root.add(boxFromBounds(sx - 0.018, sx + 0.018, height - 0.004, height + 0.002, z1 + 0.04, z0 - 0.05, M.grille, { cast: false }));
  }
  // Front intake louvres.
  for (let i = 0; i < 4; i++) {
    const y = 0.08 + i * 0.03;
    root.add(boxFromBounds(x0 + 0.12, x1 - 0.12, y, y + 0.012, z0, z0 + 0.004, M.grille, { cast: false }));
  }
  root.add(boxFromBounds(x1 - 0.13, x1 - 0.05, height - 0.12, height - 0.06, z0, z0 + 0.006, M.grille));
}

function buildDomeLight(M, root) {
  const { x, z } = DOME;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 40), M.satinMetal);
  base.position.set(x, H - 0.015, z);
  root.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 40), M.satinMetal);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, H - 0.06, z);
  root.add(ring);
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: '#efeae0',
    emissive: '#fff1dc',
    emissiveIntensity: 0,
    roughness: 0.35,
    transparent: true,
    opacity: 0.97,
  });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.17, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lensMaterial);
  lens.scale.y = 0.5;
  lens.position.set(x, H - 0.03, z);
  root.add(lens);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), M.satinMetal);
  finial.position.set(x, H - 0.12, z);
  root.add(finial);
  return { ceilingLens: lensMaterial, ceilingLightPosition: new THREE.Vector3(x, H - 0.09, z) };
}

function buildHallway(M, root, add) {
  const { x0, x1, z0, z1, ceiling } = HALL;
  add(boxFromBounds(x0, x1, -0.05, 0, z0, z1, M.hallFloor, { cast: false }), VCT_TILE);
  add(boxFromBounds(x0 - 0.15, x1 + 0.15, 0, H, z1, z1 + 0.15, M.hallWall), PLASTER_TILE);
  add(boxFromBounds(x0 - 0.15, x0, 0, H, z0, z1, M.hallWall), PLASTER_TILE);
  add(boxFromBounds(x1, x1 + 0.15, 0, H, z0, z1, M.hallWall), PLASTER_TILE);
  add(boxFromBounds(x0, x1, ceiling, ceiling + 0.03, z0, z1, M.ceiling, { cast: false }), PLASTER_TILE);
  add(boxFromBounds(x0, x1, 0, 0.1, z1 - 0.01, z1, M.baseboard, { cast: false }));
  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#f1efe8', emissive: '#f4f2ea', emissiveIntensity: 1, roughness: 0.5 });
  root.add(boxFromBounds(-0.45, 0.75, ceiling - 0.02, ceiling, 0.85, 1.45, M.satinMetal, { cast: false }));
  root.add(boxFromBounds(-0.41, 0.71, ceiling - 0.026, ceiling - 0.018, 0.89, 1.41, panelMaterial, { cast: false, receive: false }));
  return { hallPanel: panelMaterial, hallLightPosition: new THREE.Vector3(0.15, ceiling - 0.05, 1.15) };
}

// ---------------------------------------------------------------------------
// Exterior: night sky, pines and the next dorm building across the lawn.
// ---------------------------------------------------------------------------

function buildExterior(root) {
  const group = new THREE.Group();
  group.name = 'exterior';
  root.add(group);
  const groundY = -9.5;

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#1b2333') },
      horizonColor: { value: new THREE.Color('#3a4558') },
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
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        float h = clamp((vUv.y - 0.12) / 0.7, 0.0, 1.0);
        vec3 c = mix(horizonColor, topColor, pow(h, 0.65));
        float clouds = noise(vUv * vec2(9.0, 4.0)) * 0.6 + noise(vUv * vec2(23.0, 9.0)) * 0.4;
        c *= 0.85 + clouds * 0.3;
        gl_FragColor = vec4(c * brightness, 1.0);
      }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(420, 210), skyMaterial);
  sky.position.set(0, 35, -160);
  group.add(sky);

  const facade = facadeTextures();
  const facadeMaterial = new THREE.MeshBasicMaterial({ map: facade.map, color: '#ffffff' });
  const building = new THREE.Mesh(new THREE.PlaneGeometry(30, 11), facadeMaterial);
  building.position.set(-1.5, groundY + 4.3, -75);
  group.add(building);
  const lightsMaterial = new THREE.MeshBasicMaterial({
    map: facade.lights,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const lights = new THREE.Mesh(building.geometry, lightsMaterial);
  lights.position.copy(building.position);
  lights.position.z += 0.05;
  group.add(lights);

  const groundMaterial = new THREE.MeshBasicMaterial({ color: '#3d3f37' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 150), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, groundY, -80);
  group.add(ground);

  // Two layers of pines: a far, hazier row behind the building and tall pines close by
  // filling both sides of the window, leaving the lit building visible in the middle.
  const pineMaterials = [];
  const pineLayer = (seed, trees, width, height, x, z, color) => {
    const material = new THREE.MeshBasicMaterial({ color, alphaMap: pinesTexture(seed, trees), alphaTest: 0.5, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, groundY + height / 2, z);
    group.add(mesh);
    pineMaterials.push({ material, base: new THREE.Color(color) });
  };
  // [x fraction, height fraction]. The near layer is squeezed 2:1 for slender spruces.
  const farRow = [[0.08, 0.5], [0.2, 0.55], [0.31, 0.45], [0.42, 0.58], [0.6, 0.52], [0.71, 0.6], [0.83, 0.48], [0.94, 0.55]];
  const nearPines = [[0.288, 0.86], [0.37, 0.92], [0.43, 0.78], [0.612, 0.84], [0.67, 0.95], [0.745, 0.8]];
  pineLayer(11, farRow, 60, 30, 0, -110, '#1b241f');
  // Low band of trees in front of the building: only its top row of windows shows.
  const midRow = Array.from({ length: 18 }, (_, i) => [0.03 + i * 0.056, 0.26 + ((i * 37) % 11) / 100]);
  pineLayer(17, midRow, 50, 25, 0, -55, '#141c17');
  pineLayer(5, nearPines, 17, 17, -0.4, -21, '#0f1612');

  group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return { sky: skyMaterial, facade: facadeMaterial, facadeLights: lightsMaterial, ground: groundMaterial, pines: pineMaterials };
}
