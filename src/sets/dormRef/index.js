/**
 * SET DEFINITION: dorm room built from the user's reference image.
 * Same interface as src/sets/dorm/index.js (see that file for the contract).
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
  root.name = 'dorm-ref-set';
  scene.add(root);

  const materials = createMaterials();
  const handles = { ...buildArchitecture(materials, root), ...buildFurniture(materials, root) };

  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const lit = mats.some((m) => m.isMeshStandardMaterial);
    o.receiveShadow = lit;
    if (!lit || mats.some((m) => m.transparent)) o.castShadow = false;
  });

  const rig = buildLightRig(scene, handles, { invalidateShadows });

  const state = { door: 'open' };
  let doorAngle = 0;
  let doorAnim = null;
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

  return {
    root,
    rig,
    handles,
    applyState(next = {}, { instant = false, animate = false } = {}) {
      if (next.door !== undefined) {
        setDoor(animate && typeof next.door === 'string' ? { state: next.door, duration: 1.4 } : next.door, instant);
      }
    },
    ensureState(requirements = {}) {
      if (requirements.door && DOOR.order.indexOf(state.door) < DOOR.order.indexOf(requirements.door)) {
        setDoor(requirements.door, true);
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
}

export default {
  id: 'dorm-ref',
  name: 'Dorm room — reference look',
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
  ],
  defaults: { shot: 'R', lighting: 'reference', state: { door: 'open' } },
  build,
};
