/**
 * 2D character cutouts placed in the 3D set.
 *
 * Each character slot is a flat plane textured with a transparent PNG. It
 * stands on a named "mark" (see the set's marks.js), can face the camera
 * (cylindrical billboard) or keep a fixed yaw, and can be scaled, mirrored
 * or turned into a pure black silhouette. The cutout is lit by the scene and
 * casts an alpha-tested shadow, so it sits in the room's lighting.
 */
import * as THREE from 'three';
import { blobTexture } from '../lib/textures.js';
import { drawFigure } from '../lib/placeholderFigure.js';

const DEG = Math.PI / 180;
const POV_HIDE_RADIUS = 0.4; // meters (horizontal) - cutouts this close to the camera are hidden
const loader = new THREE.TextureLoader();

// Unit plane with its origin at the bottom centre (feet).
const planeGeometry = new THREE.PlaneGeometry(1, 1);
planeGeometry.translate(0, 0.5, 0);

/** Accepts a mark id string or a { mark, scale, ... } object; returns a state patch. */
export function parseCharacterSpec(spec) {
  if (typeof spec === 'string') return { mark: spec };
  return { ...spec };
}

class CharacterSlot {
  constructor(def, manager) {
    this.def = def;
    this.manager = manager;
    this.state = {
      visible: !!def.visible,
      mark: def.mark,
      scale: def.scale ?? 1,
      facing: def.facing || 'camera', // 'camera' | 'fixed'
      yaw: def.yaw ?? 0, // extra yaw (degrees) used in 'fixed' facing
      mirror: !!def.mirror,
      silhouette: !!def.silhouette,
    };
    this.textures = {}; // pose -> { texture, aspect }
    this.objectUrls = {};

    this.group = new THREE.Group();
    this.group.name = `character-${def.id}`;
    this.material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
    this.material.alphaToCoverage = true;
    this.mesh = new THREE.Mesh(planeGeometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Soft contact shadow at the feet.
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.004;
    this.group.add(this.blob);

    this.lastShadowYaw = null;
    this.povHidden = false;
    manager.scene.add(this.group);

    for (const [pose, url] of Object.entries(def.images || {})) this.load(pose, url);
    this.apply();
  }

  get mark() {
    return this.manager.marks[this.state.mark] || Object.values(this.manager.marks)[0];
  }

  get pose() {
    return this.mark.pose || 'standing';
  }

  /** Load (or replace) the image for a pose. `source` is a URL or a File. */
  load(pose, source) {
    let url = source;
    if (source instanceof Blob) {
      if (this.objectUrls[pose]) URL.revokeObjectURL(this.objectUrls[pose]);
      url = this.objectUrls[pose] = URL.createObjectURL(source);
    }
    loader.load(
      url,
      (texture) => this.setTexture(pose, texture),
      undefined,
      () => {
        console.warn(`Character ${this.def.id}: could not load "${url}", using a drawn placeholder.`);
        this.setTexture(pose, new THREE.CanvasTexture(drawFigure(document.createElement('canvas'), pose, this.def.placeholder)));
      },
    );
  }

  setTexture(pose, texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const img = texture.image;
    const aspect = img && img.width && img.height ? img.width / img.height : 0.4;
    const previous = this.textures[pose];
    if (previous) previous.texture.dispose();
    this.textures[pose] = { texture, aspect };
    this.apply();
  }

  /** Resolve the texture for the current pose (falls back to the standing image). */
  currentImage() {
    return this.textures[this.pose] || this.textures.standing || null;
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.apply();
  }

  apply() {
    const mark = this.mark;
    const image = this.currentImage();
    this.group.position.fromArray(mark.pos);
    const pose = this.textures[this.pose] ? this.pose : 'standing';
    const heights = this.def.heights || {};
    const height = (heights[pose] ?? (pose === 'seated' ? 1.3 : 1.72)) * this.state.scale;
    const aspect = image ? image.aspect : 0.4;
    this.mesh.scale.set(height * aspect * (this.state.mirror ? -1 : 1), height, 1);

    if (image && this.material.map !== image.texture) {
      this.material.map = image.texture;
      this.material.needsUpdate = true;
    }
    this.material.color.set(this.state.silhouette ? '#000000' : '#ffffff');

    const footprint = pose === 'seated' ? 0.8 : 0.55;
    this.blob.scale.set(footprint * this.state.scale, footprint * 0.75 * this.state.scale, 1);
    this.group.visible = this.state.visible && !!image;
    this._applyPovVisibility();
    this.lastShadowYaw = null; // force a shadow refresh
    this.manager.invalidate();
  }

  _applyPovVisibility() {
    this.mesh.visible = !this.povHidden;
    this.blob.visible = !this.povHidden && this.pose !== 'seated';
  }

  /** Billboarding (cylindrical: rotates about Y only, so the figure never leans). */
  update(camera) {
    if (!this.group.visible) return;
    // POV safety: if the camera is basically inside the cutout (e.g. the narrator's own
    // point of view from the desk chair), don't draw it.
    const dx0 = camera.position.x - this.group.position.x;
    const dz0 = camera.position.z - this.group.position.z;
    const tooClose = dx0 * dx0 + dz0 * dz0 < POV_HIDE_RADIUS * POV_HIDE_RADIUS;
    if (tooClose !== this.povHidden) {
      this.povHidden = tooClose;
      this._applyPovVisibility();
      this.manager.invalidate();
    }
    let yaw;
    if (this.state.facing === 'camera') {
      const dx = camera.position.x - this.group.position.x;
      const dz = camera.position.z - this.group.position.z;
      yaw = Math.atan2(dx, dz);
    } else {
      yaw = (this.mark.yaw + this.state.yaw) * DEG;
    }
    this.mesh.rotation.y = yaw;
    // Shadows are cached; refresh them when the cutout has turned noticeably.
    if (this.lastShadowYaw === null || Math.abs(yaw - this.lastShadowYaw) > 1.5 * DEG) {
      this.lastShadowYaw = yaw;
      this.manager.invalidate();
    }
  }
}

export class CharacterManager extends EventTarget {
  constructor({ scene, marks, slots, onShadowsDirty }) {
    super();
    this.scene = scene;
    this.marks = marks;
    this.onShadowsDirty = onShadowsDirty;
    this.slots = new Map();
    for (const def of slots) this.slots.set(def.id, new CharacterSlot(def, this));
  }

  invalidate() {
    this.onShadowsDirty?.();
  }

  get(id) {
    return this.slots.get(id);
  }

  list() {
    return [...this.slots.values()];
  }

  /** Update one slot: { visible, mark, scale, facing, yaw, mirror, silhouette }. */
  set(id, patch) {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.set(patch);
    this.dispatchEvent(new CustomEvent('change', { detail: { id, state: { ...slot.state } } }));
  }

  /**
   * Storyboard helper: show exactly the characters listed, hide the rest.
   * spec example: { A: 'seatedAtDesk', B: { mark: 'deepBed', silhouette: true } }
   * Unspecified options fall back to the slot's defaults (not to whatever the last shot used).
   */
  showOnly(spec = {}) {
    for (const [id, slot] of this.slots) {
      if (spec[id] === undefined || spec[id] === false || spec[id] === null) {
        this.set(id, { visible: false });
      } else {
        const d = slot.def;
        const defaults = {
          scale: d.scale ?? 1,
          facing: d.facing || 'camera',
          yaw: d.yaw ?? 0,
          mirror: !!d.mirror,
          silhouette: !!d.silhouette,
        };
        this.set(id, { ...defaults, ...parseCharacterSpec(spec[id]), visible: true });
      }
    }
  }

  loadImage(id, pose, source) {
    this.slots.get(id)?.load(pose, source);
  }

  update(camera) {
    for (const slot of this.slots.values()) slot.update(camera);
  }
}
