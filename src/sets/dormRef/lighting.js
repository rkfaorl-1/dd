/**
 * Light rig + lighting presets for the reference-look room.
 * Same contract as the other sets: presets are data, the LightingController
 * blends them and calls rig.apply(state, time) every frame.
 */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { flickerMultiplier } from '../../lib/flicker.js';
import { ROOM, WINDOW } from './layout.js';

const FIXTURE_MAX = { ceiling: 6, hall: 12, spill: 7 };
const FLOOR_TINT = new THREE.Color('#5f5d5c'); // bounce from below picks up the dark carpet

export const BASE_PRESET = {
  exposure: 1.0,
  hemi: { sky: '#cfd6de', ground: '#6a625a', intensity: 0.4 },
  sun: { color: '#fff1dc', intensity: 0, elevation: 32, azimuth: 12 },
  window: { color: '#dfe7f2', intensity: 0 },
  sky: { top: '#5f7fa8', horizon: '#c7d3df', brightness: 1 },
  exterior: { tint: '#ffffff', windowsLit: 0, pines: '#2f4237' },
  ceiling: 0,
  ceilingColor: '#fff0dc',
  hall: 0.7,
  flicker: { ceiling: 0, hall: 0 },
  post: { bloom: 0.25, grain: 0.05, vignette: 0.4, lift: 0.01, saturation: 0.85 },
};

export const LIGHTING_PRESETS = {
  reference: {
    label: 'Night · ceiling light',
    exposure: 1.1,
    hemi: { sky: '#8d96a9', ground: '#3d3a36', intensity: 0.18 },
    sun: { color: '#9fb4e0', intensity: 0.22, elevation: 30, azimuth: 12 },
    window: { color: '#6d84b6', intensity: 0.3 },
    sky: { top: '#141a2a', horizon: '#3b4459', brightness: 1 },
    exterior: { tint: '#2a2e36', windowsLit: 0.85, pines: '#0f1612' },
    ceiling: 1,
    hall: 0.65,
    post: { bloom: 0.2, grain: 0.06, vignette: 0.55, lift: 0.01, saturation: 0.66 },
  },
  night: {
    label: 'Night · lights off',
    exposure: 1.22,
    hemi: { sky: '#7f8db3', ground: '#3b352f', intensity: 0.24 },
    sun: { color: '#a9bff0', intensity: 0.6, elevation: 30, azimuth: 12 },
    window: { color: '#7890c8', intensity: 0.6 },
    sky: { top: '#0b111c', horizon: '#232e42', brightness: 1 },
    exterior: { tint: '#2d323f', windowsLit: 0.9, pines: '#111a14' },
    hall: 0.75,
    post: { bloom: 0.42, grain: 0.07, vignette: 0.5, lift: 0.012, saturation: 0.75 },
  },
  day: {
    label: 'Day',
    exposure: 1.0,
    hemi: { sky: '#dde4ec', ground: '#7b7268', intensity: 0.9 },
    sun: { color: '#fff0d6', intensity: 2.8, elevation: 36, azimuth: 14 },
    window: { color: '#e4ecf6', intensity: 7 },
    sky: { top: '#6c90c0', horizon: '#d3dfea', brightness: 1.05 },
    exterior: { tint: '#ffffff', windowsLit: 0, pines: '#3d5a45' },
    hall: 0.7,
    post: { bloom: 0.12, grain: 0.035, vignette: 0.3, lift: 0.01, saturation: 0.9 },
  },
  overcast: {
    label: 'Overcast',
    exposure: 1.08,
    hemi: { sky: '#d2d7dc', ground: '#716e68', intensity: 0.72 },
    sun: { color: '#dfe5ea', intensity: 0, elevation: 55, azimuth: 0 },
    window: { color: '#dde3ea', intensity: 6 },
    sky: { top: '#9ea7b0', horizon: '#d6dadd', brightness: 1 },
    exterior: { tint: '#b9bcbf', windowsLit: 0.06, pines: '#33473b' },
    hall: 0.7,
    post: { bloom: 0.08, grain: 0.045, vignette: 0.35, lift: 0.015, saturation: 0.8 },
  },
  evening: {
    label: 'Evening',
    exposure: 1.0,
    hemi: { sky: '#c29a80', ground: '#4b3b31', intensity: 0.32 },
    sun: { color: '#ff9b55', intensity: 2.2, elevation: 9, azimuth: -24 },
    window: { color: '#f0a571', intensity: 2.4 },
    sky: { top: '#36456b', horizon: '#ef9a63', brightness: 1 },
    exterior: { tint: '#9c8b80', windowsLit: 0.55, pines: '#26301f' },
    ceiling: 0.75,
    ceilingColor: '#ffd9a8',
    hall: 0.85,
    post: { bloom: 0.25, grain: 0.05, vignette: 0.42, lift: 0.01, saturation: 0.85 },
  },
  flicker: {
    label: 'Flicker test',
    exposure: 1.1,
    hemi: { sky: '#8d96a9', ground: '#3d3a36', intensity: 0.11 },
    sun: { color: '#9fb4e0', intensity: 0.22, elevation: 30, azimuth: 12 },
    window: { color: '#6d84b6', intensity: 0.3 },
    sky: { top: '#121926', horizon: '#2c374a', brightness: 1 },
    exterior: { tint: '#3a404d', windowsLit: 0.85, pines: '#172219' },
    ceiling: 0.9,
    ceilingColor: '#eef2ff',
    hall: 0.65,
    flicker: { ceiling: 0.9, hall: 0.5 },
    post: { bloom: 0.22, grain: 0.065, vignette: 0.55, lift: 0.01, saturation: 0.72 },
  },
};

export function buildLightRig(scene, handles, { invalidateShadows }) {
  RectAreaLightUniformsLib.init();
  const lights = {};

  lights.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.4);
  lights.bounce = new THREE.HemisphereLight('#ffffff', '#444444', 0);
  scene.add(lights.hemi, lights.bounce);

  const sun = new THREE.DirectionalLight('#ffffff', 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 2.5;
  sun.target.position.set(0, 0.6, -3.2);
  scene.add(sun, sun.target);
  lights.sun = sun;

  lights.window = new THREE.RectAreaLight('#ffffff', 0, WINDOW.x1 - WINDOW.x0, WINDOW.top - WINDOW.sill);
  lights.window.position.set((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.sill + WINDOW.top) / 2, ROOM.z1 - 0.02);
  lights.window.lookAt(0, 0.9, -1.5);
  scene.add(lights.window);

  // The dome shines down (its base blocks the ceiling), so a very wide spot, not a point light.
  const ceiling = new THREE.SpotLight('#ffffff', 0, 0, THREE.MathUtils.degToRad(86), 1, 2);
  ceiling.position.copy(handles.ceilingLightPosition);
  ceiling.target.position.set(ceiling.position.x, 0, ceiling.position.z);
  ceiling.castShadow = true;
  ceiling.shadow.focus = 0.86;
  ceiling.shadow.mapSize.set(2048, 2048);
  ceiling.shadow.camera.near = 0.05;
  ceiling.shadow.camera.far = 9;
  ceiling.shadow.bias = -0.0006;
  ceiling.shadow.radius = 4;
  scene.add(ceiling, ceiling.target);
  lights.ceiling = ceiling;

  const hall = new THREE.SpotLight('#f1f3ec', 0, 0, THREE.MathUtils.degToRad(84), 1, 2);
  hall.position.copy(handles.hallLightPosition);
  hall.target.position.set(handles.hallLightPosition.x, 0, handles.hallLightPosition.z - 0.15);
  hall.castShadow = true;
  hall.shadow.focus = 0.78;
  hall.shadow.mapSize.set(1024, 1024);
  hall.shadow.camera.near = 0.1;
  hall.shadow.camera.far = 10;
  hall.shadow.bias = -0.0008;
  hall.shadow.radius = 2;
  scene.add(hall, hall.target);
  lights.hall = hall;
  // Hallway light spilling in through the open doorway behind the camera: it is what
  // lights the switch wall and the door leaf in the reference.
  const spill = new THREE.PointLight('#efe9de', 0, 3.4, 2);
  spill.position.set((handles.doorway.x0 + handles.doorway.x1) / 2, 1.9, 0.05);
  scene.add(spill);
  lights.spill = spill;

  const sunDir = new THREE.Vector3();
  let lastSunKey = '';
  const scratch = new THREE.Color();

  function apply(state, time) {
    const fCeil = flickerMultiplier(time, state.flicker.ceiling, 1);
    const fHall = flickerMultiplier(time, state.flicker.hall, 3);

    lights.hemi.color.copy(state.hemi.sky);
    lights.hemi.groundColor.copy(state.hemi.ground);
    lights.hemi.intensity = state.hemi.intensity;

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

    const ceilingLevel = state.ceiling * fCeil;
    ceiling.color.copy(state.ceilingColor);
    ceiling.intensity = ceilingLevel * FIXTURE_MAX.ceiling;
    handles.ceilingLens.emissive.copy(state.ceilingColor);
    handles.ceilingLens.emissiveIntensity = ceilingLevel * 1.8;
    handles.switchToggle.setOn(state.ceiling > 0.05);
    // Indirect light from the dome bouncing off walls and ceiling.
    lights.bounce.intensity = ceilingLevel * 0.35;
    lights.bounce.color.copy(state.ceilingColor);
    lights.bounce.groundColor.copy(state.ceilingColor).multiply(FLOOR_TINT);

    const hallLevel = state.hall * fHall;
    hall.intensity = hallLevel * FIXTURE_MAX.hall;
    const doorOpen = THREE.MathUtils.clamp(Math.abs(THREE.MathUtils.radToDeg(handles.door.pivot.rotation.y)) / 60, 0, 1);
    lights.spill.intensity = hallLevel * doorOpen * FIXTURE_MAX.spill;
    handles.hallPanel.emissiveIntensity = hallLevel * 1.6;
    const doorAngle = Math.abs(THREE.MathUtils.radToDeg(handles.door.pivot.rotation.y));
    handles.door.leakMaterial.opacity = hallLevel * (1 - THREE.MathUtils.clamp(doorAngle / 8, 0, 1)) * 0.32;

    const ext = handles.exterior;
    ext.sky.uniforms.topColor.value.copy(state.sky.top);
    ext.sky.uniforms.horizonColor.value.copy(state.sky.horizon);
    ext.sky.uniforms.brightness.value = state.sky.brightness;
    ext.facade.color.copy(state.exterior.tint);
    ext.ground.color.set('#3d3f37').multiply(state.exterior.tint);
    ext.facadeLights.opacity = state.exterior.windowsLit;
    for (const { material } of ext.pines) material.color.copy(state.exterior.pines);
    // Far pines read a little lighter (atmospheric haze).
    if (ext.pines[0]) ext.pines[0].material.color.lerp(scratch.copy(state.sky.horizon), 0.25);
  }

  return { lights, apply };
}
