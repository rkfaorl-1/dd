/**
 * Dorm lighting: the physical light rig + lighting presets.
 *
 * Presets are plain data (see LIGHTING_PRESETS below). The engine's
 * LightingController blends between them over time and calls `rig.apply(state)`
 * every frame; this file maps those abstract values (dimmer 0..1, colours,
 * sun angle...) onto the actual three.js lights and emissive materials.
 *
 * Fixture dimmers (`ceiling`, `lamp`, `laptop`, `hall`) are 0..1 so presets stay
 * readable; their physical maxima live in FIXTURE_MAX.
 */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { hash1, smoothNoise1 } from '../../lib/noise.js';
import { ROOM, WINDOW, DOOR } from './layout.js';

/** Physical intensity at dimmer = 1 (candela for point/spot lights). */
const LAMP_COLOR = new THREE.Color('#ffc98a');
const FLOOR_TINT = new THREE.Color('#8a7f72'); // bounce from below picks up the carpet colour

const FIXTURE_MAX = {
  ceiling: 9,
  lampSpot: 1.7,
  lampGlow: 0.45,
  laptop: 2.2,
  hallSpot: 16,
};

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Every preset is merged over this base, so presets only list what differs. */
export const BASE_PRESET = {
  exposure: 1.0,
  hemi: { sky: '#cfd6de', ground: '#6f655a', intensity: 0.5 },
  sun: { color: '#fff1dc', intensity: 0, elevation: 38, azimuth: 18 },
  window: { color: '#dfe7f2', intensity: 0 },
  sky: { top: '#6f8fb8', horizon: '#c9d6e3', brightness: 1 },
  exterior: { tint: '#ffffff', windowsLit: 0, streetLamp: 0 },
  ceiling: 0,
  ceilingColor: '#fff1dc',
  lamp: 0,
  laptop: 0,
  hall: 0.85,
  flicker: { ceiling: 0, lamp: 0, hall: 0 },
  post: { bloom: 0.2, grain: 0.045, vignette: 0.28, lift: 0.0 },
};

export const LIGHTING_PRESETS = {
  day: {
    label: 'Day',
    exposure: 1.0,
    hemi: { sky: '#dde4ec', ground: '#857867', intensity: 0.95 },
    sun: { color: '#fff0d6', intensity: 3.0, elevation: 36, azimuth: 16 },
    window: { color: '#e4ecf6', intensity: 7.5 },
    sky: { top: '#6c90c0', horizon: '#d3dfea', brightness: 1.05 },
    exterior: { tint: '#ffffff', windowsLit: 0, streetLamp: 0 },
    hall: 0.8,
    post: { bloom: 0.12, grain: 0.03, vignette: 0.22, lift: 0.01 },
  },
  overcast: {
    label: 'Overcast',
    exposure: 1.08,
    hemi: { sky: '#d2d7dc', ground: '#77746d', intensity: 0.75 },
    sun: { color: '#dfe5ea', intensity: 0, elevation: 55, azimuth: 0 },
    window: { color: '#dde3ea', intensity: 6.5 },
    sky: { top: '#a4acb5', horizon: '#d9dde0', brightness: 1.0 },
    exterior: { tint: '#bfc2c5', windowsLit: 0.08, streetLamp: 0 },
    hall: 0.8,
    post: { bloom: 0.08, grain: 0.04, vignette: 0.26, lift: 0.015 },
  },
  evening: {
    label: 'Evening',
    exposure: 1.0,
    hemi: { sky: '#c29a80', ground: '#4b3b31', intensity: 0.38 },
    sun: { color: '#ff9b55', intensity: 2.6, elevation: 9, azimuth: -26 },
    window: { color: '#f0a571', intensity: 2.8 },
    sky: { top: '#36456b', horizon: '#ef9a63', brightness: 1.0 },
    exterior: { tint: '#9c8b80', windowsLit: 0.55, streetLamp: 0.55 },
    ceiling: 0.8,
    ceilingColor: '#ffd9a8',
    hall: 1.0,
    post: { bloom: 0.25, grain: 0.045, vignette: 0.3, lift: 0.01 },
  },
  night: {
    label: 'Night',
    exposure: 1.2,
    hemi: { sky: '#7f8db3', ground: '#3b352f', intensity: 0.25 },
    sun: { color: '#a9bff0', intensity: 0.6, elevation: 32, azimuth: 20 },
    window: { color: '#7890c8', intensity: 0.6 },
    sky: { top: '#04070e', horizon: '#18203a', brightness: 1.0 },
    exterior: { tint: '#2d323f', windowsLit: 0.9, streetLamp: 1 },
    hall: 0.85,
    post: { bloom: 0.42, grain: 0.07, vignette: 0.42, lift: 0.012 },
  },
  nightLamp: {
    label: 'Night + desk lamp',
    exposure: 1.1,
    hemi: { sky: '#7f8db3', ground: '#3f3328', intensity: 0.15 },
    sun: { color: '#a9bff0', intensity: 0.45, elevation: 32, azimuth: 20 },
    window: { color: '#7890c8', intensity: 0.45 },
    sky: { top: '#04070e', horizon: '#18203a', brightness: 1.0 },
    exterior: { tint: '#2d323f', windowsLit: 0.9, streetLamp: 1 },
    lamp: 1,
    laptop: 0.85,
    hall: 0.85,
    post: { bloom: 0.45, grain: 0.07, vignette: 0.45, lift: 0.01 },
  },
  flicker: {
    label: 'Flicker test',
    exposure: 1.05,
    hemi: { sky: '#8a93ab', ground: '#3b352f', intensity: 0.14 },
    sun: { color: '#a9bff0', intensity: 0.35, elevation: 32, azimuth: 20 },
    window: { color: '#7890c8', intensity: 0.35 },
    sky: { top: '#04070e', horizon: '#18203a', brightness: 1.0 },
    exterior: { tint: '#2d323f', windowsLit: 0.85, streetLamp: 1 },
    ceiling: 0.72,
    ceilingColor: '#e9f0ff',
    hall: 0.85,
    flicker: { ceiling: 0.9, lamp: 0.35, hall: 0.55 },
    post: { bloom: 0.35, grain: 0.07, vignette: 0.4, lift: 0.01 },
  },
};

// ---------------------------------------------------------------------------
// Flicker
// ---------------------------------------------------------------------------

/**
 * Practical-light instability: a faint constant shimmer, a slow wander and
 * occasional short dropouts (a failing ballast / loose bulb). Deterministic in
 * time, so a recorded take can be reproduced exactly.
 */
export function flickerMultiplier(t, amount, seed = 0) {
  if (amount <= 0) return 1;
  const shimmer = (smoothNoise1(t * 31 + seed * 7.1) - 0.5) * 0.07;
  const wander = (smoothNoise1(t * 0.9 + seed * 3.3) - 0.5) * 0.14;
  const rate = 2.4;
  const slotTime = t * rate + seed * 0.37;
  const slot = Math.floor(slotTime);
  const local = slotTime - slot;
  let dip = 0;
  if (hash1(slot * 1.37 + seed) < 0.22 * amount) {
    const start = hash1(slot + 11.5) * 0.6;
    const length = 0.05 + hash1(slot + 21.7) * 0.16;
    if (local > start && local < start + length) {
      dip = 0.3 + hash1(slot + 31.9) * 0.6;
      // Double-blink inside some dropouts.
      if (hash1(slot + 41.3) > 0.6 && local > start + length * 0.4 && local < start + length * 0.6) dip *= 0.25;
    }
  }
  return Math.max(0, 1 + (shimmer + wander) * amount - dip * amount);
}

// ---------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------

export function buildLightRig(scene, handles, { invalidateShadows }) {
  RectAreaLightUniformsLib.init();
  const lights = {};

  // Ambient bounce approximation.
  lights.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.5);
  scene.add(lights.hemi);
  // Indirect light from the practicals (ceiling fixture / desk lamp bouncing off walls and floor).
  // Driven automatically by the fixture levels, so presets don't have to fake it.
  lights.bounce = new THREE.HemisphereLight('#ffffff', '#444444', 0);
  scene.add(lights.bounce);

  // Sun / moon through the window (shadowed: the window frame and blind slats cast stripes).
  const sun = new THREE.DirectionalLight('#ffffff', 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -4.2;
  sc.right = 4.2;
  sc.top = 4.2;
  sc.bottom = -4.2;
  sc.near = 1;
  sc.far = 30;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 2.5;
  sun.target.position.set(0, 0.6, -3.4);
  scene.add(sun, sun.target);
  lights.sun = sun;

  // Soft skylight from the window opening.
  const windowW = WINDOW.x1 - WINDOW.x0;
  const windowH = WINDOW.top - WINDOW.sill;
  lights.window = new THREE.RectAreaLight('#ffffff', 0, windowW, windowH);
  lights.window.position.set((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.sill + WINDOW.top) / 2, ROOM.z1 - 0.02);
  lights.window.lookAt(0, 0.9, -1.5);
  scene.add(lights.window);

  // Ceiling fixture (shadowed point light).
  const ceiling = new THREE.PointLight('#ffffff', 0, 0, 2);
  ceiling.position.copy(handles.ceilingLensPosition);
  ceiling.castShadow = true;
  ceiling.shadow.mapSize.set(1024, 1024);
  ceiling.shadow.camera.near = 0.05;
  ceiling.shadow.camera.far = 9;
  ceiling.shadow.bias = -0.002;
  ceiling.shadow.radius = 3;
  scene.add(ceiling);
  lights.ceiling = ceiling;

  // Desk lamp: shadowed spot onto the desk + a short-range glow for the shade bounce.
  const lampSpot = new THREE.SpotLight('#ffcf94', 0, 0, THREE.MathUtils.degToRad(56), 0.6, 2);
  lampSpot.position.copy(handles.lampLightPosition);
  lampSpot.target.position.copy(handles.lampTarget);
  lampSpot.castShadow = true;
  lampSpot.shadow.mapSize.set(1024, 1024);
  lampSpot.shadow.camera.near = 0.03;
  lampSpot.shadow.camera.far = 7;
  lampSpot.shadow.bias = -0.0008;
  lampSpot.shadow.radius = 2;
  scene.add(lampSpot, lampSpot.target);
  lights.lampSpot = lampSpot;
  const lampGlow = new THREE.PointLight('#ffc98a', 0, 1.45, 2);
  lampGlow.position.copy(handles.lampLightPosition).add(new THREE.Vector3(0, 0.05, 0));
  scene.add(lampGlow);
  lights.lampGlow = lampGlow;

  // Laptop screen glow (cool, soft).
  lights.laptop = new THREE.RectAreaLight('#bcd0ff', 0, 0.3, 0.2);
  lights.laptop.position.copy(handles.laptopLightPosition);
  lights.laptop.lookAt(handles.laptopLightPosition.clone().add(new THREE.Vector3(1, 0.15, 0)));
  scene.add(lights.laptop);

  // Hallway fluorescents: two shadowed spots so light only enters the room through the doorway.
  lights.hall = handles.hallLightX.map((x) => {
    // Very wide cone with full penumbra = no visible cone edge on the walls. The shadow
    // frustum is narrower (focus) but still covers everything the doorway can see.
    const spot = new THREE.SpotLight('#f1f3ec', 0, 0, THREE.MathUtils.degToRad(84), 1, 2);
    spot.position.set(x, 2.4, 1.15);
    spot.target.position.set(x, 0, 1.0);
    spot.castShadow = true;
    spot.shadow.focus = 0.78;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = 10;
    spot.shadow.bias = -0.0008;
    spot.shadow.radius = 2;
    scene.add(spot, spot.target);
    return spot;
  });

  // Scratch values reused every frame.
  const sunDir = new THREE.Vector3();
  let lastSunKey = '';
  const exteriorTint = new THREE.Color();
  const scratch = new THREE.Color();

  /** Push a blended preset state into the scene. Called every frame by the LightingController. */
  function apply(state, time) {
    const fCeil = flickerMultiplier(time, state.flicker.ceiling, 1);
    const fLamp = flickerMultiplier(time, state.flicker.lamp, 2);
    const fHall = flickerMultiplier(time, state.flicker.hall, 3);

    // Ambient
    lights.hemi.color.copy(state.hemi.sky);
    lights.hemi.groundColor.copy(state.hemi.ground);
    lights.hemi.intensity = state.hemi.intensity;

    // Sun / moon direction (re-render shadows only when it actually moves).
    const el = THREE.MathUtils.degToRad(state.sun.elevation);
    const az = THREE.MathUtils.degToRad(state.sun.azimuth);
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 14);
    const key = `${state.sun.elevation.toFixed(2)}:${state.sun.azimuth.toFixed(2)}`;
    if (key !== lastSunKey) {
      lastSunKey = key;
      invalidateShadows();
    }
    sun.color.copy(state.sun.color);
    sun.intensity = state.sun.intensity;

    lights.window.color.copy(state.window.color);
    lights.window.intensity = state.window.intensity;

    // Practicals
    const ceilingLevel = state.ceiling * fCeil;
    lights.ceiling.color.copy(state.ceilingColor);
    lights.ceiling.intensity = ceilingLevel * FIXTURE_MAX.ceiling;
    handles.ceilingLens.emissive.copy(state.ceilingColor);
    handles.ceilingLens.emissiveIntensity = ceilingLevel * 2.2;
    handles.switchToggle.setOn(state.ceiling > 0.05);

    const lampLevel = state.lamp * fLamp;
    // Bounce: mostly from the ceiling fixture (it lights the whole room), a little from the lamp.
    const ceilBounce = ceilingLevel * 0.42;
    const lampBounce = lampLevel * 0.06;
    lights.bounce.intensity = ceilBounce + lampBounce;
    if (lights.bounce.intensity > 0) {
      lights.bounce.color.copy(state.ceilingColor).multiplyScalar(ceilBounce).add(scratch.copy(LAMP_COLOR).multiplyScalar(lampBounce));
      lights.bounce.color.multiplyScalar(1 / lights.bounce.intensity);
      lights.bounce.groundColor.copy(lights.bounce.color).multiply(FLOOR_TINT);
    }
    lights.lampSpot.intensity = lampLevel * FIXTURE_MAX.lampSpot;
    lights.lampGlow.intensity = lampLevel * FIXTURE_MAX.lampGlow;
    handles.lampBulb.emissiveIntensity = lampLevel * 6;

    lights.laptop.intensity = state.laptop * FIXTURE_MAX.laptop;
    handles.laptopScreen.emissiveIntensity = state.laptop * 0.9;

    const hallLevel = state.hall * fHall;
    for (const spot of lights.hall) spot.intensity = hallLevel * FIXTURE_MAX.hallSpot;
    handles.hallPanels.emissiveIntensity = hallLevel * 1.6;

    // Light under the door fades out as the door opens (the real doorway light takes over).
    const doorAngle = Math.abs(THREE.MathUtils.radToDeg(handles.door.pivot.rotation.y));
    const closedness = 1 - THREE.MathUtils.clamp(doorAngle / 8, 0, 1);
    handles.door.leakMaterial.opacity = hallLevel * closedness * 0.32;

    // Smoke detector LED: brief blink every few seconds.
    const blink = (time % 6) < 0.12;
    handles.smokeLed.color.set(blink ? '#ff2a1a' : '#2a0604');

    // Exterior backdrop.
    const ext = handles.exterior;
    ext.sky.uniforms.topColor.value.copy(state.sky.top);
    ext.sky.uniforms.horizonColor.value.copy(state.sky.horizon);
    ext.sky.uniforms.brightness.value = state.sky.brightness;
    exteriorTint.copy(state.exterior.tint);
    ext.facade.color.copy(exteriorTint);
    ext.ground.color.set('#4c4a3f').multiply(exteriorTint);
    ext.path.color.set('#6c6a62').multiply(exteriorTint);
    ext.tree.color.set('#2a2622').multiply(scratch.copy(exteriorTint).multiplyScalar(0.8));
    ext.pole.color.set('#262626').multiply(exteriorTint);
    ext.facadeLights.opacity = state.exterior.windowsLit;
    ext.lamp.color.set('#5a554d').lerp(scratch.set('#ffd9a0').multiplyScalar(2.2), state.exterior.streetLamp);
  }

  return { lights, apply };
}

/** Door openness helper for presets / UI (0 = closed, 1 = fully open). */
export function doorOpenAmount(angleDeg) {
  return THREE.MathUtils.clamp(angleDeg / DOOR.states.open, 0, 1);
}
