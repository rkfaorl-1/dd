# Blueprint — Story Set (Dorm Room)

## Overview

A browser-based Three.js virtual film set for horror / mystery narration videos. One reusable
environment (a shared double dorm room in an American college dormitory) with camera shot presets,
lighting moods, 2D character cutouts, a storyboard player and canvas recording. No build step;
Three.js r186 is loaded from a CDN via an import map. See `README.md` for usage.

## Design outline

- **Style:** grounded, low-key, slightly eerie but realistic. Muted beige / grey / brown /
  off-white palette, matte materials, procedural canvas textures (painted CMU block, worn tweed
  carpet, laminate, fabric, VCT hallway tiles), AgX tone mapping, subtle grain + vignette + bloom.
- **Layout (src/sets/dorm/layout.js):** narrator desk on the left wall by the entrance; narrator
  wardrobe in the front-left corner; mini-fridge and narrator bed deeper on the left; roommate desk
  under the window; roommate bed deep in the right corner behind the roommate's wardrobe, which
  stands out from the right wall as a divider so the deep corner is only partially visible from
  the door. Door hinged on the right, light switch on the latch side.
- **Engine / set split:** `src/engine/*` is environment-agnostic (stage loop, camera director,
  lighting controller, characters, storyboard player, recorder, UI). `src/sets/dorm/*` provides
  geometry, light rig, presets, shots, marks, sequences and set-state controls through one
  interface (`index.js`), so new environments can be added as new set folders.
- **Lighting:** presets are data merged over a base preset and blended by the controller; the set's
  rig maps them to lights (hemisphere ambient, sun/moon directional with blind-slat shadows,
  window rect light, ceiling point light, desk-lamp spot + glow, laptop rect light, two shadowed
  hallway spots) plus automatic practical bounce, emissive fixtures, an under-door light leak and
  deterministic flicker. Shadow maps are cached and refreshed only when something moves.
- **Characters:** alpha-tested PNG planes on named marks, cylindrical billboarding or fixed yaw,
  scale / mirror / silhouette, contact blob, POV auto-hide, runtime PNG replacement.
- **Storyboard:** steps set shot, duration, lighting (cut / fade / delayed), visible characters,
  set state (animated door), handheld and cut/fade transitions; HUD shows narration notes.
- **Output:** fixed 16:9 viewport, Auto / 720p / 1080p render size, hide UI, fullscreen, framing
  guides, MediaRecorder capture with explicitly pushed frames.

## Reference-look set (src/sets/dormRef)

A second room rebuilt from a user-supplied reference image (night, ceiling dome light on, seen from
just inside the door). The back wall, window, wall unit, beds, desks and wardrobe were measured in
the image (vanishing point, back-wall scale, object heights) to get the room size
(3.68 × 6.07 × 2.44 m), furniture footprints and the camera (1.35 m high, 20 mm, lens shift);
shot R reproduces that framing. Grimy plaster, patterned carpet, raised beds with quilts, a
free-standing wardrobe, an entry closet with the switch and a dark steel frame, mortise lock trim
on the door, raised mini-blind, a through-wall heating unit, and a night exterior (sky, three
layers of procedural pines, a low building with lit windows). Lighting: dome spot light + bounce,
hallway spill through the open door, moonlight and window light. Shared helpers moved to
`src/lib/shading.js` (corner/floor darkening) and `src/lib/flicker.js`. Sets are chosen from a
header drop-down / URL hash; the default is the reference-look set.

## Current change

Reference-look set added and made the default; set selector; camera lens shift (`shift` /
`endShift` on shots); saturation control in the finish pass; recording switch for hosted builds.
Verified in headless Chromium against the reference image (edge overlay and region brightness)
and every shot of the new set.

Earlier: initial MVP of the story set (all of the above). Verified in headless Chromium: every shot
preset under every lighting preset, the full demo storyboard at a fixed timestep, UI clicks /
keyboard shortcuts / PNG upload, and a recorded WebM download.

Possible next steps: back-view images for cutouts, frame-exact offline export (stage.update/render
are already separate), more sets reusing the engine.
