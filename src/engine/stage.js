/**
 * StoryStage - the app core. Owns the renderer and the frame loop and wires the
 * set, lighting, camera director, characters, storyboard player and recorder
 * together. The UI (ui.js) only talks to this public API, and so can you from
 * the browser console: the instance is exposed as `window.stage`.
 *
 *   stage.playShot('E')
 *   stage.setLighting('nightLamp', { fade: 2 })
 *   stage.characters.set('B', { visible: true, mark: 'hiddenCorner', silhouette: true })
 *   stage.applySetState({ door: 'ajar' })
 *   stage.playSequence('nightReturn')
 */
import * as THREE from 'three';
import { createRenderer, resolveRenderSize } from './renderer.js';
import { PostFX } from './post.js';
import { CameraDirector } from './cameraDirector.js';
import { LightingController } from './lightingController.js';
import { CharacterManager } from './characters.js';
import { SequencePlayer } from './sequencePlayer.js';
import { Recorder } from './recorder.js';

export class StoryStage extends EventTarget {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {HTMLElement} options.viewport  16:9 element the canvas fills (used for sizing)
   * @param {object} options.set            set definition (e.g. src/sets/dorm/index.js)
   * @param {Array} options.characterSlots  character slot definitions (src/config.js)
   * @param {object} [options.config]       app config (src/config.js)
   */
  constructor({ canvas, viewport, set, characterSlots, config = {} }) {
    super();
    this.canvas = canvas;
    this.viewport = viewport;
    this.setDef = set;
    this.config = config;

    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.03, 200);

    this.shotsById = new Map(set.shots.map((s) => [s.id, s]));
    this.set = set.build({
      scene: this.scene,
      renderer: this.renderer,
      invalidateShadows: () => this.invalidateShadows(),
    });
    this.lighting = new LightingController(this.set.rig, set.lightingPresets, set.basePreset);
    this.director = new CameraDirector(this.camera, canvas);
    this.characters = new CharacterManager({
      scene: this.scene,
      marks: set.marks,
      slots: characterSlots,
      onShadowsDirty: () => this.invalidateShadows(),
    });
    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.sequencer = new SequencePlayer(this);
    this.recorder = new Recorder(canvas);

    this.renderSize = config.renderSize || 'auto';
    this.time = 0;
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.currentShotId = null;
    this.fps = 60;
    this.frameListeners = new Set();
    this._recordingSequence = false;

    // Initial state.
    this.set.applyState(set.defaults.state, { instant: true });
    this.setLighting(config.startLighting || set.defaults.lighting);
    this.playShot(config.startShot || set.defaults.shot);

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(viewport);
    this.resize();

    this.sequencer.addEventListener('end', () => this._afterSequence());
    this.sequencer.addEventListener('stop', () => this._afterSequence());
    for (const type of ['start', 'step', 'end', 'stop']) {
      this.sequencer.addEventListener(type, (e) => this._emit('sequence', { type, ...e.detail }));
    }
    this.characters.addEventListener('change', (e) => this._emit('characters', e.detail));
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  start() {
    this.renderer.setAnimationLoop((timestamp) => this._frame(timestamp));
  }

  _frame(timestamp) {
    this.timer.update(timestamp);
    const raw = this.timer.getDelta();
    if (raw > 0) this.fps += (1 / raw - this.fps) * 0.05;
    const dt = Math.min(raw, 1 / 15); // avoid huge jumps after a stall
    this.update(dt);
    this.render();
  }

  /**
   * Advance everything by `dt` seconds without drawing. Kept separate from render()
   * so a fixed-timestep exporter (e.g. frame-by-frame PNG/WebCodecs export) can drive it.
   */
  update(dt) {
    this.time += dt;
    this.sequencer.update(dt);
    this.director.update(dt);
    this.set.update(dt, this.time);
    this.lighting.update(dt, this.time);
    this.renderer.toneMappingExposure = this.lighting.state.exposure;
    this.post.setLook(this.lighting.state.post);
    this.post.update(dt);
    this.characters.update(this.camera);
  }

  /** Draw the current state. */
  render() {
    this.post.render();
    this.recorder.captureFrame();
    for (const fn of this.frameListeners) fn(this);
  }

  /** Mark cached shadow maps as stale (they re-render on the next frame). */
  invalidateShadows() {
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    const rect = this.viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { width, height } = resolveRenderSize(this.renderSize, rect.width, rect.height);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.post.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this._emit('resize', { width, height });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getShot(id) {
    return this.shotsById.get(id);
  }

  /** Play a shot preset from its start. `duration` overrides the preset's duration. */
  playShot(id, { duration } = {}) {
    const shot = this.getShot(id);
    if (!shot) {
      console.warn(`Unknown shot "${id}"`);
      return;
    }
    if (shot.requires) {
      this.set.ensureState(shot.requires);
      this._emit('setstate', { state: this.set.getState() });
    }
    this.currentShotId = id;
    this.director.play(shot, { duration });
    this._emit('shot', { id, shot });
  }

  replayShot() {
    if (this.currentShotId) this.playShot(this.currentShotId);
  }

  /** Switch lighting preset. fade = blend seconds (0 = cut), delay = wait before starting. */
  setLighting(id, { fade = 0, delay = 0 } = {}) {
    this.lighting.setPreset(id, { fade, delay });
    this._emit('lighting', { id });
  }

  /** Change set state, e.g. { door: 'ajar' }. `animate` swings the door instead of cutting. */
  applySetState(state, options = {}) {
    this.set.applyState(state, options);
    this._emit('setstate', { state: this.set.getState() });
  }

  setRenderSize(mode) {
    this.renderSize = mode;
    this.resize();
  }

  setHandheld(amount) {
    this.director.handheld = amount;
    this._emit('handheld', { amount });
  }

  setLoopShot(loop) {
    this.director.loop = loop;
  }

  setDebugOrbit(enabled) {
    if (enabled && this.sequencer.playing) this.stopSequence();
    this.director.setDebugOrbit(enabled);
    this._emit('debug', { enabled: !!this.director.orbit });
  }

  getSequence(id) {
    return this.setDef.sequences.find((s) => s.id === id);
  }

  playSequence(idOrSequence) {
    const sequence = typeof idOrSequence === 'string' ? this.getSequence(idOrSequence) : idOrSequence;
    if (!sequence) return;
    if (this.director.orbit) this.setDebugOrbit(false);
    this.director.loop = false;
    this.sequencer.play(sequence);
  }

  stopSequence() {
    this.sequencer.stop();
  }

  /**
   * Preview one storyboard step on its own: applies the lighting / set / characters
   * that would be in effect at that step (walking the earlier steps) and plays its shot.
   */
  previewStep(sequenceId, index) {
    const sequence = this.getSequence(sequenceId);
    if (!sequence) return;
    if (this.sequencer.playing) this.sequencer.stop({ silent: false });
    const effective = { lighting: null, set: {}, characters: undefined, handheld: null };
    sequence.steps.slice(0, index + 1).forEach((step, i) => {
      if (step.lighting) effective.lighting = step.lighting;
      if (step.set) Object.assign(effective.set, step.set);
      if (step.characters !== undefined) effective.characters = step.characters;
      if (i === index) effective.handheld = step.handheld ?? null;
    });
    const step = sequence.steps[index];
    const instantSet = Object.fromEntries(
      Object.entries(effective.set).map(([k, v]) => [k, typeof v === 'object' && v ? v.state : v]),
    );
    this.applySetState(instantSet, { instant: true });
    if (effective.lighting) this.setLighting(effective.lighting);
    if (effective.characters !== undefined) this.characters.showOnly(effective.characters);
    this.director.handheldOverride = effective.handheld;
    this.playShot(step.shot, { duration: step.duration });
    this._emit('preview', { sequenceId, index, step });
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  get recording() {
    return this.recorder.recording;
  }

  startRecording() {
    if (this.config.recording === false) {
      this._emit('message', { text: 'Recording is turned off in this build.', level: 'error' });
      return;
    }
    try {
      this.recorder.start({ fps: this.config.recordFps || 30, bitrate: this.config.recordBitrate || 14_000_000 });
      this._emit('recording', { recording: true });
    } catch (err) {
      this._emit('message', { text: err.message, level: 'error' });
    }
  }

  async stopRecording() {
    const blob = await this.recorder.stop();
    this._recordingSequence = false;
    this._emit('recording', { recording: false });
    if (blob && blob.size) {
      Recorder.download(blob, `${this.setDef.id}`);
      this._emit('message', { text: `Saved ${(blob.size / 1e6).toFixed(1)} MB video` });
    } else if (blob) {
      this._emit('message', { text: 'Recording was empty - keep the tab visible while recording.', level: 'error' });
    }
  }

  /** Play a sequence and record it from the first frame to the end of the fade-out. */
  recordSequence(id) {
    const sequence = this.getSequence(id);
    if (!sequence) return;
    this.playSequence(sequence);
    this.startRecording();
    this._recordingSequence = this.recording;
  }

  _afterSequence() {
    this.director.handheldOverride = null;
    if (this._recordingSequence) {
      // Keep a few black frames at the tail, then stop and bring the picture back.
      setTimeout(async () => {
        await this.stopRecording();
        this.post.fadeTo(0, 0.6);
      }, 300);
    } else {
      setTimeout(() => this.post.fadeTo(0, 0.6), 500);
    }
  }

  // ---------------------------------------------------------------------------

  /** Snapshot for the HUD. */
  status() {
    const shot = this.getShot(this.currentShotId);
    return {
      shot,
      progress: this.director.progress,
      lens: this.director.pose.lens,
      lighting: this.lighting.presets[this.lighting.activeId]?.label,
      recording: this.recording,
      recordElapsed: this.recorder.elapsed,
      fps: this.fps,
    };
  }

  onFrame(fn) {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
