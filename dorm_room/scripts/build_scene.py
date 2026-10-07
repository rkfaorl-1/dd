"""Build the editable dorm-room environment from scratch and save it as a .blend.

Run with Blender's Python (bpy):   python build_scene.py [out.blend]

World units are metres.  Room interior: X 0..W (left -> right wall),
Y 0..D (front wall -> back/window wall), Z 0..H.  The camera stands in the
short entry vestibule looking +Y at the window wall (one-point perspective,
lens shift to match the reference framing).
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo  # noqa: E402
import materials as M  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith(".blend") else os.path.join(HERE, "..", "dorm_room.blend")
SKIP_CLOTH = "--no-cloth" in sys.argv

random.seed(42)

# ---------------------------------------------------------------- dimensions
W, D, H = 4.17, 5.56, 2.45
WALL_T, BACK_T = 0.15, 0.25
CAM = (2.048, -0.66, 1.35)
VEST_L, VEST_R = 1.40, 2.40          # vestibule side walls (inner faces)
WIN_X0, WIN_X1, WIN_Z0, WIN_Z1 = 1.41, 2.86, 0.84, 2.19   # window rough opening

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.fps = 24


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c


C_ARCH = coll("Architecture")
C_WIN = coll("Window")
C_BEDS = coll("Beds")
C_FURN = coll("Furniture")
C_PROPS = coll("Props")
C_DECOR = coll("Decor")
C_LIGHT = coll("Lights")
C_CAM = coll("Camera")
C_EXT = coll("Exterior")

# ---------------------------------------------------------------- materials
MAT = {
    "wall": M.wall_paint("Wall_Paint"),
    "ceiling": M.ceiling_tex("Ceiling_Texture", color=(0.62, 0.605, 0.56), bump=0.65),
    "carpet": M.carpet("Carpet_LoopPile"),
    "wood": M.wood("Wood_Furniture"),
    "wood_ward": M.wood("Wood_Wardrobe", light=(0.17, 0.14, 0.106), dark=(0.09, 0.072, 0.053)),
    "wood_bed": M.wood("Wood_BedFrame", light=(0.19, 0.152, 0.11), dark=(0.10, 0.078, 0.055)),
    "wood_door": M.wood("Wood_Door", light=(0.15, 0.115, 0.08), dark=(0.08, 0.06, 0.04), ring_scale=8.0),
    "trim": M.painted_metal("Trim_Paint", (0.46, 0.425, 0.35), rough=0.55, grime=0.35, bump=0.02, spec=0.4),
    "win_frame": M.painted_metal("Window_Frame_Bronze", (0.055, 0.047, 0.038), rough=0.4, metallic=0.5, grime=0.15),
    "glass": M.glass("Window_Glass"),
    "slat": M.blind_slat("Blind_Slat", color=(0.80, 0.79, 0.76)),
    "blind_metal": M.painted_metal("Blind_Headrail", (0.70, 0.69, 0.66), rough=0.35, grime=0.1),
    "cord": M.fabric_plain("Blind_Cord", (0.62, 0.60, 0.55), rough=0.7, sheen=0.3, weave_scale=2000, bump=0.05),
    "heater": M.painted_metal("Heater_Enamel", (0.25, 0.24, 0.21), rough=0.42, grime=0.35),
    "heater_dark": M.painted_metal("Heater_Grille_Dark", (0.012, 0.012, 0.011), rough=0.7, grime=0.0),
    "baseboard": M.rubber("Baseboard_Rubber", (0.055, 0.04, 0.028)),
    "switch": M.plastic("Switch_Plastic", (0.62, 0.60, 0.54), rough=0.3),
    "steel": M.brushed_metal("Brushed_Steel"),
    "fixture": M.painted_metal("Fixture_Housing", (0.68, 0.67, 0.64), rough=0.35, grime=0.15),
    "lens": M.fixture_lens("Fixture_Lens", strength=4.5),
    "mattress": M.fabric_plain("Sheet_Cotton", (0.55, 0.555, 0.55), rough=0.85, sheen=0.4, weave_scale=1200),
    "pillow": M.fabric_plain("Pillowcase", (0.46, 0.46, 0.45), rough=0.85, sheen=0.2, weave_scale=1200, bump=0.15),
    "plaid_L": M.fabric_image("Blanket_Plaid_Green", "plaid_green.png", uv_scale=1.0 / 0.9, sheen=0.15, bump=0.35),
    "plaid_R": M.fabric_image("Blanket_Plaid_Grey", "plaid_grey.png", uv_scale=1.0 / 0.9, sheen=0.15, bump=0.35),
    "upholstery": M.fabric_plain("Chair_Upholstery", (0.030, 0.034, 0.042), rough=0.62, sheen=0.6, weave_scale=500, bump=0.3, spec=0.45),
    "trunk": M.painted_metal("Trunk_Paint", (0.040, 0.044, 0.048), rough=0.5, grime=0.2, bump=0.05),
    "brass": M.painted_metal("Trunk_Latch", (0.35, 0.33, 0.30), rough=0.3, metallic=1.0, grime=0.3),
    "lamp": M.painted_metal("Lamp_Paint", (0.30, 0.30, 0.29), rough=0.32, grime=0.1),
    "speaker": M.plastic("Speaker_Plastic", (0.025, 0.025, 0.027), rough=0.5),
    "grille_cloth": M.fabric_plain("Speaker_Grille", (0.015, 0.015, 0.017), rough=0.9, sheen=0.2, weave_scale=1500),
    "bin": M.painted_metal("Bin_Metal", (0.20, 0.205, 0.21), rough=0.4, metallic=0.3, grime=0.2),
    "nylon": M.fabric_plain("Backpack_Nylon", (0.02, 0.02, 0.022), rough=0.6, sheen=0.08, weave_scale=1100, bump=0.3, spec=0.35),
    "nylon_logo": M.fabric_plain("Backpack_Patch", (0.35, 0.35, 0.34), rough=0.6, sheen=0.2),
    "zipper": M.plastic("Zipper", (0.01, 0.01, 0.01), rough=0.35),
    "paper": M.paper_block("Paper_Pages"),
    "notebook": M.plastic("Notebook_Cover", (0.50, 0.50, 0.48), rough=0.55, spec=0.35),
    "sheet_paper": M.plastic("Loose_Paper", (0.68, 0.67, 0.64), rough=0.7, spec=0.3),
    "pencil": M.plastic("Pencil_Paint", (0.55, 0.38, 0.05), rough=0.4),
    "pen": M.plastic("Pen_Plastic", (0.02, 0.03, 0.08), rough=0.3),
    "cup": M.wood("Wood_PenCup", light=(0.25, 0.19, 0.12), dark=(0.15, 0.11, 0.07), ring_scale=12.0),
    "backdrop": M.backdrop("Exterior_Backplate", "exterior.png", strength=0.95),
}
BOOK_COLORS = [(0.20, 0.035, 0.03), (0.03, 0.05, 0.12), (0.06, 0.09, 0.05), (0.18, 0.12, 0.06),
               (0.10, 0.10, 0.10), (0.35, 0.32, 0.25), (0.05, 0.03, 0.02), (0.12, 0.05, 0.08)]
BOOK_MATS = [M.book_cloth(f"Book_Cloth_{i}", c) for i, c in enumerate(BOOK_COLORS)]

box, cushion = geo.box, geo.cushion

# ============================================================================
# ARCHITECTURE
# ============================================================================
wall, ceil = MAT["wall"], MAT["ceiling"]
box("Wall_Left", -WALL_T, 0, -0.15, D + BACK_T, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Right", W, W + WALL_T, -0.15, D + BACK_T, 0, H, wall, C_ARCH, bevel=0)
# back wall split around the window opening
box("Wall_Back_L", -WALL_T, WIN_X0, D, D + BACK_T, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Back_R", WIN_X1, W + WALL_T, D, D + BACK_T, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Back_Below", WIN_X0, WIN_X1, D, D + BACK_T, 0, WIN_Z0, wall, C_ARCH, bevel=0)
box("Wall_Back_Above", WIN_X0, WIN_X1, D, D + BACK_T, WIN_Z1, H, wall, C_ARCH, bevel=0)
# front wall either side of the vestibule + header over the cased opening
box("Wall_Front_L", -WALL_T, VEST_L, -0.15, 0, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Front_R", VEST_R, W + WALL_T, -0.15, 0, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Header", VEST_L, VEST_R, -0.15, 0, 2.10, H, wall, C_ARCH, bevel=0)
# vestibule
box("Wall_Vestibule_L", VEST_L - WALL_T, VEST_L, -0.62, -0.15, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Vestibule_R", VEST_R, VEST_R + WALL_T, -0.62, -0.15, 0, H, wall, C_ARCH, bevel=0)
box("Ceiling", -WALL_T, W + WALL_T, -0.62, D + BACK_T, H, H + 0.05, ceil, C_ARCH, bevel=0)
floor = box("Floor_Carpet", -WALL_T, W + WALL_T, -0.62, D + BACK_T, -0.02, 0.0, MAT["carpet"], C_ARCH, bevel=0)

# corridor wall (contains the room's entry door frame) and the corridor beyond
CW0, CW1 = -0.76, -0.62
box("Wall_Corridor_L", -3.0, VEST_L, CW0, CW1, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Corridor_R", VEST_R, 7.0, CW0, CW1, 0, H, wall, C_ARCH, bevel=0)
box("Wall_Corridor_OverDoor", VEST_L, VEST_R, CW0, CW1, 2.09, H, wall, C_ARCH, bevel=0)
box("Corridor_Floor", -3.0, 7.0, -2.6, CW0, -0.02, 0.0, M.plastic("Corridor_VCT", (0.30, 0.29, 0.26), rough=0.35, spec=0.5, bump=0.01), C_ARCH, bevel=0)
box("Corridor_Ceiling", -3.0, 7.0, -2.6, CW0, H, H + 0.05, ceil, C_ARCH, bevel=0)
box("Corridor_Wall_Far", -3.0, 7.0, -2.75, -2.6, 0, H, wall, C_ARCH, bevel=0)
box("Corridor_Wall_EndL", -3.15, -3.0, -2.6, CW0, 0, H, wall, C_ARCH, bevel=0)
box("Corridor_Wall_EndR", 7.0, 7.15, -2.6, CW0, 0, H, wall, C_ARCH, bevel=0)
box("Corridor_Base_Far", -3.0, 7.0, -2.6, -2.595, 0, 0.10, MAT["baseboard"], C_ARCH, bevel=0.0015)

# corridor door frame (hollow metal) behind the camera + header
frm = MAT["trim"]
box("DoorFrame_Corridor_L", VEST_L, VEST_L + 0.05, -0.76, -0.62, 0, 2.09, frm, C_ARCH, bevel=0.002)
box("DoorFrame_Corridor_R", VEST_R - 0.05, VEST_R, -0.76, -0.62, 0, 2.09, frm, C_ARCH, bevel=0.002)
box("DoorFrame_Corridor_Head", VEST_L, VEST_R, -0.76, -0.62, 2.04, 2.09, frm, C_ARCH, bevel=0.002)

# cased opening trim where the vestibule meets the room (stained wood)
frm = MAT["wood_door"]
for side, x_wall, sgn in (("R", VEST_R, 1), ("L", VEST_L, -1)):
    if sgn > 0:
        box(f"Casing_{side}_Jamb", x_wall - 0.014, x_wall, -0.075, 0.0, 0, 2.17, frm, C_ARCH, bevel=0.003)
        box(f"Casing_{side}_Face", x_wall, x_wall + 0.075, 0.0, 0.016, 0, 2.17, frm, C_ARCH, bevel=0.003)
    else:
        box(f"Casing_{side}_Jamb", x_wall, x_wall + 0.014, -0.075, 0.0, 0, 2.17, frm, C_ARCH, bevel=0.003)
        box(f"Casing_{side}_Face", x_wall - 0.075, x_wall, 0.0, 0.016, 0, 2.17, frm, C_ARCH, bevel=0.003)
box("Casing_Head", VEST_L - 0.075, VEST_R + 0.075, 0.0, 0.016, 2.10, 2.17, frm, C_ARCH, bevel=0.003)
frm = MAT["trim"]

# light switch on the vestibule wall (decora rocker)
box("LightSwitch_Plate", VEST_R - 0.007, VEST_R, -0.157, -0.087, 1.143, 1.258, MAT["switch"], C_ARCH, bevel=0.002)
box("LightSwitch_Rocker", VEST_R - 0.011, VEST_R - 0.006, -0.137, -0.107, 1.168, 1.233, MAT["switch"], C_ARCH, bevel=0.0015)

# rubber cove baseboards
bb = MAT["baseboard"]
BB_H, BB_T = 0.10, 0.005
box("Base_Left", 0, BB_T, 0, D, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Right", W - BB_T, W, 0, D, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Back", 0, W, D - BB_T, D, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Front_L", 0, VEST_L - 0.075, 0.016, 0.016 + BB_T, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Front_R", VEST_R + 0.075, W, 0.016, 0.016 + BB_T, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Vest_R", VEST_R - BB_T, VEST_R, -0.62, -0.075, 0, BB_H, bb, C_ARCH, bevel=0.0015)
box("Base_Vest_L", VEST_L, VEST_L + BB_T, -0.62, -0.075, 0, BB_H, bb, C_ARCH, bevel=0.0015)

# ============================================================================
# WINDOW, TRIM, BLINDS
# ============================================================================
tr = MAT["trim"]
box("Window_Casing_L", 1.33, WIN_X0, D - 0.016, D, 0.866, WIN_Z1, tr, C_WIN, bevel=0.004)
box("Window_Casing_R", WIN_X1, 2.94, D - 0.016, D, 0.866, WIN_Z1, tr, C_WIN, bevel=0.004)
box("Window_Casing_Head", 1.325, 2.945, D - 0.018, D, WIN_Z1, 2.27, tr, C_WIN, bevel=0.004)
box("Window_Stool", 1.30, 2.97, D - 0.035, D + 0.115, 0.84, 0.866, tr, C_WIN, bevel=0.004)
box("Window_Apron", 1.33, 2.94, D - 0.014, D, 0.765, 0.84, tr, C_WIN, bevel=0.003)
wf = MAT["win_frame"]
FY0, FY1 = D + 0.115, D + 0.175
box("WinFrame_L", WIN_X0, WIN_X0 + 0.05, FY0, FY1, 0.866, WIN_Z1, wf, C_WIN, bevel=0.002)
box("WinFrame_R", WIN_X1 - 0.05, WIN_X1, FY0, FY1, 0.866, WIN_Z1, wf, C_WIN, bevel=0.002)
box("WinFrame_Top", WIN_X0, WIN_X1, FY0, FY1, WIN_Z1 - 0.05, WIN_Z1, wf, C_WIN, bevel=0.002)
box("WinFrame_Bottom", WIN_X0, WIN_X1, FY0, FY1, 0.866, 0.915, wf, C_WIN, bevel=0.002)
box("WinSash_MeetingRail", WIN_X0 + 0.05, WIN_X1 - 0.05, FY0 - 0.01, FY1, 1.50, 1.56, wf, C_WIN, bevel=0.002)
box("WinSash_Lower_L", WIN_X0 + 0.05, WIN_X0 + 0.085, FY0 - 0.01, FY0 + 0.02, 0.915, 1.50, wf, C_WIN, bevel=0.002)
box("WinSash_Lower_R", WIN_X1 - 0.085, WIN_X1 - 0.05, FY0 - 0.01, FY0 + 0.02, 0.915, 1.50, wf, C_WIN, bevel=0.002)
box("WinSash_Lower_Bottom", WIN_X0 + 0.05, WIN_X1 - 0.05, FY0 - 0.01, FY0 + 0.02, 0.915, 0.955, wf, C_WIN, bevel=0.002)
box("WinSash_Lock", 2.10, 2.17, FY0 - 0.022, FY0 - 0.01, 1.548, 1.565, MAT["steel"], C_WIN, bevel=0.002)
box("Glass_Lower", WIN_X0 + 0.085, WIN_X1 - 0.085, FY0 + 0.003, FY0 + 0.008, 0.955, 1.50, MAT["glass"], C_WIN, bevel=0)
box("Glass_Upper", WIN_X0 + 0.05, WIN_X1 - 0.05, FY1 - 0.022, FY1 - 0.017, 1.56, WIN_Z1 - 0.05, MAT["glass"], C_WIN, bevel=0)

# --- horizontal blinds (inside mount, room side of the sash)
blinds = geo.empty("Blinds", C_WIN, (0, 0, 0))
BY = D + 0.05
BX0, BX1 = WIN_X0 + 0.012, WIN_X1 - 0.012
box("Blind_Headrail", BX0, BX1, BY - 0.026, BY + 0.026, 2.142, 2.188, MAT["blind_metal"], C_WIN, blinds, bevel=0.004)
# one shared slat mesh (curved profile) instanced for every slat
SL_W, SL_N = 0.025, 30
prof = [(-SL_W / 2 + SL_W * k / 6, 0.0012 * (1 - ((k - 3) / 3) ** 2)) for k in range(7)]
sl_verts, sl_faces = [], []
for x in (-(BX1 - BX0) / 2, (BX1 - BX0) / 2):
    for (py, pz) in prof:
        sl_verts.append((x, py, pz))
for k in range(6):
    sl_faces.append((k, k + 1, 7 + k + 1, 7 + k))
slat_proto = geo.mesh_obj("Blind_Slat_000", sl_verts, sl_faces, C_WIN, MAT["slat"], blinds, smooth=True)
sol = slat_proto.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = 0.0008
slat_mesh = slat_proto.data
rng_b = random.Random(3)
z = 2.122
for i in range(SL_N):
    o = slat_proto if i == 0 else bpy.data.objects.new(f"Blind_Slat_{i:03d}", slat_mesh)
    if i > 0:
        C_WIN.objects.link(o)
        o.parent = blinds
        m2 = o.modifiers.new("Solidify", "SOLIDIFY")
        m2.thickness = 0.0008
    tilt = math.radians(-8 + rng_b.uniform(-3, 3))
    o.location = ((BX0 + BX1) / 2 + rng_b.uniform(-0.002, 0.002), BY, z)
    o.rotation_euler = (tilt, math.radians(rng_b.uniform(-0.4, 0.4)), 0)
    if i in (9, 21):  # a couple of knocked slats, as in the reference
        o.rotation_euler = (tilt + math.radians(rng_b.choice([-14, 16])), math.radians(rng_b.uniform(-1.2, 1.2)), 0)
    z -= 0.0205
box("Blind_BottomRail", BX0, BX1, BY - 0.013, BY + 0.013, z - 0.006, z + 0.012, MAT["blind_metal"], C_WIN, blinds, bevel=0.003)
bottom_z = z
for lx in (1.60, 2.67):
    for dy in (-0.012, 0.012):
        box(f"Blind_Ladder_{lx:.2f}_{dy:+.3f}", lx - 0.0007, lx + 0.0007, BY + dy - 0.0007, BY + dy + 0.0007,
            bottom_z, 2.142, MAT["cord"], C_WIN, blinds, bevel=0)
# lift cords hanging from the headrail + tassels, and a tilt wand
for i, (lx, end_z) in enumerate(((1.575, 0.97), (2.63, 0.93))):
    sway = random.uniform(-0.01, 0.01)
    pts = [(lx, BY - 0.02, 2.142), (lx + sway * 0.3, BY - 0.026, 1.8), (lx + sway, BY - 0.03, 1.3), (lx + sway * 1.2, BY - 0.032, end_z)]
    geo.curve_tube(f"Blind_LiftCord_{i}", pts, 0.0011, C_WIN, MAT["cord"], blinds, res=2)
    geo.cylinder(f"Blind_Tassel_{i}", 0.006, 0.035, (lx + sway * 1.2, BY - 0.032, end_z - 0.015), C_WIN, MAT["blind_metal"], blinds, segs=12, r2=0.009)
geo.cylinder("Blind_TiltWand", 0.0035, 0.70, (BX0 + 0.03, BY - 0.03, 2.13 - 0.35), C_WIN, MAT["glass"], blinds, segs=8)

# ============================================================================
# HEATER (convector cabinet under the window)
# ============================================================================
hx0, hx1 = 1.48, 2.61
hy_f = D - 0.18
heater = geo.empty("Heater", C_ARCH)
hm = MAT["heater"]
box("Heater_Cabinet", hx0 + 0.004, hx1 - 0.004, hy_f + 0.012, D - 0.01, 0.10, 0.655, hm, C_ARCH, heater, bevel=0.004)
box("Heater_FrontPanel", hx0, hx1, hy_f, hy_f + 0.014, 0.10, 0.50, hm, C_ARCH, heater, bevel=0.003)
box("Heater_Top", hx0 - 0.004, hx1 + 0.004, hy_f - 0.004, D - 0.01, 0.648, 0.664, hm, C_ARCH, heater, bevel=0.006, seg=3)
box("Heater_GrilleFrame_L", hx0, hx0 + 0.035, hy_f, hy_f + 0.014, 0.50, 0.648, hm, C_ARCH, heater, bevel=0.002)
box("Heater_GrilleFrame_R", hx1 - 0.035, hx1, hy_f, hy_f + 0.014, 0.50, 0.648, hm, C_ARCH, heater, bevel=0.002)
box("Heater_GrilleFrame_T", hx0, hx1, hy_f, hy_f + 0.014, 0.632, 0.648, hm, C_ARCH, heater, bevel=0.002)
box("Heater_GrilleFrame_B", hx0, hx1, hy_f, hy_f + 0.014, 0.50, 0.512, hm, C_ARCH, heater, bevel=0.002)
box("Heater_GrilleBack", hx0 + 0.03, hx1 - 0.03, hy_f + 0.026, hy_f + 0.03, 0.505, 0.64, MAT["heater_dark"], C_ARCH, heater, bevel=0)
gx0, gx1 = hx0 + 0.035, hx1 - 0.035
nsec = 12
for k in range(1, nsec):
    x = gx0 + (gx1 - gx0) * k / nsec
    box(f"Heater_GrilleDivider_{k:02d}", x - 0.004, x + 0.004, hy_f + 0.002, hy_f + 0.03, 0.512, 0.632, hm, C_ARCH, heater, bevel=0.001)
for k in range(5):
    zz = 0.527 + k * 0.024
    box(f"Heater_Louver_{k}", gx0, gx1, hy_f + 0.004, hy_f + 0.024, zz - 0.0035, zz + 0.0035, hm, C_ARCH, heater, bevel=0.001)
box("Heater_Leg_L", hx0 + 0.01, hx0 + 0.05, hy_f + 0.02, D - 0.02, 0.0, 0.10, hm, C_ARCH, heater, bevel=0.002)
box("Heater_Leg_R", hx1 - 0.05, hx1 - 0.01, hy_f + 0.02, D - 0.02, 0.0, 0.10, hm, C_ARCH, heater, bevel=0.002)
box("Heater_Kick", hx0 + 0.05, hx1 - 0.05, hy_f + 0.06, hy_f + 0.07, 0.01, 0.10, MAT["heater_dark"], C_ARCH, heater, bevel=0)
geo.cylinder("Heater_ValveKnob", 0.016, 0.02, (hx1 + 0.012, hy_f + 0.06, 0.58), C_ARCH, MAT["switch"], heater, rot=(0, math.pi / 2, 0), segs=16)

# ============================================================================
# CEILING FIXTURE (surface-mounted 2-lamp fluorescent wrap)
# ============================================================================
fx0, fx1, fy0, fy1 = 1.42, 2.42, 3.12, 3.50
fixture = geo.empty("Ceiling_Fixture", C_ARCH)
box("Fixture_Housing", fx0, fx1, fy0, fy1, H - 0.075, H, MAT["fixture"], C_ARCH, fixture, bevel=0.006)
box("Fixture_EndCap_L", fx0 - 0.004, fx0 + 0.012, fy0 - 0.004, fy1 + 0.004, H - 0.082, H - 0.005, MAT["fixture"], C_ARCH, fixture, bevel=0.004)
box("Fixture_EndCap_R", fx1 - 0.012, fx1 + 0.004, fy0 - 0.004, fy1 + 0.004, H - 0.082, H - 0.005, MAT["fixture"], C_ARCH, fixture, bevel=0.004)
lens = cushion("Fixture_Lens", fx0 + 0.012, fx1 - 0.012, fy0 + 0.008, fy1 - 0.008, H - 0.082, H - 0.06, MAT["lens"], C_ARCH, fixture, radius=0.01, levels=1)

# ============================================================================
# DOOR (swung open against the left vestibule wall)
# ============================================================================
door = geo.empty("Door", C_ARCH, (VEST_L + 0.002, -0.62, 0.0), (0, 0, math.radians(-1.5)))
box("Door_Slab", 0.0, 0.045, 0.0, 0.86, 0.01, 2.04, MAT["wood_door"], C_ARCH, door, bevel=0.003, grain="Z")
box("Door_EdgeBand", 0.0, 0.045, 0.856, 0.862, 0.01, 2.04, MAT["trim"], C_ARCH, door, bevel=0.001)
for hz in (0.25, 1.05, 1.85):
    box(f"Door_Hinge_{hz}", -0.004, 0.003, -0.012, 0.03, hz, hz + 0.11, MAT["steel"], C_ARCH, door, bevel=0.001)
for side, x_face, sgn in (("Room", 0.045, 1), ("Wall", 0.0, -1)):
    xo = x_face + sgn * 0.004
    box(f"Door_Escutcheon_{side}", min(x_face, xo), max(x_face, xo), 0.775, 0.835, 0.80, 1.11, MAT["steel"], C_ARCH, door, bevel=0.0015)
    if side == "Room":
        geo.cylinder("Door_Lever_Hub", 0.011, 0.055, (x_face + 0.03, 0.805, 0.975), C_ARCH, MAT["steel"], door, rot=(0, math.pi / 2, 0), segs=16)
        geo.curve_tube("Door_Lever", [(x_face + 0.055, 0.805, 0.975), (x_face + 0.062, 0.77, 0.975), (x_face + 0.064, 0.70, 0.972), (x_face + 0.058, 0.67, 0.968)],
                       0.0095, C_ARCH, MAT["steel"], door, res=4)
        geo.cylinder("Door_Cylinder", 0.015, 0.012, (x_face + 0.006, 0.805, 1.06), C_ARCH, MAT["steel"], door, rot=(0, math.pi / 2, 0), segs=16)
box("Door_Stop", -0.002, 0.02, 0.0, 0.03, 0.0, 0.05, MAT["baseboard"], C_ARCH, None, bevel=0.003)
bpy.data.objects["Door_Stop"].location = (VEST_L + 0.03, 0.30, 0.025)

# ============================================================================
# BEDS
# ============================================================================
colliders = []
BED_W, BED_L = 1.09, 2.095


def make_bed(name, root_loc, root_rot, plaid_mat, blanket_x, seed):
    root = geo.empty(name, C_BEDS, root_loc, (0, 0, root_rot))
    wb = MAT["wood_bed"]
    parts = []
    hb = BED_L
    # posts
    for nm, x0, y0, ht in (("FL", 0, 0, 0.70), ("FR", BED_W - 0.06, 0, 0.70), ("HL", 0, hb - 0.06, 0.88), ("HR", BED_W - 0.06, hb - 0.06, 0.88)):
        parts.append(box(f"{name}_Post_{nm}", x0, x0 + 0.06, y0, y0 + 0.06, 0, ht, wb, C_BEDS, root, bevel=0.005, grain="Z"))
    # footboard
    parts.append(box(f"{name}_Foot_TopRail", 0.06, BED_W - 0.06, 0.004, 0.056, 0.62, 0.70, wb, C_BEDS, root, bevel=0.005))
    parts.append(box(f"{name}_Foot_Panel", 0.06, BED_W - 0.06, 0.02, 0.04, 0.155, 0.62, wb, C_BEDS, root, bevel=0.002, grain="Z"))
    parts.append(box(f"{name}_Foot_BottomRail", 0.06, BED_W - 0.06, 0.008, 0.052, 0.10, 0.16, wb, C_BEDS, root, bevel=0.004))
    # headboard
    parts.append(box(f"{name}_Head_TopRail", 0.06, BED_W - 0.06, hb - 0.056, hb - 0.004, 0.78, 0.88, wb, C_BEDS, root, bevel=0.005))
    parts.append(box(f"{name}_Head_Panel", 0.06, BED_W - 0.06, hb - 0.04, hb - 0.02, 0.30, 0.78, wb, C_BEDS, root, bevel=0.002, grain="Z"))
    parts.append(box(f"{name}_Head_BottomRail", 0.06, BED_W - 0.06, hb - 0.052, hb - 0.008, 0.24, 0.31, wb, C_BEDS, root, bevel=0.004))
    # side rails + deck
    parts.append(box(f"{name}_SideRail_L", 0.06, 0.09, 0.06, hb - 0.06, 0.18, 0.38, wb, C_BEDS, root, bevel=0.003, grain="Y"))
    parts.append(box(f"{name}_SideRail_R", BED_W - 0.09, BED_W - 0.06, 0.06, hb - 0.06, 0.18, 0.38, wb, C_BEDS, root, bevel=0.003, grain="Y"))
    parts.append(box(f"{name}_Deck", 0.09, BED_W - 0.09, 0.06, hb - 0.06, 0.355, 0.375, wb, C_BEDS, root, bevel=0.002, grain="Y"))
    mat_ = cushion(f"{name}_Mattress", 0.066, BED_W - 0.066, 0.066, hb - 0.066, 0.375, 0.575, MAT["mattress"], C_BEDS, root, radius=0.045, levels=2)
    parts.append(mat_)
    for p in parts:
        colliders.append(p)
    # blanket: flat grid above the mattress, simulated as cloth afterwards
    bx0, bx1 = blanket_x
    by0, by1 = 0.075, 1.99
    res = 0.025
    nx, ny = int(round((bx1 - bx0) / res)), int(round((by1 - by0) / res))
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.28) for _ in range(6)]
    verts, faces, pins = [], [], []
    mx0, mx1, my0, my1 = 0.066, BED_W - 0.066, 0.066, hb - 0.066
    # a few soft folds seeded into the rest shape (goal shape for pinned area)
    folds = []
    for _ in range(7):
        ang = rnd.uniform(-1.2, 1.2)
        folds.append((rnd.uniform(0.15, 0.95), rnd.uniform(0.1, 1.55), math.cos(ang), math.sin(ang), rnd.uniform(0.018, 0.04), rnd.uniform(0.04, 0.09)))
    brot = math.radians(rnd.uniform(-3.0, 3.0))
    bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    for j in range(ny + 1):
        for i in range(nx + 1):
            x0_ = bx0 + (bx1 - bx0) * i / nx - bcx
            y0_ = by0 + (by1 - by0) * j / ny - bcy
            x = bcx + x0_ * math.cos(brot) - y0_ * math.sin(brot)
            y = bcy + x0_ * math.sin(brot) + y0_ * math.cos(brot)
            zz = 0.594 + 0.004 * math.sin(x * 7 + ph[0]) * math.sin(y * 4 + ph[1]) + 0.002 * math.sin(x * 19 + y * 6 + ph[2]) + rnd.uniform(0, 0.001)
            for fx, fy, cx_, cy_, amp, wid in folds:
                dist = abs((x - fx) * (-cy_) + (y - fy) * cx_)
                along = (x - fx) * cx_ + (y - fy) * cy_
                zz += amp * math.exp(-(dist / wid) ** 2) * math.exp(-(along / 0.5) ** 2)
            din = min(x - mx0, mx1 - x, (y - my0) * 3, my1 - y)
            w_pin = max(0.0, min(1.0, (din - 0.03) / 0.16)) ** 1.5
            pins.append(w_pin)
            verts.append((x, y, zz))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    bl = geo.mesh_obj(f"{name}_Blanket", verts, faces, C_BEDS, plaid_mat, root, smooth=True,
                      uv_fn=lambda co, n: (co.x, co.y))
    vg = bl.vertex_groups.new(name="pin")
    for vi, wgt in enumerate(pins):
        if wgt > 0:
            vg.add([vi], wgt, "REPLACE")
    return root, bl, mat_


bedL, blanketL, mattressL = make_bed("Bed_Left", (0.0, D - BED_L, 0.0), 0.0, MAT["plaid_L"], (0.012, 1.40), 1)
theta = math.radians(-2.7)
piv = Vector((3.07, D))
off = Vector((0.0, -BED_L))
rot_off = Vector((off.x * math.cos(theta) - off.y * math.sin(theta), off.x * math.sin(theta) + off.y * math.cos(theta)))
bedR, blanketR, mattressR = make_bed("Bed_Right", (piv.x + rot_off.x, piv.y + rot_off.y, 0.0), theta, MAT["plaid_R"], (-0.36, 1.07), 2)

# walls act as colliders for the blankets
colliders += [bpy.data.objects["Wall_Left"], bpy.data.objects["Wall_Right"], bpy.data.objects["Wall_Back_L"], bpy.data.objects["Wall_Back_R"],
              bpy.data.objects["Floor_Carpet"]]


def simulate_blankets(blankets, frames=50):
    for o in colliders:
        m = o.modifiers.new("Collision", "COLLISION")
        o.collision.thickness_outer = 0.006
        o.collision.cloth_friction = 35.0
        o.collision.damping = 0.6
    for bl in blankets:
        cm = bl.modifiers.new("Cloth", "CLOTH")
        s = cm.settings
        s.quality = 7
        s.mass = 0.45
        s.tension_stiffness = 12
        s.compression_stiffness = 12
        s.shear_stiffness = 6
        s.bending_stiffness = 0.15
        s.shrink_min = -0.07   # rest length > placement: fabric buckles into natural folds
        s.tension_damping = 6
        s.compression_damping = 6
        s.shear_damping = 6
        s.air_damping = 2.0
        cs = cm.collision_settings
        cs.collision_quality = 4
        cs.distance_min = 0.006
        cs.use_self_collision = True
        cs.self_distance_min = 0.005
        cs.self_friction = 8
        s.vertex_group_mass = "pin"
        s.pin_stiffness = 0.2
        cm.point_cache.frame_start = 1
        cm.point_cache.frame_end = frames
    scene.frame_start, scene.frame_end = 1, frames
    for f in range(1, frames + 1):
        scene.frame_set(f)
        if f % 10 == 0 or (os.environ.get("CLOTH_DEBUG") and f <= 10):
            dgx = bpy.context.evaluated_depsgraph_get()
            info = []
            for bl in blankets:
                ev = bl.evaluated_get(dgx)
                zs = [(ev.matrix_world @ v.co) for v in ev.data.vertices]
                info.append(f"{bl.name}: z[{min(p.z for p in zs):.2f},{max(p.z for p in zs):.2f}] x[{min(p.x for p in zs):.2f},{max(p.x for p in zs):.2f}]")
            print(f"  cloth frame {f}/{frames} " + " | ".join(info), flush=True)
    dg = bpy.context.evaluated_depsgraph_get()
    for bl in blankets:
        ev = bl.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        old = bl.data
        bl.modifiers.clear()
        bl.data = me
        me.name = bl.name
        bpy.data.meshes.remove(old)
        me.shade_smooth()
    for o in colliders:
        for m in list(o.modifiers):
            if m.type == "COLLISION":
                o.modifiers.remove(m)
    scene.frame_set(1)


def finish_blanket(bl, thick=0.028):
    s = bl.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = thick
    s.offset = 1.0
    s.use_even_offset = False
    s.thickness_clamp = 0.6
    s.use_quality_normals = True
    sub = bl.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 2


if not SKIP_CLOTH:
    print("Simulating blankets...", flush=True)
    simulate_blankets([blanketL, blanketR])
for bl in (blanketL, blanketR):
    finish_blanket(bl)


def surface_z(obj, pts_world, default):
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, dg)
    mw = obj.matrix_world
    inv = mw.inverted()
    best = default
    for p in pts_world:
        o = inv @ Vector((p[0], p[1], 3.0))
        d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        hit = bvh.ray_cast(o, d)
        if hit[0] is not None:
            best = max(best, (mw @ hit[0]).z)
    return best


def add_pillow(name, bed_root, blanket, local_xy, rot_z, seed):
    mw = bed_root.matrix_world
    c = mw @ Vector((local_xy[0], local_xy[1], 0))
    samples = [mw @ Vector((local_xy[0] + dx, local_xy[1] + dy, 0)) for dx in (-0.2, 0, 0.2) for dy in (-0.12, 0, 0.12)]
    zb = surface_z(blanket, samples, 0.58)
    p = geo.pillow(name, 0.64, 0.43, 0.12, C_BEDS, MAT["pillow"], bed_root, seed=seed, dent=0.3)
    p.location = (local_xy[0], local_xy[1], zb - 0.012)
    p.rotation_euler = (math.radians(random.uniform(-1.5, 1.5)), math.radians(random.uniform(-2, 2)), rot_z)
    return p


bpy.context.view_layer.update()
add_pillow("Bed_Left_Pillow", bedL, blanketL, (0.56, BED_L - 0.31), math.radians(4), 11)
add_pillow("Bed_Right_Pillow", bedR, blanketR, (0.55, BED_L - 0.30), math.radians(-3), 12)

# ============================================================================
# WARDROBE (left wall, in front of the left bed)
# ============================================================================
wx0, wx1, wy0, wy1, wz1 = 0.0, 0.52, 2.50, 3.40, 1.78
ward = geo.empty("Wardrobe", C_FURN)
wd = MAT["wood_ward"]
box("Wardrobe_Plinth", wx0 + 0.02, wx1 - 0.04, wy0 + 0.03, wy1 - 0.03, 0, 0.07, wd, C_FURN, ward, bevel=0.003, grain="Y")
box("Wardrobe_Side_Front", wx0, wx1 - 0.02, wy0, wy0 + 0.019, 0.0, wz1 - 0.02, wd, C_FURN, ward, bevel=0.003, grain="Z")
box("Wardrobe_Side_Back", wx0, wx1 - 0.02, wy1 - 0.019, wy1, 0.0, wz1 - 0.02, wd, C_FURN, ward, bevel=0.003, grain="Z")
box("Wardrobe_Body", wx0 + 0.01, wx1 - 0.02, wy0 + 0.019, wy1 - 0.019, 0.07, wz1 - 0.02, wd, C_FURN, ward, bevel=0.002, grain="Z")
box("Wardrobe_Top", wx0, wx1 + 0.012, wy0 - 0.012, wy1 + 0.012, wz1 - 0.02, wz1, wd, C_FURN, ward, bevel=0.004, grain="Y")
dmid = (wy0 + wy1) / 2
for nm, ya, yb in (("Near", wy0 + 0.004, dmid - 0.002), ("Far", dmid + 0.002, wy1 - 0.004)):
    dr = box(f"Wardrobe_Door_{nm}", wx1 - 0.02, wx1, ya, yb, 0.075, wz1 - 0.024, wd, C_FURN, ward, bevel=0.003, grain="Z")
    # thin applied moulding frame on each door
    inset = 0.045
    for k, (y0_, y1_, z0_, z1_) in enumerate(((ya + inset, yb - inset, wz1 - 0.024 - inset - 0.012, wz1 - 0.024 - inset),
                                              (ya + inset, yb - inset, 0.075 + inset, 0.075 + inset + 0.012),
                                              (ya + inset, ya + inset + 0.012, 0.075 + inset, wz1 - 0.024 - inset),
                                              (yb - inset - 0.012, yb - inset, 0.075 + inset, wz1 - 0.024 - inset))):
        box(f"Wardrobe_Door_{nm}_Moulding_{k}", wx1, wx1 + 0.005, y0_, y1_, z0_, z1_, wd, C_FURN, ward, bevel=0.002,
            grain="Y" if k < 2 else "Z")
    hy = yb - 0.03 if nm == "Near" else ya + 0.03
    for zz in (0.96, 1.12):
        box(f"Wardrobe_Pull_{nm}_Post_{zz}", wx1, wx1 + 0.024, hy - 0.004, hy + 0.004, zz - 0.004, zz + 0.004, MAT["steel"], C_FURN, ward, bevel=0.001)
    geo.cylinder(f"Wardrobe_Pull_{nm}", 0.0055, 0.19, (wx1 + 0.024, hy, 1.04), C_FURN, MAT["steel"], ward, segs=12)

# footlocker trunk on top of the wardrobe
trunk = geo.empty("Trunk", C_PROPS, (0.31, 2.88, wz1), (0, 0, math.radians(-3)))
tm = MAT["trunk"]
box("Trunk_Body", -0.14, 0.14, -0.27, 0.27, 0.0, 0.11, tm, C_PROPS, trunk, bevel=0.006, seg=3)
box("Trunk_Lid", -0.145, 0.145, -0.275, 0.275, 0.11, 0.155, tm, C_PROPS, trunk, bevel=0.01, seg=3)
box("Trunk_LidBand", -0.147, 0.147, -0.277, 0.277, 0.106, 0.116, tm, C_PROPS, trunk, bevel=0.003)
for yy in (-0.16, 0.16):
    box(f"Trunk_Latch_{yy}", 0.142, 0.15, yy - 0.02, yy + 0.02, 0.085, 0.13, MAT["brass"], C_PROPS, trunk, bevel=0.002)
for yy in (-0.27, 0.27):
    for xx in (-0.14, 0.14):
        box(f"Trunk_Corner_{xx}_{yy}", xx - 0.012, xx + 0.012, yy - 0.012, yy + 0.012, 0.0, 0.03, MAT["brass"], C_PROPS, trunk, bevel=0.004)
geo.curve_tube("Trunk_Handle", [(0.0, -0.285, 0.08), (0.0, -0.30, 0.055), (0.0, -0.285, 0.03)], 0.006, C_PROPS, MAT["zipper"], trunk)
box("Trunk_Handle_Plate", -0.045, 0.045, -0.28, -0.275, 0.025, 0.09, MAT["brass"], C_PROPS, trunk, bevel=0.002)

# ============================================================================
# DESKS
# ============================================================================


def desk_left():
    root = geo.empty("Desk_Left", C_FURN)
    w_ = MAT["wood"]
    x0, x1, y0, y1 = 0.12, 0.92, 0.95, 2.11
    box("DeskL_Top", x0, x1, y0, y1, 0.728, 0.76, w_, C_FURN, root, bevel=0.005, seg=3, grain="Y")
    # drawer pedestal at the near end (drawers face the room)
    px0, px1, py0, py1 = x0 + 0.02, x1 - 0.02, y0 + 0.02, y0 + 0.46
    box("DeskL_Ped_Body", px0, px1 - 0.02, py0, py1, 0.03, 0.728, w_, C_FURN, root, bevel=0.003, grain="Z")
    box("DeskL_Ped_SideNear", px0, px1, py0, py0 + 0.018, 0.0, 0.728, w_, C_FURN, root, bevel=0.003, grain="Z")
    box("DeskL_Ped_SideFar", px0, px1, py1 - 0.018, py1, 0.0, 0.728, w_, C_FURN, root, bevel=0.003, grain="Z")
    zs = [(0.035, 0.255), (0.262, 0.482), (0.489, 0.705)]
    for k, (za, zb) in enumerate(zs):
        box(f"DeskL_Drawer_{k}", px1 - 0.02, px1, py0 + 0.02, py1 - 0.02, za, zb, w_, C_FURN, root, bevel=0.003, grain="Y")
        hz = zb - 0.045 if k == 2 else (za + zb) / 2 + 0.05
        box(f"DeskL_Drawer_{k}_Pull", px1, px1 + 0.022, py0 + 0.16, py1 - 0.16, hz - 0.007, hz + 0.007, MAT["steel"], C_FURN, root, bevel=0.004, seg=3)
    # far end legs + aprons + modesty panel
    for nm, lx in (("Wall", x0 + 0.01), ("Room", x1 - 0.06)):
        box(f"DeskL_Leg_{nm}", lx, lx + 0.05, y1 - 0.07, y1 - 0.02, 0.0, 0.728, w_, C_FURN, root, bevel=0.004, grain="Z")
    box("DeskL_Apron_Room", x1 - 0.05, x1 - 0.03, py1, y1 - 0.07, 0.64, 0.728, w_, C_FURN, root, bevel=0.002, grain="Y")
    box("DeskL_Apron_End", x0 + 0.06, x1 - 0.06, y1 - 0.065, y1 - 0.045, 0.64, 0.728, w_, C_FURN, root, bevel=0.002)
    box("DeskL_Modesty", x0 + 0.02, x0 + 0.04, py1, y1 - 0.07, 0.30, 0.728, w_, C_FURN, root, bevel=0.002, grain="Y")
    return root


def desk_right():
    root = geo.empty("Desk_Right", C_FURN)
    w_ = MAT["wood"]
    x0, x1, y0, y1 = 3.19, 3.99, 1.85, 2.95
    box("DeskR_Top", x0, x1, y0, y1, 0.728, 0.76, w_, C_FURN, root, bevel=0.005, seg=3, grain="Y")
    for nm, lx, ly in (("NearRoom", x0 + 0.01, y0 + 0.01), ("NearWall", x1 - 0.06, y0 + 0.01), ("FarRoom", x0 + 0.01, y1 - 0.06), ("FarWall", x1 - 0.06, y1 - 0.06)):
        box(f"DeskR_Leg_{nm}", lx, lx + 0.05, ly, ly + 0.05, 0.0, 0.728, w_, C_FURN, root, bevel=0.004, grain="Z")
    for nm, ly in (("Near", y0 + 0.02), ("Far", y1 - 0.04)):
        box(f"DeskR_EndPanel_{nm}", x0 + 0.06, x1 - 0.06, ly, ly + 0.018, 0.10, 0.728, w_, C_FURN, root, bevel=0.002, grain="X")
    box("DeskR_Apron_Room", x0 + 0.02, x0 + 0.04, y0 + 0.06, y1 - 0.06, 0.64, 0.728, w_, C_FURN, root, bevel=0.002, grain="Y")
    box("DeskR_Modesty", x1 - 0.05, x1 - 0.03, y0 + 0.06, y1 - 0.06, 0.30, 0.728, w_, C_FURN, root, bevel=0.002, grain="Y")
    box("DeskR_PencilDrawer", x0 + 0.005, x0 + 0.025, y0 + 0.30, y0 + 0.80, 0.652, 0.722, w_, C_FURN, root, bevel=0.003, grain="Y")
    geo.cylinder("DeskR_PencilDrawer_Knob", 0.012, 0.022, (x0 - 0.006, y0 + 0.55, 0.687), C_FURN, MAT["steel"], root, rot=(0, math.pi / 2, 0), segs=16)
    return root


desk_left()
desk_right()

# ============================================================================
# CHAIRS
# ============================================================================


def chair(name, loc, rot_z, seed):
    root = geo.empty(name, C_FURN, loc, (0, 0, rot_z))
    w_ = MAT["wood"]
    up = MAT["upholstery"]
    L = 0.034
    for nm, x in (("L", -0.19), ("R", 0.19)):
        box(f"{name}_FrontLeg_{nm}", x - L / 2, x + L / 2, 0.17 - L / 2, 0.17 + L / 2, 0.0, 0.44, w_, C_FURN, root, bevel=0.003, grain="Z")
        post = box(f"{name}_BackPost_{nm}", x - L / 2, x + L / 2, -0.19 - L / 2, -0.19 + L / 2, 0.0, 0.88, w_, C_FURN, root, bevel=0.003, grain="Z")
        # rake the back post: pivot near the floor
        post.rotation_euler = (math.radians(4.0), 0, 0)
        post.location = (x, -0.19 - 0.44 * math.sin(math.radians(4.0)), 0.44 * math.cos(math.radians(4.0)))
        box(f"{name}_SideApron_{nm}", x - 0.011, x + 0.011, -0.17, 0.155, 0.37, 0.435, w_, C_FURN, root, bevel=0.002, grain="Y")
        box(f"{name}_Stretcher_{nm}", x - 0.01, x + 0.01, -0.17, 0.155, 0.12, 0.145, w_, C_FURN, root, bevel=0.002, grain="Y")
    box(f"{name}_FrontApron", -0.175, 0.175, 0.15, 0.17, 0.37, 0.435, w_, C_FURN, root, bevel=0.002)
    box(f"{name}_BackApron", -0.175, 0.175, -0.205, -0.185, 0.37, 0.435, w_, C_FURN, root, bevel=0.002)
    box(f"{name}_MidStretcher", -0.175, 0.175, -0.012, 0.012, 0.13, 0.152, w_, C_FURN, root, bevel=0.002)
    cushion(f"{name}_Seat", -0.215, 0.215, -0.215, 0.205, 0.433, 0.483, up, C_FURN, root, radius=0.018)
    back = cushion(f"{name}_Backrest", -0.172, 0.172, -0.018, 0.018, -0.15, 0.13, up, C_FURN, root, radius=0.014)
    a = math.radians(4.0)
    back.rotation_euler = (a, 0, 0)
    back.location = (0, -0.205 - 0.71 * math.sin(a), 0.71 * math.cos(a))
    top = box(f"{name}_BackTopRail", -0.175, 0.175, -0.012, 0.012, -0.02, 0.02, w_, C_FURN, root, bevel=0.004)
    top.rotation_euler = (a, 0, 0)
    top.location = (0, -0.19 - 0.865 * math.sin(a), 0.865 * math.cos(a))
    return root


chair("Chair_Left", (1.20, 1.32, 0.0), math.radians(78), 1)
chair("Chair_Right", (3.20, 2.30, 0.0), math.radians(-112), 2)

# ============================================================================
# PROPS
# ============================================================================


def book(name, w, d, h, loc, rot, mat, parent=None, coll_=C_PROPS):
    """Hardcover: cover boards + page block.  w = thickness, d = cover width, h = height."""
    root = geo.empty(name, coll_, loc, rot, parent)
    box(f"{name}_Cover", -w / 2, w / 2, -d / 2, d / 2, 0, h, mat, coll_, root, bevel=0.0025, seg=2)
    box(f"{name}_Pages", -w / 2 + 0.002, w / 2 - 0.002, -d / 2 + 0.004, d / 2 + 0.0015, 0.004, h - 0.004, MAT["paper"], coll_, root, bevel=0.001)
    return root


# standing books at the far end of the left desk (spines face the camera)
x = 0.15
rb = random.Random(5)
for i in range(7):
    t = rb.uniform(0.022, 0.048)
    h = rb.uniform(0.18, 0.245)
    d = rb.uniform(0.13, 0.17)
    lean = math.radians(8) if i == 6 else 0.0
    book(f"Book_DeskL_{i}", t, d, h, (x + t / 2, 2.085 - d / 2, 0.76), (0, -lean, 0), BOOK_MATS[i % len(BOOK_MATS)])
    x += t + 0.002
box("Bookend_DeskL", x + 0.004, x + 0.008, 1.99, 2.08, 0.76, 0.88, MAT["trunk"], C_PROPS, bevel=0.001)
box("Bookend_DeskL_Base", x + 0.008, x + 0.07, 1.99, 2.08, 0.76, 0.763, MAT["trunk"], C_PROPS, bevel=0.0008)
# pen cup with pencils
cupx, cupy = x + 0.15, 2.02
geo.cylinder("PenCup", 0.034, 0.10, (cupx, cupy, 0.81), C_PROPS, MAT["cup"], segs=24)
for k, (dx, dy, ang) in enumerate(((0.008, 0.0, 6), (-0.01, 0.008, -8), (0.0, -0.012, 3))):
    geo.cylinder(f"PenCup_Pencil_{k}", 0.0035, 0.17, (cupx + dx, cupy + dy, 0.845), C_PROPS, MAT["pencil" if k != 1 else "pen"],
                 rot=(math.radians(ang), math.radians(ang * 0.7), 0), segs=6)
# spiral notebook + loose sheet
nb = geo.empty("Notebook", C_PROPS, (0.60, 1.66, 0.76), (0, 0, math.radians(-6)))
box("Notebook_Cover", -0.14, 0.14, -0.105, 0.105, 0.0, 0.012, MAT["notebook"], C_PROPS, nb, bevel=0.0015)
box("Notebook_Pages", -0.135, 0.138, -0.10, 0.10, 0.0015, 0.0105, MAT["paper"], C_PROPS, nb, bevel=0.0008)
for k in range(18):
    geo.cylinder(f"Notebook_Coil_{k}", 0.004, 0.003, (-0.142, -0.095 + k * 0.0112, 0.006), C_PROPS, MAT["steel"], nb, rot=(math.pi / 2, 0, 0), segs=8, cap=False, smooth=False)
sheet = geo.grid_plane("Notebook_LooseSheet", 0.215, 0.28, 6, 8, C_PROPS, MAT["sheet_paper"], nb,
                       deform=lambda u, v: 0.004 * (u ** 2) + 0.002 * math.sin(v * 3))
sheet.location = (0.03, 0.015, 0.0135)
sheet.rotation_euler = (0, 0, math.radians(97))

# right desk: stacked books, lamp, small speaker
for i, (w_, d_, h_, dx, dy, rz) in enumerate(((0.235, 0.17, 0.032, 0.0, 0.0, 4), (0.22, 0.16, 0.026, 0.01, -0.005, -3), (0.25, 0.18, 0.03, -0.01, 0.01, 7))):
    zb = 0.76 + sum((0.032, 0.026, 0.03)[:i])
    b_ = geo.empty(f"Book_DeskR_{i}", C_PROPS, (3.50 + dx, 2.42 + dy, zb), (0, 0, math.radians(rz + 90)))
    box(f"Book_DeskR_{i}_Cover", -w_ / 2, w_ / 2, -d_ / 2, d_ / 2, 0, h_, BOOK_MATS[(i + 3) % len(BOOK_MATS)], C_PROPS, b_, bevel=0.0025)
    box(f"Book_DeskR_{i}_Pages", -w_ / 2 + 0.003, w_ / 2 + 0.0015, -d_ / 2 + 0.003, d_ / 2 - 0.003, 0.003, h_ - 0.003, MAT["paper"], C_PROPS, b_, bevel=0.001)

lamp = geo.empty("DeskLamp", C_PROPS, (3.68, 2.72, 0.76), (0, 0, math.radians(143)))
lm = MAT["lamp"]
geo.cylinder("Lamp_Base", 0.075, 0.022, (0, 0, 0.011), C_PROPS, lm, lamp, segs=32, r2=0.07)
geo.cylinder("Lamp_Hub", 0.014, 0.04, (0, 0, 0.04), C_PROPS, lm, lamp, segs=16)
elbow = Vector((0.0, -0.05, 0.33))
geo.curve_tube("Lamp_ArmLower", [(0, 0, 0.055), (0.0, -0.02, 0.2), elbow], 0.0075, C_PROPS, lm, lamp, res=3)
geo.cylinder("Lamp_Elbow", 0.012, 0.03, tuple(elbow), C_PROPS, lm, lamp, rot=(0, math.pi / 2, 0), segs=16)
head = Vector((0.0, 0.17, 0.30))
geo.curve_tube("Lamp_ArmUpper", [tuple(elbow), (0.0, 0.06, 0.345), tuple(head)], 0.0065, C_PROPS, lm, lamp, res=3)
shade = geo.cylinder("Lamp_Shade", 0.022, 0.13, (0.0, 0.17 + 0.065 * 0.6, 0.30 - 0.065 * 0.8), C_PROPS, lm, lamp, rot=(math.radians(-143), 0, 0), segs=32, r2=0.066, cap=False)
sh_sol = shade.modifiers.new("Solidify", "SOLIDIFY")
sh_sol.thickness = 0.0012
geo.cylinder("Lamp_ShadeCap", 0.026, 0.03, (0.0, 0.17, 0.30), C_PROPS, lm, lamp, rot=(math.radians(-143), 0, 0), segs=24)
geo.curve_tube("Lamp_Cord", [(0.0, 0.06, 0.01), (0.04, 0.16, 0.003), (0.10, 0.20, 0.002), (0.15, 0.30, 0.002)], 0.002, C_PROPS, MAT["zipper"], lamp)

spk = geo.empty("Speaker", C_PROPS, (3.89, 2.86, 0.76), (0, 0, math.radians(-8)))
box("Speaker_Body", -0.075, 0.075, -0.085, 0.085, 0.0, 0.25, MAT["speaker"], C_PROPS, spk, bevel=0.006, seg=3)
box("Speaker_Grille", -0.078, -0.074, -0.075, 0.075, 0.02, 0.23, MAT["grille_cloth"], C_PROPS, spk, bevel=0.003)

# wastebasket in front of the right desk
wb_root = geo.empty("Wastebasket", C_PROPS, (3.25, 1.70, 0.0), (0, 0, math.radians(5)))
geo.open_bin("Wastebasket_Body", 0.22, 0.27, 0.255, 0.31, 0.34, C_PROPS, MAT["bin"], wb_root)
geo.curve_tube("Wastebasket_Rim", [(-0.128, -0.156, 0.34), (0.128, -0.156, 0.34), (0.128, 0.156, 0.34), (-0.128, 0.156, 0.34), (-0.128, -0.156, 0.34)],
               0.003, C_PROPS, MAT["bin"], wb_root, smooth=False)
cr = geo.soft_body("Wastebasket_CrumpledPaper", 0.07, 0.07, 0.06, C_PROPS, MAT["sheet_paper"], wb_root, round_r=0.01, seed=4, top_arch=0.2, bulge=0.01)
cr.location = (0.02, -0.03, 0.05)

# backpack standing against the right bed's footboard
bp = geo.empty("Backpack", C_PROPS, (3.03, 3.17, 0.0), (math.radians(-11), math.radians(3), math.radians(-18)))
body = geo.soft_body("Backpack_Body", 0.30, 0.17, 0.44, C_PROPS, MAT["nylon"], bp, round_r=0.05, seed=7, top_arch=0.35, bulge=0.025, sag=0.012)
body.location = (0, 0, 0.225)
pocket = geo.soft_body("Backpack_FrontPocket", 0.24, 0.07, 0.20, C_PROPS, MAT["nylon"], bp, round_r=0.03, seed=8, top_arch=0.15, bulge=0.012)
pocket.location = (0.0, -0.105, 0.135)
patch = box("Backpack_Patch", -0.03, 0.03, -0.146, -0.142, 0.17, 0.205, MAT["nylon_logo"], C_PROPS, bp, bevel=0.003)
# zippers
geo.curve_tube("Backpack_Zip_Main", [(-0.15, -0.06, 0.25), (-0.12, -0.075, 0.40), (0.0, -0.06, 0.445), (0.12, -0.075, 0.40), (0.15, -0.06, 0.25)], 0.0035, C_PROPS, MAT["zipper"], bp)
geo.curve_tube("Backpack_Zip_Pocket", [(-0.115, -0.13, 0.215), (0.0, -0.142, 0.238), (0.115, -0.13, 0.215)], 0.003, C_PROPS, MAT["zipper"], bp)
for k, (px, pz) in enumerate(((0.13, 0.33), (0.07, 0.228))):
    box(f"Backpack_ZipPull_{k}", px - 0.006, px + 0.006, -0.15, -0.144, pz - 0.03, pz, MAT["zipper"], C_PROPS, bp, bevel=0.002)
geo.curve_tube("Backpack_TopHandle", [(-0.04, 0.03, 0.44), (-0.02, 0.035, 0.475), (0.02, 0.035, 0.475), (0.04, 0.03, 0.44)], 0.006, C_PROPS, MAT["nylon"], bp, extrude=0.008)
for sx in (-0.08, 0.08):
    geo.curve_tube(f"Backpack_Strap_{sx}", [(sx * 0.6, 0.085, 0.42), (sx, 0.12, 0.33), (sx * 1.1, 0.12, 0.15), (sx * 1.3, 0.09, 0.02), (sx * 1.5, 0.03, 0.006)],
                   0.008, C_PROPS, MAT["nylon"], bp, extrude=0.022, tilt=math.pi / 2)

# ============================================================================
# POSTERS & PHOTOS
# ============================================================================


def poster(name, image, w, h, loc, rot, seed, curl=0.004, paper_rough=0.45, parent=None):
    rnd = random.Random(seed)
    lift = [rnd.uniform(0, curl) for _ in range(4)]

    def deform(u, v):
        corner = (lift[0] * (1 - u) * (1 - v) + lift[1] * u * (1 - v) + lift[2] * (1 - u) * v + lift[3] * u * v)
        bulge = 0.0015 * math.sin(math.pi * u) * math.sin(math.pi * v)
        return (corner * ((2 * u - 1) ** 4 + (2 * v - 1) ** 4)) + bulge

    mat = M.paper_image(f"Print_{name}", image, rough=paper_rough)
    p = geo.grid_plane(name, w, h, 12, 12, C_DECOR, mat, parent, deform=deform)
    s = p.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = 0.0004
    p.location = loc
    p.rotation_euler = rot
    return p


R_BACK = (math.pi / 2, 0, 0)
R_LEFT = (math.pi / 2, 0, math.pi / 2)
R_RIGHT = (math.pi / 2, 0, -math.pi / 2)
poster("Poster_Back_MountainForest", "poster_mountain_forest.png", 0.70, 0.76, (0.617, D - 0.003, 1.49), (math.pi / 2, math.radians(0.6), 0), 1)
poster("Poster_Right_TreeCity", "poster_tree_city.png", 0.92, 0.76, (W - 0.003, 4.67, 1.40), (math.pi / 2, math.radians(-0.5), -math.pi / 2), 2)
poster("Poster_Left_ForestTall", "poster_forest_tall.png", 0.38, 0.68, (0.003, 4.90, 1.46), (math.pi / 2, math.radians(0.8), math.pi / 2), 3)
poster("Poster_Wardrobe_Hiker", "poster_hiker.png", 0.25, 0.53, (0.18, wy0 - 0.002, 1.335), (math.pi / 2, math.radians(-0.7), 0), 4)
for i, (img, w_, h_, loc, rot) in enumerate((
        ("photo_0.png", 0.25, 0.175, (3.39, D - 0.003, 1.20), (math.pi / 2, math.radians(-2), 0)),
        ("photo_2.png", 0.17, 0.235, (3.695, D - 0.003, 1.345), (math.pi / 2, math.radians(1.5), 0)),
        ("photo_3.png", 0.235, 0.165, (3.75, D - 0.003, 1.07), (math.pi / 2, math.radians(3), 0)),
        ("photo_1.png", 0.15, 0.105, (0.40, wy0 - 0.002, 1.47), (math.pi / 2, math.radians(2), 0)),
        ("photo_4.png", 0.15, 0.105, (0.41, wy0 - 0.002, 1.30), (math.pi / 2, math.radians(-3), 0)))):
    poster(f"Photo_{i}", img, w_, h_, loc, rot, 10 + i, curl=0.003, paper_rough=0.3)

# ============================================================================
# EXTERIOR BACKPLATE + WORLD
# ============================================================================
bd = geo.grid_plane("Exterior_Backplate", 9.6, 4.8, 1, 1, C_EXT, MAT["backdrop"])
bd.location = (2.2, D + 7.0, 1.8)
bd.rotation_euler = (math.pi / 2, 0, 0)
bd.visible_diffuse = False
bd.visible_shadow = False
bd.visible_volume_scatter = False

world = bpy.data.worlds.new("Overcast_Sky")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
wn = world.node_tree
wn.nodes.clear()
sky_tc = wn.nodes.new("ShaderNodeTexCoord")
sky_sep = wn.nodes.new("ShaderNodeSeparateXYZ")
wn.links.new(sky_tc.outputs["Generated"], sky_sep.inputs["Vector"])
sky_ramp = wn.nodes.new("ShaderNodeValToRGB")
wn.links.new(sky_sep.outputs["Z"], sky_ramp.inputs["Fac"])
sky_ramp.color_ramp.elements[0].position = 0.0
sky_ramp.color_ramp.elements[0].color = (0.30, 0.30, 0.28, 1)   # ground bounce
sky_ramp.color_ramp.elements[1].position = 0.04
sky_ramp.color_ramp.elements[1].color = (0.55, 0.58, 0.62, 1)   # horizon
z_el = sky_ramp.color_ramp.elements.new(1.0)
z_el.color = (1.55, 1.60, 1.68, 1)                                # zenith (CIE overcast ~3x horizon)
bg = wn.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 3.4
wn.links.new(sky_ramp.outputs["Color"], bg.inputs["Color"])
wout = wn.nodes.new("ShaderNodeOutputWorld")
wn.links.new(bg.outputs["Background"], wout.inputs["Surface"])

# ============================================================================
# LIGHTS
# ============================================================================


def area_light(name, size, size_y, loc, rot, energy, color, portal=False, visible=False):
    L = bpy.data.lights.new(name, "AREA")
    L.shape = "RECTANGLE"
    L.size, L.size_y = size, size_y
    L.energy = energy
    L.color = color
    if portal:
        L.cycles.is_portal = True
    o = bpy.data.objects.new(name, L)
    C_LIGHT.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.visible_camera = visible
    return o


area_light("Window_Portal", WIN_X1 - WIN_X0, WIN_Z1 - WIN_Z0, ((WIN_X0 + WIN_X1) / 2, D + BACK_T - 0.01, (WIN_Z0 + WIN_Z1) / 2),
           (-math.pi / 2, 0, 0), 0, (1, 1, 1), portal=True)
area_light("Fixture_Light", fx1 - fx0 - 0.04, fy1 - fy0 - 0.03, ((fx0 + fx1) / 2, (fy0 + fy1) / 2, H - 0.086), (0, 0, 0), 45.0, (0.97, 1.0, 0.93))
# wraparound lens also emits sideways: two thin strips on the long sides, tilted slightly up
for k, (yy, rx) in enumerate(((fy0 + 0.005, math.radians(-100)), (fy1 - 0.005, math.radians(100)))):
    area_light(f"Fixture_SideGlow_{k}", fx1 - fx0 - 0.04, 0.02, ((fx0 + fx1) / 2, yy, H - 0.07), (rx, 0, 0), 32.0, (0.97, 1.0, 0.93))
area_light("Vestibule_Light", 0.30, 0.30, ((VEST_L + VEST_R) / 2, -0.40, H - 0.02), (math.radians(30), 0, 0), 14.0, (0.97, 1.0, 0.95))
area_light("Corridor_Light", 1.2, 0.3, ((VEST_L + VEST_R) / 2, -1.7, H - 0.02), (0, 0, 0), 60.0, (0.95, 0.98, 1.0))

# hazy sun behind the window (overcast-bright): soft pool on the carpet and backlit blinds
sun_d = bpy.data.lights.new("Sun_Hazy", "SUN")
sun_d.energy = 5.5
sun_d.angle = math.radians(12)
sun_d.color = (1.0, 0.97, 0.92)
sun = bpy.data.objects.new("Sun_Hazy", sun_d)
C_LIGHT.objects.link(sun)
sun.rotation_euler = (math.radians(-45), 0, math.radians(4))   # light travels -Y and down at ~45 deg elevation

# ============================================================================
# CAMERA
# ============================================================================
cam_data = bpy.data.cameras.new("Camera_Ref")
cam_data.lens = 24.0
cam_data.sensor_fit = "HORIZONTAL"
cam_data.sensor_width = 36.0
cam_data.shift_x = -(942 - 836) / 1672
cam_data.shift_y = -(470.5 - 323) / 1672
cam_data.clip_start = 0.02
cam_data.clip_end = 60
cam_data.dof.use_dof = True
cam_data.dof.focus_distance = 4.2
cam_data.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Camera_Ref", cam_data)
C_CAM.objects.link(cam)
cam.location = CAM
cam.rotation_euler = (math.pi / 2, 0, 0)
scene.camera = cam

# ============================================================================
# RENDER SETTINGS
# ============================================================================
r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y, r.resolution_percentage = 1672, 941, 100
r.film_transparent = False
cy = scene.cycles
cy.device = "CPU"
cy.samples = 256
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.max_bounces = 10
cy.diffuse_bounces = 5
cy.glossy_bounces = 4
cy.transmission_bounces = 8
cy.transparent_max_bounces = 32
cy.sample_clamp_indirect = 4.0
cy.blur_glossy = 0.6
cy.caustics_reflective = False
cy.caustics_refractive = False
try:
    cy.use_light_tree = True
except Exception:
    pass
vs = scene.view_settings
vs.view_transform = "AgX"
vs.look = "AgX - Base Contrast"
vs.exposure = 0.12
r.image_settings.file_format = "PNG"
r.image_settings.color_depth = "8"

# ---------------------------------------------------------------- save
bpy.context.view_layer.update()
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
try:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_mainfile()
except Exception as e:
    print("pack failed:", e)
n_obj = len(bpy.data.objects)
n_tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE"):
        try:
            me = o.evaluated_get(dg).to_mesh()
            n_tris += sum(len(p.vertices) - 2 for p in me.polygons)
            o.evaluated_get(dg).to_mesh_clear()
        except Exception:
            pass
print(f"Saved {OUT}: {n_obj} objects, ~{n_tris} render triangles")
