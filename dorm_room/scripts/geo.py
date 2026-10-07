"""Geometry helpers: boxes, rounded cushions, cylinders, curves, procedural
soft goods (pillow, backpack body) built directly with the data API."""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

GRAIN = {"X": (0.0, 0.0, 0.0), "Y": (0.0, 0.0, -math.pi / 2), "Z": (0.0, math.pi / 2, 0.0)}

CUBE_FACES = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]


def link(obj, coll, parent=None):
    coll.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, coll, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    e.empty_display_size = 0.2
    e.location = loc
    e.rotation_euler = rot
    return link(e, coll, parent)


def mesh_obj(name, verts, faces, coll, mat=None, parent=None, smooth=False, uv_fn=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate()
    me.update()
    if uv_fn is not None:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                uvl.data[li].uv = uv_fn(me.vertices[vi].co, poly.normal)
    if mat is not None:
        me.materials.append(mat)
    if smooth:
        me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    return link(obj, coll, parent)


def box_uv(co, n):
    a = abs(n.x), abs(n.y), abs(n.z)
    if a[2] >= a[0] and a[2] >= a[1]:
        return (co.x, co.y)
    if a[0] >= a[1]:
        return (co.y, co.z)
    return (co.x, co.z)


def box(name, x0, x1, y0, y1, z0, z1, mat, coll, parent=None, bevel=0.003, seg=2, grain="X", rot=None):
    """Axis aligned box given by its bounds (in parent space).  Origin at the
    box centre so object-space textures are in metres."""
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    sx, sy, sz = abs(x1 - x0) / 2, abs(y1 - y0) / 2, abs(z1 - z0) / 2
    verts = [((1 if i & 1 else -1) * sx, (1 if i & 2 else -1) * sy, (1 if i & 4 else -1) * sz) for i in range(8)]
    obj = mesh_obj(name, verts, CUBE_FACES, coll, mat, parent, uv_fn=box_uv)
    obj.location = (cx, cy, cz)
    if rot is not None:
        obj.rotation_euler = rot
    if bevel > 0:
        m = obj.modifiers.new("Bevel", "BEVEL")
        m.width = min(bevel, 0.45 * min(sx, sy, sz) * 2)
        m.segments = seg
        m.limit_method = "ANGLE"
    obj["grain"] = GRAIN.get(grain, GRAIN["X"])
    return obj


def cushion(name, x0, x1, y0, y1, z0, z1, mat, coll, parent=None, radius=0.02, rot=None, levels=2):
    """Upholstered / soft rounded box: bevel + subdivision, smooth shaded."""
    obj = box(name, x0, x1, y0, y1, z0, z1, mat, coll, parent, bevel=radius, seg=2, rot=rot)
    obj.data.shade_smooth()
    s = obj.modifiers.new("Subsurf", "SUBSURF")
    s.levels = levels
    s.render_levels = levels
    return obj


def cylinder(name, r, depth, loc, coll, mat=None, parent=None, rot=(0, 0, 0), segs=24, r2=None, smooth=True, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r,
                          radius2=r if r2 is None else r2, depth=depth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat is not None:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    link(obj, coll, parent)
    obj.location = loc
    obj.rotation_euler = rot
    if smooth:
        me.shade_smooth()
        # keep caps crisp
        m = obj.modifiers.new("Bevel", "BEVEL")
        m.width = min(0.002, r * 0.2)
        m.segments = 2
        m.limit_method = "ANGLE"
    return obj


def curve_tube(name, pts, radius, coll, mat=None, parent=None, res=4, smooth=True, extrude=0.0, tilt=0.0, caps=True):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.extrude = extrude
    cu.use_fill_caps = caps
    cu.resolution_u = 8
    if smooth and len(pts) > 2:
        sp = cu.splines.new("NURBS")
        sp.points.add(len(pts) - 1)
        for p, c in zip(sp.points, pts):
            p.co = (c[0], c[1], c[2], 1.0)
            p.tilt = tilt
        sp.order_u = min(4, len(pts))
        sp.use_endpoint_u = True
    else:
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, c in zip(sp.points, pts):
            p.co = (c[0], c[1], c[2], 1.0)
            p.tilt = tilt
    if mat is not None:
        cu.materials.append(mat)
    obj = bpy.data.objects.new(name, cu)
    return link(obj, coll, parent)


def grid_plane(name, w, h, nx, ny, coll, mat=None, parent=None, deform=None):
    """Plane in local XY centred at origin, UV 0..1, normal +Z."""
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            x, y = (u - 0.5) * w, (v - 0.5) * h
            z = deform(u, v) if deform else 0.0
            verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    obj = mesh_obj(name, verts, faces, coll, mat, parent)
    uvl = obj.data.uv_layers.new(name="UVMap")
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            vi = obj.data.loops[li].vertex_index
            co = obj.data.vertices[vi].co
            uvl.data[li].uv = (co.x / w + 0.5, co.y / h + 0.5)
    return obj


def pillow(name, L, Wd, T, coll, mat=None, parent=None, seed=0, dent=0.25):
    """Procedural pillow: puffy top, flattened bottom resting on the bed,
    bulging outline, pinched corners and seam wrinkles."""
    rnd = random.Random(seed)
    nu, nv = 44, 32
    ph = [rnd.uniform(0, 6.28) for _ in range(6)]

    def shape(u, v):
        f = max(0.0, (1 - abs(u) ** 2.4)) ** 0.5 * max(0.0, (1 - abs(v) ** 2.4)) ** 0.5
        return f

    def xy(u, v):
        x = u * L / 2 * (1 + 0.035 * (1 - v * v))
        y = v * Wd / 2 * (1 + 0.05 * (1 - u * u))
        return x, y

    def wr(u, v):
        ang = math.atan2(v * L, u * Wd)
        r = max(abs(u), abs(v))
        return (0.004 * math.sin(11 * ang + ph[0]) + 0.003 * math.sin(23 * ang + ph[1])) * r ** 4

    verts, faces = [], []
    idx = {}
    for side in (1, -1):
        for j in range(nv + 1):
            for i in range(nu + 1):
                u = -1 + 2 * i / nu
                v = -1 + 2 * j / nv
                border = i in (0, nu) or j in (0, nv)
                key = (i, j) if border else (i, j, side)
                if key in idx:
                    continue
                x, y = xy(u, v)
                f = shape(u, v)
                if side > 0:
                    d = dent * T * math.exp(-((u + 0.05) ** 2 / 0.25 + (v - 0.05) ** 2 / 0.3))
                    lump = 0.006 * math.sin(3 * u + ph[2]) * math.sin(2.5 * v + ph[3])
                    z = T * 0.42 + T * 0.58 * f ** 0.7 - d * f + lump * f + wr(u, v)
                else:
                    z = T * 0.42 * (1 - f) ** 1.6 + wr(u, v) * 0.5
                if border:
                    z = T * 0.42 + wr(u, v)
                idx[key] = len(verts)
                verts.append((x, y, z))
    for side in (1, -1):
        for j in range(nv):
            for i in range(nu):
                def g(ii, jj):
                    border = ii in (0, nu) or jj in (0, nv)
                    return idx[(ii, jj)] if border else idx[(ii, jj, side)]
                q = (g(i, j), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1))
                faces.append(q if side > 0 else q[::-1])
    obj = mesh_obj(name, verts, faces, coll, mat, parent, smooth=True,
                   uv_fn=lambda co, n: (co.x / L + 0.5, co.y / Wd + 0.5))
    s = obj.modifiers.new("Subsurf", "SUBSURF")
    s.levels = 1
    s.render_levels = 2
    return obj


def soft_body(name, sx, sy, sz, coll, mat=None, parent=None, round_r=0.05, seed=0, top_arch=0.3,
              bulge=0.02, sag=0.01):
    """Rounded, slightly slumped soft box (backpack body / pocket)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=5, use_grid_fill=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ph = [rnd.uniform(0, 6.28) for _ in range(4)]
    for v in me.vertices:
        x, y, z = v.co
        zn = z / (sz / 2)  # -1..1
        # arch the top
        if zn > 0:
            v.co.x = x * (1 - top_arch * zn ** 2.5)
            v.co.y = y * (1 - 0.35 * top_arch * zn ** 3)
        # front/back belly
        xn = x / (sx / 2)
        v.co.y += math.copysign(1, y) * bulge * (1 - xn * xn) * (1 - zn * zn) if abs(y) > 1e-6 else 0
        # sag + lumps
        v.co.z -= sag * (1 - xn * xn) * (zn > 0.6)
        v.co.y += 0.006 * math.sin(4 * x / sx * 3.1 + ph[0]) * math.sin(3 * zn + ph[1])
        v.co.x += 0.004 * math.sin(5 * zn + ph[2])
    if mat is not None:
        me.materials.append(mat)
    me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    link(obj, coll, parent)
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = round_r
    b.segments = 3
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(50)
    s = obj.modifiers.new("Subsurf", "SUBSURF")
    s.levels = 2
    s.render_levels = 2
    return obj


def open_bin(name, bw0, bd0, bw1, bd1, h, coll, mat=None, parent=None, thick=0.0012):
    """Tapered open-top bin (wastebasket)."""
    verts = [(-bw0 / 2, -bd0 / 2, 0), (bw0 / 2, -bd0 / 2, 0), (bw0 / 2, bd0 / 2, 0), (-bw0 / 2, bd0 / 2, 0),
             (-bw1 / 2, -bd1 / 2, h), (bw1 / 2, -bd1 / 2, h), (bw1 / 2, bd1 / 2, h), (-bw1 / 2, bd1 / 2, h)]
    faces = [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    obj = mesh_obj(name, verts, faces, coll, mat, parent)
    s = obj.modifiers.new("Solidify", "SOLIDIFY")
    s.thickness = thick
    s.offset = -1
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = 0.006
    b.segments = 3
    b.limit_method = "ANGLE"
    return obj
