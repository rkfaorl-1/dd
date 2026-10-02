/**
 * SET DEFINITION: shared double room in an American college dormitory.
 *
 * A "set" bundles everything environment-specific. The engine (src/engine/*)
 * only talks to this interface, so a new environment (apartment, motel room,
 * office at night...) is a new folder exporting the same shape:
 *
 *   id, name
 *   shots            camera presets             (shots.js)
 *   marks            character positions         (marks.js)
 *   lightingPresets  lighting moods              (lighting.js)
 *   basePreset       defaults merged into every lighting preset
 *   sequences        storyboards                 (sequences.js)
 *   stateControls    set-state switches the UI should offer (door, ...)
 *   defaults         initial shot / lighting / state
 *   build(ctx)       creates geometry + lights, returns a SetInstance:
 *                      { root, rig, update(dt, time), applyState(state, opts),
 *                        ensureState(requirements), getState() }
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { buildArchitecture } from './architecture.js';
import { buildFurniture } from './furniture.js';
import { buildLightRig, LIGHTING_PRESETS, BASE_PRESET } from './lighting.js';
import { SHOTS } from './shots.js';
import { MARKS } from './marks.js';
import { SEQUENCES } from './sequences.js';
import { DOOR } from './layout.js';
import { ease } from '../../engine/easing.js';

function build({ scene, invalidateShadows }) {
  const root = new THREE.Group();
  root.name = 'dorm-set';
  scene.add(root);

  const materials = createMaterials();
  const handles = {
    ...buildArchitecture(materials, root),
    ...buildFurniture(materials, root),
  };

  // Every lit surface receives shadows; transparent / unlit decals don't cast.
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const lit = mats.some((m) => m.isMeshStandardMaterial);
    o.receiveShadow = lit;
    if (!lit || mats.some((m) => m.transparent)) o.castShadow = false;
  });

  const rig = buildLightRig(scene, handles, { invalidateShadows });

  // ---- Set state: door + roommate's bed -----------------------------------
  const state = { door: 'closed', roommateBed: 'empty' };
  let doorAngle = 0;
  let doorAnim = null; // { from, to, elapsed, duration, delay }

  function setDoor(spec, instant) {
    const s = typeof spec === 'string' ? { state: spec } : spec;
    if (!(s.state in DOOR.states)) return;
    state.door = s.state;
    const to = DOOR.states[s.state];
    const duration = instant ? 0 : s.duration ?? 0;
    const delay = instant ? 0 : s.delay ?? 0;
    if (duration <= 0 && delay <= 0) {
      doorAnim = null;
      doorAngle = to;
      handles.door.setAngle(doorAngle);
      invalidateShadows();
    } else {
      doorAnim = { from: doorAngle, to, elapsed: 0, duration: Math.max(duration, 0.001), delay };
    }
  }

  const instance = {
    root,
    rig,
    handles,
    /** Apply set state. opts.animate gives UI-triggered door moves a natural swing. */
    applyState(next = {}, { instant = false, animate = false } = {}) {
      if (next.door !== undefined) {
        const spec = animate && typeof next.door === 'string' ? { state: next.door, duration: 1.4 } : next.door;
        setDoor(spec, instant);
      }
      if (next.roommateBed !== undefined) {
        state.roommateBed = next.roommateBed;
        handles.roommateBed.setOccupied(next.roommateBed === 'occupied');
        invalidateShadows();
      }
    },
    /** Make sure the set satisfies a shot's requirements (e.g. door open for a dolly through it). */
    ensureState(requirements = {}) {
      if (requirements.door) {
        const have = DOOR.order.indexOf(state.door);
        const need = DOOR.order.indexOf(requirements.door);
        if (have < need) setDoor(requirements.door, true);
      }
    },
    getState() {
      return { ...state };
    },
    update(dt) {
      if (!doorAnim) return;
      if (doorAnim.delay > 0) {
        doorAnim.delay -= dt;
        return;
      }
      doorAnim.elapsed += dt;
      const t = Math.min(1, doorAnim.elapsed / doorAnim.duration);
      doorAngle = doorAnim.from + (doorAnim.to - doorAnim.from) * ease('easeInOutSine', t);
      handles.door.setAngle(doorAngle);
      invalidateShadows();
      if (t >= 1) doorAnim = null;
    },
  };
  return instance;
}

export default {
  id: 'dorm-double',
  name: 'Dorm room — shared double',
  shots: SHOTS,
  marks: MARKS,
  lightingPresets: LIGHTING_PRESETS,
  basePreset: BASE_PRESET,
  sequences: SEQUENCES,
  stateControls: [
    {
      key: 'door',
      label: 'Door',
      options: [
        { value: 'closed', label: 'Closed' },
        { value: 'ajar', label: 'Ajar' },
        { value: 'open', label: 'Open' },
      ],
    },
    {
      key: 'roommateBed',
      label: "Roommate's bed",
      options: [
        { value: 'empty', label: 'Empty' },
        { value: 'occupied', label: 'Occupied' },
      ],
    },
  ],
  defaults: {
    shot: 'F',
    lighting: 'night',
    state: { door: 'closed', roommateBed: 'empty' },
  },
  build,
};
