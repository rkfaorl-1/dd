/**
 * Post-processing chain:
 *   RenderPass (MSAA, HDR) -> Bloom -> OutputPass (AgX tone mapping + sRGB) -> Finish
 *
 * The Finish pass adds the "filmed" look and is part of the rendered image, so
 * it also ends up in recordings: subtle grain, vignette, black lift and the
 * fade-to-black used for sequence transitions.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinishShader = {
  name: 'FinishShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.3 },
    uLift: { value: 0 },
    uFade: { value: 0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uLift;
    uniform float uFade;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Lift the blacks a touch so night scenes read as "filmed", not crushed digital black.
      color = color * (1.0 - uLift) + uLift;

      // Vignette.
      vec2 d = vUv - 0.5;
      d.x *= uResolution.x / uResolution.y;
      float v = 1.0 - smoothstep(0.45, 1.15, length(d) * 1.35);
      color *= mix(1.0, v, uVignette);

      // Animated grain, a bit stronger in the shadows and mids.
      vec2 px = floor(vUv * uResolution);
      float n = hash(px + fract(uTime * 7.31) * 917.0) - 0.5;
      float n2 = hash(px * 0.5 + 31.7 + fract(uTime * 3.17) * 411.0) - 0.5;
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color += (n * 0.7 + n2 * 0.3) * uGrain * (1.0 - 0.55 * lum);

      color *= 1.0 - uFade;
      gl_FragColor = vec4(color, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(1);

    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.25, 0.55, 0.92);
    this.output = new OutputPass();
    this.finish = new ShaderPass(FinishShader);

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.composer.addPass(this.finish);

    this.fade = { value: 0, target: 0, speed: 0 };
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.finish.uniforms.uResolution.value.set(width, height);
  }

  /** Look parameters from the current lighting preset ({ bloom, grain, vignette, lift }). */
  setLook({ bloom, grain, vignette, lift }) {
    this.bloom.strength = bloom;
    this.bloom.enabled = bloom > 0.001;
    const u = this.finish.uniforms;
    u.uGrain.value = grain;
    u.uVignette.value = vignette;
    u.uLift.value = lift;
  }

  /** Fade to black (1) or up from black (0) over `seconds`. */
  fadeTo(target, seconds = 0) {
    this.fade.target = target;
    if (seconds <= 0) {
      this.fade.value = target;
      this.fade.speed = 0;
    } else {
      this.fade.speed = Math.abs(target - this.fade.value) / seconds;
    }
  }

  /** Advance the fade and the grain animation. */
  update(dt) {
    const f = this.fade;
    if (f.value !== f.target) {
      const step = f.speed * dt;
      f.value = f.value < f.target ? Math.min(f.target, f.value + step) : Math.max(f.target, f.value - step);
    }
    const u = this.finish.uniforms;
    u.uFade.value = f.value;
    u.uTime.value += dt;
  }

  render() {
    this.composer.render();
  }
}
