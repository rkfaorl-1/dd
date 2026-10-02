/**
 * CameraDirector - plays camera shot presets.
 *
 * A shot interpolates position, look-at target, focal length and roll from a
 * start pose to an end pose with an easing curve. On top of that the director
 * can add subtle "handheld" drift, and it can hand the camera to OrbitControls
 * for debugging / finding new framings.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ease } from './easing.js';
import { smoothNoise1 } from '../lib/noise.js';

const toVec = (a) => new THREE.Vector3().fromArray(a);
const DEG = Math.PI / 180;

export class CameraDirector extends EventTarget {
  constructor(camera, domElement) {
    super();
    this.camera = camera;
    // Treat focal lengths like a full-frame stills/cine camera (36 mm wide sensor).
    this.camera.filmGauge = 36;
    this.domElement = domElement;

    this.shot = null; // compiled shot
    this.elapsed = 0;
    this.duration = 1;
    this.playing = false;
    this.loop = false;

    this.handheld = 0; // user setting, 0..1
    this.handheldOverride = null; // set by the sequence player per step
    this.time = 0;

    this.pose = {
      position: new THREE.Vector3(0, 1.6, 2),
      target: new THREE.Vector3(0, 1, 0),
      lens: 24,
      roll: 0,
      shift: [0, 0], // lens shift as a fraction of the frame (keeps verticals straight)
    };
    this._appliedShift = [0, 0];
    this.orbit = null;
  }

  /** Pre-convert a shot definition into vectors. */
  static compile(shot) {
    return {
      def: shot,
      startPos: toVec(shot.startPos),
      endPos: toVec(shot.endPos || shot.startPos),
      target: toVec(shot.target),
      endTarget: toVec(shot.endTarget || shot.target),
      lens: shot.lens ?? 24,
      endLens: shot.endLens ?? shot.lens ?? 24,
      roll: shot.roll ?? 0,
      endRoll: shot.endRoll ?? shot.roll ?? 0,
      shift: shot.shift || [0, 0],
      endShift: shot.endShift || shot.shift || [0, 0],
      easing: shot.easing || 'easeInOutSine',
    };
  }

  /** Start a shot from the beginning (or `startAt` seconds in). */
  play(shot, { duration, startAt = 0 } = {}) {
    this.shot = CameraDirector.compile(shot);
    this.duration = Math.max(0.1, duration ?? shot.duration ?? 6);
    this.elapsed = Math.min(startAt, this.duration);
    this.playing = true;
    this.completed = false;
    this._evaluate();
    this._applyToCamera();
    this.dispatchEvent(new CustomEvent('shotstart', { detail: { shot } }));
  }

  /** Jump to a normalized point (0..1) of the current shot and hold there. */
  hold(progress) {
    if (!this.shot) return;
    this.elapsed = this.duration * THREE.MathUtils.clamp(progress, 0, 1);
    this.playing = false;
    this._evaluate();
  }

  get progress() {
    return this.shot ? Math.min(1, this.elapsed / this.duration) : 0;
  }

  _evaluate() {
    const s = this.shot;
    if (!s) return;
    const t = ease(s.easing, this.elapsed / this.duration);
    this.pose.position.lerpVectors(s.startPos, s.endPos, t);
    this.pose.target.lerpVectors(s.target, s.endTarget, t);
    this.pose.lens = s.lens + (s.endLens - s.lens) * t;
    this.pose.roll = s.roll + (s.endRoll - s.roll) * t;
    this.pose.shift[0] = s.shift[0] + (s.endShift[0] - s.shift[0]) * t;
    this.pose.shift[1] = s.shift[1] + (s.endShift[1] - s.shift[1]) * t;
  }

  update(dt) {
    this.time += dt;
    if (this.orbit) {
      this.orbit.update();
      return;
    }
    if (this.shot && this.playing) {
      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        if (this.loop) {
          this.elapsed %= this.duration;
        } else {
          this.elapsed = this.duration;
          this.playing = false;
          if (!this.completed) {
            this.completed = true;
            this.dispatchEvent(new CustomEvent('shotend', { detail: { shot: this.shot.def } }));
          }
        }
      }
      this._evaluate();
    }
    this._applyToCamera();
  }

  _applyToCamera() {
    const cam = this.camera;
    const amount = this.handheldOverride ?? this.handheld;
    cam.position.copy(this.pose.position);
    if (amount > 0) {
      // Slow, layered drift: breathing + small corrections. Millimetres, not earthquakes.
      const t = this.time;
      const n = (o, f) => (smoothNoise1(t * f + o) - 0.5) * 2;
      cam.position.x += (n(1, 0.5) * 0.006 + n(7, 1.6) * 0.002) * amount;
      cam.position.y += (n(2, 0.45) * 0.006 + n(8, 1.9) * 0.002) * amount;
      cam.position.z += n(3, 0.4) * 0.004 * amount;
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(this.pose.target);
    let roll = this.pose.roll * DEG;
    if (amount > 0) {
      const t = this.time;
      const n = (o, f) => (smoothNoise1(t * f + o) - 0.5) * 2;
      cam.rotateY((n(4, 0.55) * 0.35 + n(9, 1.7) * 0.08) * DEG * amount);
      cam.rotateX((n(5, 0.5) * 0.3 + n(10, 2.1) * 0.07) * DEG * amount);
      roll += n(6, 0.35) * 0.4 * DEG * amount;
    }
    if (roll) cam.rotateZ(roll);
    this._applyShift(this.pose.shift);
    if (Math.abs(cam.getFocalLength() - this.pose.lens) > 1e-3) cam.setFocalLength(this.pose.lens);
  }

  /** Off-axis (shifted) projection: like a tilt-shift / architectural lens. */
  _applyShift([sx, sy]) {
    const [ax, ay] = this._appliedShift;
    if (Math.abs(sx - ax) < 1e-5 && Math.abs(sy - ay) < 1e-5) return;
    this._appliedShift = [sx, sy];
    if (Math.abs(sx) < 1e-5 && Math.abs(sy) < 1e-5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(1, 1, sx, sy, 1, 1);
  }

  /** Hand the camera to OrbitControls (debug / framing tool) or give it back to the shot. */
  setDebugOrbit(enabled) {
    if (enabled && !this.orbit) {
      this.orbit = new OrbitControls(this.camera, this.domElement);
      this.orbit.target.copy(this.pose.target);
      this.orbit.enableDamping = true;
      this.orbit.dampingFactor = 0.1;
      this.orbit.update();
    } else if (!enabled && this.orbit) {
      this.orbit.dispose();
      this.orbit = null;
      this._evaluate();
      this._applyToCamera();
    }
    this.dispatchEvent(new CustomEvent('debug', { detail: { enabled: !!this.orbit } }));
  }

  /** The actual current camera pose (what you see), for "copy pose" / authoring. */
  currentPose() {
    const target = this.orbit ? this.orbit.target : this.pose.target;
    const r = (v) => Math.round(v * 100) / 100;
    const pose = {
      position: this.camera.position.toArray().map(r),
      target: target.toArray().map(r),
      lens: Math.round(this.camera.getFocalLength()),
    };
    if (this._appliedShift.some((v) => Math.abs(v) > 1e-4)) pose.shift = this._appliedShift.map((v) => Math.round(v * 1000) / 1000);
    return pose;
  }
}
