/**
 * Control panel + HUD. Built from the set definition, so a new set gets its own
 * shot / lighting / state / mark buttons automatically. Everything here is plain
 * DOM over the canvas: none of it is captured in recordings.
 */
import { RENDER_SIZES } from './renderer.js';
import { SequencePlayer } from './sequencePlayer.js';
import { Recorder } from './recorder.js';

/** Tiny DOM helper: h('button', { class: 'btn', onclick }, 'Label') */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function section(title, ...content) {
  return h('section', { class: 'panel-section' }, h('h2', {}, title), ...content);
}

function row(label, ...content) {
  return h('div', { class: 'row' }, h('span', { class: 'row-label' }, label), h('div', { class: 'row-content' }, ...content));
}

/** Segmented control: returns { el, set(value) }. */
function segmented(options, onSelect, initial) {
  const buttons = options.map((o) =>
    h('button', { class: 'seg-btn', type: 'button', dataset: { value: String(o.value) }, title: o.title, onclick: () => onSelect(o.value) }, o.label),
  );
  const el = h('div', { class: 'segmented' }, buttons);
  const set = (value) => buttons.forEach((b) => b.classList.toggle('active', b.dataset.value === String(value)));
  set(initial);
  return { el, set };
}

export function buildUI(stage, { app, panel, hud, stageArea, showUiButton }) {
  const set = stage.setDef;
  const toastBox = h('div', { class: 'toasts' });
  stageArea.append(toastBox);
  const toast = (text, level = 'info') => {
    const t = h('div', { class: `toast ${level}` }, text);
    toastBox.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  };

  // ---------------------------------------------------------------- Shots
  const shotButtons = new Map();
  const shotButton = (s) => {
    const b = h(
      'button',
      { class: 'btn shot-btn', type: 'button', title: `${s.description} (${s.duration}s, ${s.lens}mm)`, onclick: () => stage.playShot(s.id) },
      h('span', { class: 'shot-id' }, s.id),
      h('span', { class: 'shot-name' }, s.name),
    );
    shotButtons.set(s.id, b);
    return b;
  };
  const mainShots = set.shots.slice(0, 8);
  const extraShots = set.shots.slice(8);
  const loopBox = h('input', { type: 'checkbox', onchange: (e) => stage.setLoopShot(e.target.checked) });
  const handheld = segmented(
    [
      { value: 0, label: 'Locked' },
      { value: 0.45, label: 'Handheld' },
      { value: 1, label: 'Nervous' },
    ],
    (v) => {
      stage.setHandheld(v);
      handheld.set(v);
    },
    0,
  );
  panel.append(
    section(
      'Shots',
      h('div', { class: 'grid shots' }, mainShots.map(shotButton)),
      extraShots.length ? h('div', { class: 'subhead' }, 'Inserts') : null,
      extraShots.length ? h('div', { class: 'grid shots' }, extraShots.map(shotButton)) : null,
      h(
        'div',
        { class: 'row-inline' },
        h('button', { class: 'btn small', type: 'button', onclick: () => stage.replayShot(), title: 'Replay the current shot (Enter)' }, '↺ Replay'),
        h('label', { class: 'check' }, loopBox, 'Loop shot'),
      ),
      row('Camera', handheld.el),
    ),
  );

  // ---------------------------------------------------------------- Lighting
  let lightingFade = 0;
  const lightButtons = new Map();
  const presets = stage.lighting.list();
  const fadeSeg = segmented(
    [
      { value: 0, label: 'Cut' },
      { value: 1, label: '1 s' },
      { value: 3, label: '3 s' },
    ],
    (v) => {
      lightingFade = v;
      fadeSeg.set(v);
    },
    0,
  );
  panel.append(
    section(
      'Lighting',
      h(
        'div',
        { class: 'grid lights' },
        presets.map((p, i) => {
          const b = h('button', { class: 'btn', type: 'button', title: `Shift+${i + 1}`, onclick: () => stage.setLighting(p.id, { fade: lightingFade }) }, p.label);
          lightButtons.set(p.id, b);
          return b;
        }),
      ),
      row('Transition', fadeSeg.el),
    ),
  );

  // ---------------------------------------------------------------- Set state
  const stateControls = new Map();
  if (set.stateControls?.length) {
    const current = stage.set.getState();
    panel.append(
      section(
        'Set',
        set.stateControls.map((ctrl) => {
          const seg = segmented(ctrl.options, (v) => stage.applySetState({ [ctrl.key]: v }, { animate: true }), current[ctrl.key]);
          stateControls.set(ctrl.key, seg);
          return row(ctrl.label, seg.el);
        }),
      ),
    );
  }

  // ---------------------------------------------------------------- Characters
  const characterCards = new Map();
  const markOptions = Object.entries(set.marks).map(([id, m]) => ({ id, label: `${m.label}${m.pose === 'seated' ? ' (seated)' : ''}` }));
  const cards = stage.characters.list().map((slot) => {
    const id = slot.def.id;
    const st = () => slot.state;
    const update = (patch) => stage.characters.set(id, patch);

    const visible = h('input', { type: 'checkbox', onchange: (e) => update({ visible: e.target.checked }) });
    const markSelect = h(
      'select',
      { onchange: (e) => update({ mark: e.target.value }) },
      markOptions.map((m) => h('option', { value: m.id }, m.label)),
    );
    const scaleOut = h('output', {}, '1.00');
    const scale = h('input', { type: 'range', min: '0.6', max: '1.4', step: '0.01', oninput: (e) => update({ scale: Number(e.target.value) }) });
    const facing = segmented(
      [
        { value: 'camera', label: 'Face camera' },
        { value: 'fixed', label: 'Fixed' },
      ],
      (v) => update({ facing: v }),
      st().facing,
    );
    const yawOut = h('output', {}, '0°');
    const yaw = h('input', { type: 'range', min: '-180', max: '180', step: '1', oninput: (e) => update({ yaw: Number(e.target.value) }) });
    const mirror = h('input', { type: 'checkbox', onchange: (e) => update({ mirror: e.target.checked }) });
    const silhouette = h('input', { type: 'checkbox', onchange: (e) => update({ silhouette: e.target.checked }) });
    const fileInput = (pose) => {
      const input = h('input', {
        type: 'file',
        accept: 'image/png,image/webp,image/gif',
        hidden: true,
        onchange: (e) => {
          const file = e.target.files?.[0];
          if (file) {
            stage.characters.loadImage(id, pose, file);
            toast(`${slot.def.name}: loaded ${file.name} (${pose})`);
          }
          e.target.value = '';
        },
      });
      return h('label', { class: 'btn small file-btn', title: `Replace the ${pose} image with a local PNG` }, input, `${pose[0].toUpperCase() + pose.slice(1)} PNG…`);
    };

    const card = h(
      'div',
      { class: 'char-card' },
      h('div', { class: 'char-head' }, h('label', { class: 'check strong' }, visible, h('span', { class: 'slot-id' }, id), slot.def.name)),
      row('Mark', markSelect),
      row('Scale', h('div', { class: 'range' }, scale, scaleOut)),
      row('Facing', facing.el),
      row('Yaw', h('div', { class: 'range' }, yaw, yawOut)),
      h('div', { class: 'row-inline' }, h('label', { class: 'check' }, mirror, 'Mirror'), h('label', { class: 'check' }, silhouette, 'Silhouette')),
      h('div', { class: 'row-inline' }, fileInput('standing'), fileInput('seated')),
    );

    const sync = () => {
      const s = st();
      visible.checked = s.visible;
      markSelect.value = s.mark;
      scale.value = s.scale;
      scaleOut.textContent = Number(s.scale).toFixed(2);
      facing.set(s.facing);
      yaw.value = s.yaw;
      yaw.disabled = s.facing !== 'fixed';
      yawOut.textContent = `${Math.round(s.yaw)}°`;
      mirror.checked = s.mirror;
      silhouette.checked = s.silhouette;
      card.classList.toggle('off', !s.visible);
    };
    sync();
    characterCards.set(id, sync);
    return card;
  });
  panel.append(section('Characters', cards));

  // ---------------------------------------------------------------- Sequence
  let selectedSequence = set.sequences[0]?.id;
  const seqSelect = h(
    'select',
    {
      onchange: (e) => {
        selectedSequence = e.target.value;
        renderStoryboard();
      },
    },
    set.sequences.map((s) => h('option', { value: s.id }, s.title)),
  );
  const playBtn = h('button', { class: 'btn primary', type: 'button', title: 'Space', onclick: () => togglePlay() }, '▶ Play sequence');
  const recSeqBtn = h(
    'button',
    { class: 'btn rec', type: 'button', title: 'Play the sequence and record it to a video file', onclick: () => stage.recordSequence(selectedSequence) },
    '● Record sequence',
  );
  const seqInfo = h('div', { class: 'seq-info' });
  const storyboard = h('ol', { class: 'storyboard' });
  const renderStoryboard = () => {
    const seq = stage.getSequence(selectedSequence);
    storyboard.replaceChildren();
    if (!seq) return;
    const total = SequencePlayer.totalDuration(seq, (id) => stage.getShot(id));
    seqInfo.textContent = `${seq.steps.length} shots · ${fmtTime(total)}`;
    seq.steps.forEach((step, i) => {
      const shot = stage.getShot(step.shot);
      const dur = step.duration ?? shot?.duration ?? 0;
      const bits = [step.lighting && stage.lighting.presets[step.lighting]?.label, step.transition === 'fade' && 'fade in'].filter(Boolean).join(' · ');
      storyboard.append(
        h(
          'li',
          { dataset: { index: String(i) }, title: 'Click to preview this step', onclick: () => stage.previewStep(selectedSequence, i) },
          h('div', { class: 'sb-head' }, h('b', {}, step.shot), ` ${shot?.name ?? '?'}`, h('span', { class: 'sb-dur' }, `${dur}s`)),
          bits ? h('div', { class: 'sb-meta' }, bits) : null,
          step.note ? h('div', { class: 'sb-note' }, step.note) : null,
        ),
      );
    });
  };
  const togglePlay = () => {
    if (stage.sequencer.playing) stage.stopSequence();
    else stage.playSequence(selectedSequence);
  };
  panel.append(
    section('Storyboard', seqSelect, h('div', { class: 'row-inline' }, playBtn, recSeqBtn), seqInfo, storyboard),
  );
  renderStoryboard();

  // ---------------------------------------------------------------- Output
  const recBtn = h('button', { class: 'btn rec', type: 'button', title: 'R', onclick: () => (stage.recording ? stage.stopRecording() : stage.startRecording()) }, '● Record');
  const sizeSelect = h(
    'select',
    { onchange: (e) => stage.setRenderSize(e.target.value) },
    Object.entries(RENDER_SIZES).map(([id, r]) => h('option', { value: id }, r.label)),
  );
  sizeSelect.value = stage.renderSize;
  const guidesBox = h('input', { type: 'checkbox', onchange: (e) => app.classList.toggle('show-guides', e.target.checked) });
  const orbitBox = h('input', { type: 'checkbox', onchange: (e) => stage.setDebugOrbit(e.target.checked) });
  const copyPoseBtn = h('button', { class: 'btn small', type: 'button', title: 'C (in debug mode)', onclick: () => copyPose() }, 'Copy camera pose');
  const recordingOff = stage.config.recording === false;
  if (recordingOff || !Recorder.isSupported()) {
    recBtn.disabled = true;
    recSeqBtn.disabled = true;
    recBtn.title = recSeqBtn.title = recordingOff
      ? 'Recording is turned off in this build. Run the project locally to record video files.'
      : 'Recording needs MediaRecorder + canvas.captureStream (Chrome, Edge, Firefox).';
  }
  panel.append(
    section(
      'Output',
      row('Render size', sizeSelect),
      h(
        'div',
        { class: 'row-inline' },
        recBtn,
        h('button', { class: 'btn', type: 'button', title: 'F', onclick: () => toggleFullscreen() }, '⛶ Fullscreen'),
        h('button', { class: 'btn', type: 'button', title: 'H', onclick: () => toggleUI() }, 'Hide UI'),
      ),
      h('div', { class: 'row-inline' }, h('label', { class: 'check' }, guidesBox, 'Framing guides'), h('label', { class: 'check' }, orbitBox, 'Debug orbit')),
      h('div', { class: 'row-inline' }, copyPoseBtn),
      h(
        'p',
        { class: 'hint' },
        recordingOff
          ? 'Recording is off here because this page cannot save files. Run the project locally to record, or capture this tab with a screen recorder (Hide UI + Fullscreen gives a clean 16:9 frame).'
          : 'Only the 3D view is recorded — the panel and HUD never appear in the video. Keep this tab visible while recording.',
      ),
    ),
  );

  panel.append(
    section(
      'Keys',
      h(
        'dl',
        { class: 'keys' },
        ...[
          ['1 – 9', 'shots A – I'],
          ['Shift + 1 – 6', 'lighting presets'],
          ['Enter', 'replay shot'],
          ['Space', 'play / stop storyboard'],
          ['R', 'record on / off'],
          ['H', 'hide / show UI'],
          ['F', 'fullscreen'],
          ['G', 'framing guides'],
          ['O', 'debug orbit'],
          ['C', 'copy camera pose (debug)'],
        ].flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
      ),
    ),
  );

  // ---------------------------------------------------------------- HUD
  const hudShot = h('div', { class: 'hud-shot' });
  const hudBar = h('div', { class: 'hud-bar' }, h('div', { class: 'hud-bar-fill' }));
  const hudLight = h('div', { class: 'hud-light' });
  const hudRec = h('div', { class: 'hud-rec', hidden: true });
  const hudNote = h('div', { class: 'hud-note', hidden: true });
  const hudSeq = h('div', { class: 'hud-seq', hidden: true });
  const hudDebug = h('pre', { class: 'hud-debug', hidden: true });
  hud.append(
    h('div', { class: 'hud-tl' }, hudShot, hudBar),
    h('div', { class: 'hud-tr' }, hudRec, hudLight),
    h('div', { class: 'hud-bottom' }, hudSeq, hudNote),
    hudDebug,
  );
  const hudFill = hudBar.firstChild;

  stage.onFrame(() => {
    const s = stage.status();
    if (s.shot) hudShot.textContent = `${s.shot.id} · ${s.shot.name}   ${Math.round(s.lens)}mm`;
    hudFill.style.transform = `scaleX(${s.progress.toFixed(4)})`;
    hudLight.textContent = `${s.lighting ?? ''}  ·  ${Math.round(s.fps)} fps`;
    hudRec.hidden = !s.recording;
    if (s.recording) hudRec.textContent = `● REC ${fmtTime(s.recordElapsed)}`;
    if (stage.director.orbit) {
      const p = stage.director.currentPose();
      hudDebug.textContent = `DEBUG ORBIT\npos    [${p.position.join(', ')}]\ntarget [${p.target.join(', ')}]\nlens   ${p.lens}mm`;
    }
  });

  // ---------------------------------------------------------------- Events -> UI state
  const markActive = (map, id) => map.forEach((b, key) => b.classList.toggle('active', key === id));
  stage.addEventListener('shot', (e) => markActive(shotButtons, e.detail.id));
  stage.addEventListener('lighting', (e) => markActive(lightButtons, e.detail.id));
  stage.addEventListener('setstate', (e) => {
    for (const [key, seg] of stateControls) seg.set(e.detail.state[key]);
  });
  stage.addEventListener('characters', (e) => characterCards.get(e.detail.id)?.());
  stage.addEventListener('debug', (e) => {
    orbitBox.checked = e.detail.enabled;
    hudDebug.hidden = !e.detail.enabled;
    copyPoseBtn.disabled = !e.detail.enabled;
    app.classList.toggle('debug', e.detail.enabled);
  });
  copyPoseBtn.disabled = true;
  stage.addEventListener('recording', (e) => {
    recBtn.textContent = e.detail.recording ? '■ Stop recording' : '● Record';
    recBtn.classList.toggle('active', e.detail.recording);
    recSeqBtn.disabled = e.detail.recording;
  });
  stage.addEventListener('message', (e) => toast(e.detail.text, e.detail.level));
  const highlightStep = (index) => {
    storyboard.querySelectorAll('li').forEach((li) => li.classList.toggle('current', Number(li.dataset.index) === index));
  };
  stage.addEventListener('preview', (e) => {
    if (e.detail.sequenceId === selectedSequence) highlightStep(e.detail.index);
    const note = e.detail.step.note;
    hudNote.hidden = !note;
    hudNote.textContent = note || '';
  });
  stage.addEventListener('sequence', (e) => {
    const d = e.detail;
    if (d.type === 'start') {
      playBtn.textContent = '■ Stop';
      playBtn.classList.add('active');
      if (d.sequence.id !== selectedSequence) {
        selectedSequence = d.sequence.id;
        seqSelect.value = selectedSequence;
        renderStoryboard();
      }
    } else if (d.type === 'step') {
      highlightStep(d.index);
      hudSeq.hidden = false;
      hudSeq.textContent = `${d.sequence?.title ?? stage.sequencer.sequence.title}  ·  shot ${d.index + 1}/${d.count}`;
      hudNote.hidden = !d.step.note;
      hudNote.textContent = d.step.note || '';
    } else {
      playBtn.textContent = '▶ Play sequence';
      playBtn.classList.remove('active');
      hudSeq.hidden = true;
      hudNote.hidden = true;
      highlightStep(-1);
    }
  });

  // ---------------------------------------------------------------- Actions
  function toggleUI(force) {
    const hide = force ?? !app.classList.contains('ui-hidden');
    app.classList.toggle('ui-hidden', hide);
    showUiButton.hidden = !hide;
    requestAnimationFrame(() => stage.resize());
  }
  showUiButton.addEventListener('click', () => toggleUI(false));

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageArea.requestFullscreen?.().catch(() => toast('Fullscreen was blocked by the browser', 'error'));
  }
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => stage.resize()));

  async function copyPose() {
    const p = stage.director.currentPose();
    const text = `startPos: [${p.position.join(', ')}],\nendPos: [${p.position.join(', ')}],\ntarget: [${p.target.join(', ')}],\nlens: ${p.lens},`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Camera pose copied to clipboard');
    } catch {
      console.log(text);
      toast('Clipboard blocked — pose printed to the console');
    }
  }

  // ---------------------------------------------------------------- Keyboard
  // After a mouse/touch interaction with a panel control, give focus back to the page so
  // shortcuts keep working (keyboard-only users keep their focus: no pointer event).
  panel.addEventListener('pointerup', () => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active.matches('button, input[type="checkbox"], input[type="range"]')) active.blur();
    });
  });

  const NON_TEXT_INPUTS = ['checkbox', 'radio', 'range', 'button', 'file', 'color'];
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing =
      t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !NON_TEXT_INPUTS.includes(t.type));
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    // Space / Enter on a focused button or checkbox should just activate that control.
    const activatable = t.tagName === 'BUTTON' || (t.tagName === 'INPUT' && t.type !== 'range');
    if (activatable && (e.key === ' ' || e.key === 'Enter')) return;
    const digit = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : NaN;
    if (!Number.isNaN(digit) && digit >= 1) {
      if (e.shiftKey) {
        const preset = presets[digit - 1];
        if (preset) stage.setLighting(preset.id, { fade: lightingFade });
      } else {
        const shot = set.shots[digit - 1];
        if (shot) stage.playShot(shot.id);
      }
      e.preventDefault();
      return;
    }
    switch (e.key.toLowerCase()) {
      case ' ':
        togglePlay();
        break;
      case 'enter':
        stage.replayShot();
        break;
      case 'h':
        toggleUI();
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'r':
        if (recBtn.disabled) return;
        stage.recording ? stage.stopRecording() : stage.startRecording();
        break;
      case 'g':
        guidesBox.checked = !guidesBox.checked;
        app.classList.toggle('show-guides', guidesBox.checked);
        break;
      case 'o':
        stage.setDebugOrbit(!stage.director.orbit);
        break;
      case 'c':
        if (stage.director.orbit) copyPose();
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  // Initial highlight.
  markActive(shotButtons, stage.currentShotId);
  markActive(lightButtons, stage.lighting.activeId);

  return { toast };
}
