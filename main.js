/**
 * Entry point: pick a set, start the stage, build the UI.
 *
 * Sets are listed in SETS; the first one is the default. Open the page with
 * #<set id> (e.g. index.html#dorm-double) or use the selector in the panel header.
 */
import { StoryStage } from './src/engine/stage.js';
import { buildUI } from './src/engine/ui.js';
import dormRefSet from './src/sets/dormRef/index.js';
import dormSet from './src/sets/dorm/index.js';
import { CHARACTER_SLOTS, APP_CONFIG } from './src/config.js';

const SETS = [dormRefSet, dormSet];
const $ = (id) => document.getElementById(id);

try {
  const requested = location.hash.slice(1);
  const set = SETS.find((s) => s.id === requested) || SETS[0];

  const select = $('set-select');
  for (const s of SETS) select.append(new Option(s.name, s.id, false, s === set));
  select.addEventListener('change', () => {
    location.hash = select.value;
    location.reload();
  });

  const stage = new StoryStage({
    canvas: $('canvas'),
    viewport: $('viewport'),
    set,
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
