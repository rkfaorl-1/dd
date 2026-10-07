"""Add a secondary verification camera (looking back from the window corner
toward the door) to an existing dorm_room.blend.  The reference camera stays
the active scene camera.

Usage: python add_alt_camera.py <scene.blend>
"""
import math
import sys

import bpy

path = sys.argv[1]
bpy.ops.wm.open_mainfile(filepath=path)
scene = bpy.context.scene
if "Camera_Alt" not in bpy.data.objects:
    cd = bpy.data.cameras.new("Camera_Alt")
    cd.lens = 20.0
    cd.sensor_width = 36.0
    cd.clip_start = 0.02
    cam = bpy.data.objects.new("Camera_Alt", cd)
    coll = bpy.data.collections.get("Camera") or scene.collection
    coll.objects.link(cam)
    # standing between the beds near the heater, looking back at the door wall
    cam.location = (2.75, 4.85, 1.55)
    cam.rotation_euler = (math.radians(80), 0, math.radians(152))
bpy.ops.wm.save_mainfile()
print("alt camera added")
