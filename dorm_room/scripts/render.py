"""Render the dorm room .blend with Cycles.

Usage: python render.py <scene.blend> <out.png> [--pct 100] [--samples 256] [--nodof] [--clay]
"""
import argparse
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("blend")
ap.add_argument("out")
ap.add_argument("--pct", type=int, default=100)
ap.add_argument("--samples", type=int, default=None)
ap.add_argument("--threshold", type=float, default=None)
ap.add_argument("--nodof", action="store_true")
ap.add_argument("--clay", action="store_true", help="override all materials with grey diffuse (layout check)")
ap.add_argument("--exposure", type=float, default=None)
ap.add_argument("--camera", default=None, help="render from this camera object instead of the active one")
args = ap.parse_args(sys.argv[1:])

bpy.ops.wm.open_mainfile(filepath=args.blend)
scene = bpy.context.scene
scene.render.resolution_percentage = args.pct
if args.samples:
    scene.cycles.samples = args.samples
if args.threshold:
    scene.cycles.adaptive_threshold = args.threshold
if args.nodof:
    scene.camera.data.dof.use_dof = False
if args.exposure is not None:
    scene.view_settings.exposure = args.exposure
if args.clay:
    clay = bpy.data.materials.new("Clay")
    p = clay.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
    for vl in scene.view_layers:
        vl.material_override = clay
if args.camera:
    scene.camera = bpy.data.objects[args.camera]
scene.render.filepath = args.out
scene.cycles.device = "CPU"
bpy.ops.render.render(write_still=True)
print("rendered", args.out)
