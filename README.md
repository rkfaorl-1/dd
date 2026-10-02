# Story Set — Dorm Room

A browser-based **virtual film set** for horror / mystery narration videos, built with Three.js.

It is not a game. It is one reusable, filmable environment — an ordinary shared double room in an
American college dormitory — with a camera director, lighting moods, 2D character cutouts and a
storyboard player, so you can block and record many narration shots from the same set.

## Run it locally

No build step and no `npm install`. Serve the folder over HTTP and open it in a current desktop
browser (developed and tested in Chromium; Chrome, Edge or Firefox recommended).

```bash
# from the project folder — pick one
python3 -m http.server 8000      # then open http://localhost:8000
npx serve .                      # or any static file server
```

- Opening `index.html` directly from disk (`file://`) does **not** work — browsers block ES modules there.
- Three.js (r186) is loaded from the jsDelivr CDN through an import map, so the first load needs internet.

### Running offline

```bash
npm install three@0.186.1
```

Then point the import map in `index.html` at the local copy:

```html
<script type="importmap">
  {
    "imports": {
      "three": "./node_modules/three/build/three.module.js",
      "three/addons/": "./node_modules/three/examples/jsm/"
    }
  }
</script>
```

## What you get

| Area | What it does |
| --- | --- |
| **Set** | Shared double: 2 Twin XL beds, 2 desks, 2 chairs, 2 wardrobes, dresser, mini-fridge, painted cinder-block walls, worn institutional carpet, door, window with mini-blinds, US toggle light switch, hallway, view outside. All procedural geometry and canvas textures — no model files. |
| **Limited visibility** | The roommate's wardrobe stands out from the wall as a room divider, so from the entrance the deep corner (roommate's bed) is only partially visible. Door can be **closed / ajar / open**; roommate's bed **empty / occupied** (a shape under the covers). |
| **Camera shots** | 8 required presets (A–H) + 5 inserts (I–M). Each has start/end position, look-at target, lens (mm), optional roll, duration and easing. Optional handheld drift. |
| **Lighting** | Day, Overcast, Evening, Night, Night + desk lamp, Flicker test. Cut or blend (1 s / 3 s). Practical lights (ceiling fixture, desk lamp, laptop, hallway fluorescents) with shadows and bounce light; deterministic flicker. |
| **Characters** | 2 slots of 2D PNG cutouts on named marks; on/off, scale, face-camera or fixed yaw, mirror, black silhouette; replace art from the panel. |
| **Storyboard** | Sequences defined in code: shot + duration + lighting + visible characters + set state + narration note. Play, stop, preview a single step. |
| **Output** | Clean 16:9 viewport, minimal HUD, hide UI, fullscreen, framing guides, fixed 720p/1080p render size, WebM recording (manual or "record sequence"). |

## Controls

The panel on the right is grouped as **Shots · Lighting · Set · Characters · Storyboard · Output**.
The HUD (shot name, lens, lighting, REC, storyboard note) and the panel are HTML overlays and are
**never recorded** — only the 3D canvas is.

| Key | Action |
| --- | --- |
| `1` – `9` | Play shots A – I |
| `Shift` + `1` – `6` | Lighting presets |
| `Enter` | Replay current shot |
| `Space` | Play / stop the selected storyboard |
| `R` | Start / stop recording |
| `H` | Hide / show UI |
| `F` | Fullscreen |
| `G` | Framing guides (thirds + safe area) |
| `O` | Debug orbit camera |
| `C` | Copy camera pose (in debug orbit) |

### Shot presets

| Id | Shot | Notes |
| --- | --- | --- |
| A | Hallway → door | Approach from the hallway; an ajar door shows a dark gap |
| B | Doorway push-in | Dollies through the doorway (opens the door if needed) |
| C | Over the desk | From above the narrator desk, looking inward |
| D | Partial view → bed | Roommate's bed area, still partly hidden by the wardrobe |
| E | Lateral reveal | Slides sideways and reveals the corner behind the wardrobe |
| F | Wide establishing | Whole room from a high corner |
| G | Low push → deep room | Low angle, slight dutch tilt, slow push |
| H | Window → back | From the window back toward the door |
| I–M | Inserts | Light switch, under the door, desk POV, bed close, desk from the room |

### Lighting presets

| Preset | Look |
| --- | --- |
| Day | Sun through the blinds, bright neutral room |
| Overcast | Flat, cool, soft window light |
| Evening | Low orange sun + warm ceiling light |
| Night | Moonlight through the blinds, hallway light under the door |
| Night + desk lamp | Warm pool on the narrator desk, laptop glow, dark room |
| Flicker test | Ceiling fluorescent on with subtle, irregular instability |

## Characters (2D cutouts)

Slots live in `src/config.js`. Each slot has a standing and a seated PNG:

```js
{
  id: 'B',
  name: 'Roommate',
  images: { standing: 'assets/characters/roommate_standing.png', seated: 'assets/characters/roommate_seated.png' },
  heights: { standing: 1.8, seated: 1.32 },   // meters the image height maps to
  mark: 'deepBed',
  visible: false,
}
```

**PNG convention:** transparent background, the figure fills the full image height, feet on the
bottom edge. To try art without editing code, use the **Standing PNG… / Seated PNG…** buttons on a
character card. The placeholders were generated with `tools/make-placeholders.html` (open it via the
local server to re-download them).

Marks (positions) are defined in `src/sets/dorm/marks.js`: near narrator desk, seated at desk, near
entrance, deep bed area, plus in the doorway, behind the wardrobe, on the roommate's bed, by the
window and in the hallway. A cutout is hidden automatically when the camera is inside it, so
point-of-view shots (K) work with the narrator seated.

## Storyboard sequences

Edit `src/sets/dorm/sequences.js`. A sequence is a list of steps:

```js
{
  id: 'nightReturn',
  title: 'Night return (demo scene)',
  fadeIn: 1.2,
  fadeOut: 1.6,
  steps: [
    { shot: 'A', duration: 7, lighting: 'night', set: { door: 'ajar' }, characters: {},
      note: 'I got back to the dorm a little after three.' },
    { shot: 'B', duration: 8, set: { door: { state: 'open', duration: 2.5 } } },
    { shot: 'M', duration: 7, lighting: 'nightLamp', lightingDelay: 1.4, lightingFade: 0.12,
      characters: { A: 'seatedAtDesk' } },
    { shot: 'E', duration: 9, characters: { B: { mark: 'deepBed', silhouette: true } } },
    { shot: 'H', duration: 8, lighting: 'night', transition: 'fade',
      characters: { B: { mark: 'doorway', silhouette: true } } },
  ],
}
```

| Field | Meaning |
| --- | --- |
| `shot` | Shot id |
| `duration` | Seconds (default: the shot's own duration) |
| `lighting` / `lightingFade` / `lightingDelay` | Preset, blend seconds (0 = cut), delay before it starts |
| `characters` | Who is visible: `{ A: 'markId' }` or `{ B: { mark, scale, facing, yaw, mirror, silhouette } }`. `{}` hides everyone; omit to keep the current state |
| `set` | `{ door: 'closed' \| 'ajar' \| 'open', roommateBed: 'empty' \| 'occupied' }` — door may animate: `{ state, delay, duration }` |
| `handheld` | 0–1 camera drift for this shot |
| `transition` | `'cut'` (default) or `'fade'` (dip to black into this shot) |
| `note` | Narration line shown in the HUD while the shot plays (not recorded) |

Three sequences are included: the **Night return** demo scene (~57 s), **Day coverage** and a
**Lighting test**. Click any step in the panel's storyboard list to preview it on its own.

## Recording

- **● Record** captures the canvas until you stop it; **● Record sequence** plays the selected
  storyboard and records it from the first frame to the end of the fade-out.
- Files download as `dorm-double-<timestamp>.webm` (VP9/VP8; MP4 where WebM isn't available).
- For predictable output set **Render size → 1920 × 1080** first. Recording is real-time: keep the
  tab visible and in the foreground.
- Need MP4 for an editor? `ffmpeg -i take.webm -c:v libx264 -crf 18 -pix_fmt yuv420p take.mp4`

## File structure

```
index.html                     page shell, import map (Three.js CDN), 16:9 viewport + panel
style.css                      layout, panel and HUD styles
main.js                        entry point: loads the set, starts the stage, builds the UI
src/
  config.js                    character slots (PNG paths, heights) + output settings
  engine/                      environment-agnostic "film tool"
    stage.js                   app core: frame loop, public API (window.stage)
    renderer.js                WebGL renderer, render sizes (auto / 720p / 1080p)
    post.js                    bloom, AgX tone mapping, grain, vignette, fades
    cameraDirector.js          plays shot presets, handheld drift, debug orbit
    easing.js                  easing curves
    lightingController.js      blends lighting presets, feeds the set's light rig
    characters.js              2D cutout slots, marks, billboarding, PNG loading
    sequencePlayer.js          storyboard player
    recorder.js                MediaRecorder canvas capture
    ui.js                      control panel, HUD, keyboard shortcuts
  sets/dorm/                   everything specific to this environment
    index.js                   set definition (the interface the engine uses)
    layout.js                  floor plan: dimensions + furniture footprints
    architecture.js            walls, floor, door, switch, window + blinds, hallway, exterior
    furniture.js               beds, desks, chairs, wardrobes, props
    materials.js               shared material palette
    lighting.js                light rig + lighting presets + flicker
    shots.js                   camera shot presets
    marks.js                   character positions
    sequences.js               storyboards
  lib/                         procedural textures, geometry helpers, noise, placeholder figure
assets/characters/             placeholder PNGs (replace with your own art)
tools/make-placeholders.html   regenerates the placeholder PNGs
```

## Extending

- **New camera shot:** tick **Debug orbit**, frame the shot with the mouse, press **C** (copy camera
  pose) and paste it into `src/sets/dorm/shots.js` as `startPos` / `target`, then add an `endPos`.
- **New lighting mood:** add an entry to `LIGHTING_PRESETS` in `src/sets/dorm/lighting.js`. Presets
  only list what differs from `BASE_PRESET`; fixture levels (`ceiling`, `lamp`, `laptop`, `hall`) are 0–1.
- **New environment:** copy `src/sets/dorm/` to e.g. `src/sets/motel/`, keep the same exported shape
  (`build()`, `shots`, `marks`, `lightingPresets`, `sequences`, `stateControls`, `defaults`) and import
  it in `main.js`. The engine, UI, characters, storyboard player and recorder work unchanged.
- **Scripting from the console:**

  ```js
  stage.playShot('E');
  stage.setLighting('nightLamp', { fade: 2 });
  stage.characters.set('B', { visible: true, mark: 'hiddenCorner', silhouette: true });
  stage.applySetState({ door: 'ajar' });
  stage.playSequence('nightReturn');
  ```

## Notes

- Cutouts always show the front of the image (with *Face camera* they turn toward the camera).
  Draw a back view into the PNG if a character is seen from behind.
- Shadows are cached and only re-rendered when something moves (door, characters, sun angle), which
  keeps the frame rate high on laptops.
- `stage.update(dt)` and `stage.render()` are separate, so a frame-exact offline exporter can be added
  later without touching the set.
