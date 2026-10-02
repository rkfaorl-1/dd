/**
 * Renderer setup and output-resolution management.
 *
 * The viewport is always 16:9. "Auto" renders at the on-screen size (x device
 * pixel ratio); the fixed modes render exactly 1280x720 / 1920x1080 no matter how
 * big the preview is, so recordings have a predictable resolution.
 */
import * as THREE from 'three';

export const RENDER_SIZES = {
  auto: { label: 'Auto (screen)', width: 0, height: 0 },
  '720p': { label: '1280 × 720', width: 1280, height: 720 },
  '1080p': { label: '1920 × 1080', width: 1920, height: 1080 },
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // MSAA happens in the post-processing render target
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The set is static: shadow maps are only re-rendered when something moves
  // (door, characters, sun angle). See StoryStage.invalidateShadows().
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return renderer;
}

/** Compute the drawing-buffer size for a render-size mode and the canvas' CSS box. */
export function resolveRenderSize(mode, cssWidth, cssHeight) {
  const preset = RENDER_SIZES[mode] || RENDER_SIZES.auto;
  if (preset.width) return { width: preset.width, height: preset.height };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    width: Math.max(2, Math.round(cssWidth * dpr)),
    height: Math.max(2, Math.round(cssHeight * dpr)),
  };
}
