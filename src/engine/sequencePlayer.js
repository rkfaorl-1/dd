/**
 * SequencePlayer - the storyboard player.
 *
 * Plays a sequence (an ordered list of steps defined in the set's
 * sequences.js) like a mini film scene: each step cuts (or fades) to a camera
 * shot and can change lighting, set state, character placement and handheld
 * amount. See src/sets/dorm/sequences.js for the step format.
 */
const DIP_TO_BLACK = 0.45; // seconds out + seconds in for 'fade' transitions

export class SequencePlayer extends EventTarget {
  constructor(stage) {
    super();
    this.stage = stage;
    this.sequence = null;
    this.index = -1;
    this.elapsed = 0;
    this.stepDuration = 0;
    this.playing = false;
    this.fadingOut = false;
  }

  get currentStep() {
    return this.sequence ? this.sequence.steps[this.index] : null;
  }

  /** Total running time in seconds. */
  static totalDuration(sequence, getShot) {
    return sequence.steps.reduce((sum, step) => sum + (step.duration ?? getShot(step.shot)?.duration ?? 0), 0);
  }

  play(sequence) {
    if (!sequence?.steps?.length) return;
    this.stop({ silent: true });
    this.sequence = sequence;
    this.index = -1;
    this.playing = true;
    this.fadingOut = false;
    this.totalElapsed = 0;
    const post = this.stage.post;
    post.fadeTo(1, 0);
    post.fadeTo(0, sequence.fadeIn ?? 0);
    this.dispatchEvent(new CustomEvent('start', { detail: { sequence } }));
    this._next();
  }

  stop({ silent = false } = {}) {
    if (!this.playing) return;
    this.playing = false;
    this.stage.director.handheldOverride = null;
    this.stage.post.fadeTo(0, 0.25);
    if (!silent) this.dispatchEvent(new CustomEvent('stop', { detail: { sequence: this.sequence } }));
  }

  _next() {
    this.index += 1;
    const steps = this.sequence.steps;
    if (this.index >= steps.length) {
      this.playing = false;
      this.stage.director.handheldOverride = null;
      this.dispatchEvent(new CustomEvent('end', { detail: { sequence: this.sequence } }));
      return;
    }
    const step = steps[this.index];
    const stage = this.stage;
    const shot = stage.getShot(step.shot);
    if (!shot) {
      console.warn(`Sequence step ${this.index}: unknown shot "${step.shot}"`);
      this._next();
      return;
    }
    this.stepDuration = step.duration ?? shot.duration;
    this.elapsed = 0;
    this.fadingOut = false;

    // Order matters: set state and lighting first, then the camera (shots may require set state).
    if (step.set) stage.applySetState(step.set);
    if (step.lighting) stage.setLighting(step.lighting, { fade: step.lightingFade ?? 0, delay: step.lightingDelay ?? 0 });
    if (step.characters !== undefined) stage.characters.showOnly(step.characters);
    stage.director.handheldOverride = step.handheld ?? this.sequence.handheld ?? null;
    stage.playShot(step.shot, { duration: this.stepDuration });

    if (step.transition === 'fade' && this.index > 0) stage.post.fadeTo(0, DIP_TO_BLACK);

    this.dispatchEvent(
      new CustomEvent('step', { detail: { index: this.index, count: steps.length, step, shot, duration: this.stepDuration } }),
    );
  }

  update(dt) {
    if (!this.playing) return;
    this.elapsed += dt;
    this.totalElapsed += dt;
    const steps = this.sequence.steps;
    const next = steps[this.index + 1];
    const remaining = this.stepDuration - this.elapsed;

    if (!this.fadingOut) {
      if (!next && this.sequence.fadeOut && remaining <= this.sequence.fadeOut) {
        this.stage.post.fadeTo(1, Math.max(remaining, 0.01));
        this.fadingOut = true;
      } else if (next?.transition === 'fade' && remaining <= DIP_TO_BLACK) {
        this.stage.post.fadeTo(1, Math.max(remaining, 0.01));
        this.fadingOut = true;
      }
    }
    if (this.elapsed >= this.stepDuration) this._next();
  }
}
