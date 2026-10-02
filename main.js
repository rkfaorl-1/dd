/**
 * Entry point: load the set, start the stage, build the UI.
 *
 * To use a different environment later, import another set definition here
 * (see src/sets/dorm/index.js for the interface).
 */
import { StoryStage } from './src/engine/stage.js';
import { buildUI } from './src/engine/ui.js';
import dormSet from './src/sets/dorm/index.js';
import { CHARACTER_SLOTS, APP_CONFIG } from './src/config.js';

const $ = (id) => document.getElementById(id);

try {
  $('set-name').textContent = dormSet.name;
  const stage = new StoryStage({
    canvas: $('canvas'),
    viewport: $('viewport'),
    set: dormSet,
    characterSlots: CHARACTER_SLOTS,
    config: APP_CONFIG,
  });
  buildUI(stage, {
    app: $('app'),
    panel: $('panel'),
    hud: $('hud'),
    stageArea: $('stage-area'),
    showUiButton: $('show-ui'),
  });
  stage.start();
  $('loading').remove();
  // Handy for scripting shots from the browser console.
  window.stage = stage;
} catch (err) {
  console.error(err);
  window.showFatal?.(err.message || String(err));
}
