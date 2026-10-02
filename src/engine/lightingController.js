/**
 * LightingController - blends between lighting presets over time.
 *
 * Presets are plain nested objects of numbers, colour strings ('#rrggbb') and
 * labels. The controller merges each preset over the set's base preset,
 * converts colours to THREE.Color, and every frame hands the blended state to
 * the set's rig (`rig.apply(state, time)`), which knows which actual lights
 * to drive. That keeps this class reusable for any environment.
 */
import * as THREE from 'three';
import { ease } from './easing.js';

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) && !v.isColor;
}

function deepMerge(base, over) {
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(over || {})])) {
    const b = base[key];
    const o = over ? over[key] : undefined;
    if (isPlainObject(b) && isPlainObject(o)) out[key] = deepMerge(b, o);
    else out[key] = o !== undefined ? o : b;
  }
  return out;
}

/** Convert '#rrggbb' strings to THREE.Color (recursively). */
function normalize(value) {
  if (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)) return new THREE.Color(value);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

function cloneState(value) {
  if (value && value.isColor) return value.clone();
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneState(v);
    return out;
  }
  return value;
}

/** out = lerp(a, b, t) for every leaf. Non-numeric leaves switch halfway. */
function blendInto(out, a, b, t) {
  for (const key of Object.keys(b)) {
    const va = a[key];
    const vb = b[key];
    if (typeof vb === 'number') out[key] = va + (vb - va) * t;
    else if (vb && vb.isColor) out[key].copy(va).lerp(vb, t);
    else if (isPlainObject(vb)) blendInto(out[key], va, vb, t);
    else out[key] = t < 0.5 ? va : vb;
  }
}

export class LightingController extends EventTarget {
  constructor(rig, presets, basePreset = {}) {
    super();
    this.rig = rig;
    this.presets = {};
    for (const [id, preset] of Object.entries(presets)) {
      this.presets[id] = normalize(deepMerge(basePreset, preset));
    }
    this.state = null;
    this.from = null;
    this.to = null;
    this.currentId = null;
    this.pendingId = null;
    this.elapsed = 0;
    this.duration = 0;
    this.delay = 0;
  }

  /** The preset that is on screen or being blended to. */
  get activeId() {
    return this.pendingId || this.currentId;
  }

  list() {
    return Object.entries(this.presets).map(([id, p]) => ({ id, label: p.label || id }));
  }

  /**
   * Switch preset.
   * @param {string} id
   * @param {{fade?: number, delay?: number}} [options] fade = blend seconds (0 = cut), delay = wait first
   */
  setPreset(id, { fade = 0, delay = 0 } = {}) {
    const target = this.presets[id];
    if (!target) {
      console.warn(`Unknown lighting preset "${id}"`);
      return;
    }
    if (!this.state) {
      this.state = cloneState(target);
      this.currentId = id;
      this.dispatchEvent(new CustomEvent('change', { detail: { id } }));
      return;
    }
    // Start from whatever is on screen right now (even mid-blend).
    this.from = cloneState(this.state);
    this.to = target;
    this.pendingId = id;
    this.elapsed = 0;
    this.duration = Math.max(0, fade);
    this.delay = Math.max(0, delay);
    if (this.duration === 0 && this.delay === 0) this._finishBlend();
    this.dispatchEvent(new CustomEvent('change', { detail: { id } }));
  }

  _finishBlend() {
    blendInto(this.state, this.from, this.to, 1);
    this.currentId = this.pendingId;
    this.pendingId = null;
  }

  update(dt, time) {
    if (!this.state) return;
    if (this.pendingId) {
      if (this.delay > 0) {
        this.delay -= dt;
      } else {
        this.elapsed += dt;
        const t = this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
        if (t >= 1) this._finishBlend();
        else blendInto(this.state, this.from, this.to, ease('easeInOutSine', t));
      }
    }
    this.rig.apply(this.state, time);
  }
}
