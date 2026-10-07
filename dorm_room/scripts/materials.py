"""Procedural PBR materials for the dorm room (Cycles).

All surface detail is procedural (noise / voronoi / wave driven colour,
roughness and bump) so the scene is self-contained.  Image textures are only
used for printed content (posters, photos), the plaid weave and the exterior
backplate.
"""
import os

import bpy

TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "textures")


# ----------------------------------------------------------------------------
# node helpers
# ----------------------------------------------------------------------------
class NB:
    """Tiny node-building helper around a material node tree."""

    def __init__(self, mat):
        self.mat = mat
        self.nt = mat.node_tree
        self.nodes = self.nt.nodes
        self.links = self.nt.links
        self.nodes.clear()
        self.x = 0

    def n(self, typ, **props):
        node = self.nodes.new(typ)
        for k, v in props.items():
            if k.startswith("in_"):
                self.set_in(node, k[3:], v)
            else:
                setattr(node, k, v)
        node.location = (self.x, 0)
        self.x -= 220
        return node

    ALIAS = {"Fac": "Factor", "Factor": "Fac"}

    @staticmethod
    def sock(sockets, name, typ=None):
        cands = [s for s in sockets if s.name == name and (typ is None or s.type == typ)]
        if not cands and name in NB.ALIAS:
            alt = NB.ALIAS[name]
            cands = [s for s in sockets if s.name == alt and (typ is None or s.type == typ)]
        en = [s for s in cands if getattr(s, "enabled", True)]
        return (en or cands)[0]

    def set_in(self, node, name, value):
        name = name.replace("__", " ")
        s = self.sock(node.inputs, name)
        s.default_value = value

    def link(self, out_node, out_name, in_node, in_name, out_type=None, in_type=None):
        o = self.sock(out_node.outputs, out_name, out_type) if isinstance(out_name, str) else out_node.outputs[out_name]
        i = self.sock(in_node.inputs, in_name, in_type) if isinstance(in_name, str) else in_node.inputs[in_name]
        self.links.new(o, i)

    def mix_rgb(self, fac, a, b, blend="MIX"):
        m = self.n("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        self._feed(m, "Factor", fac, "VALUE")
        self._feed(m, "A", a, "RGBA")
        self._feed(m, "B", b, "RGBA")
        return (m, "Result", "RGBA")

    def math(self, op, a, b=None, c=None, clamp=False):
        m = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        self._feed(m, 0, a)
        if b is not None:
            self._feed(m, 1, b)
        if c is not None:
            self._feed(m, 2, c)
        return (m, "Value", None)

    def _feed(self, node, name, val, typ=None):
        sock = node.inputs[name] if isinstance(name, int) else self.sock(node.inputs, name, typ)
        if isinstance(val, tuple) and len(val) in (2, 3) and hasattr(val[0], "outputs"):
            on, oname = val[0], val[1]
            otype = val[2] if len(val) == 3 else None
            o = self.sock(on.outputs, oname, otype) if isinstance(oname, str) else on.outputs[oname]
            self.links.new(o, sock)
        else:
            if isinstance(val, (int, float)) and sock.type in ("RGBA",):
                val = (val, val, val, 1.0)
            elif isinstance(val, tuple) and len(val) == 3 and sock.type == "RGBA":
                val = (*val, 1.0)
            sock.default_value = val

    def feed(self, node, name, val, typ=None):
        self._feed(node, name, val, typ)

    def output(self, shader, displacement=None):
        out = self.n("ShaderNodeOutputMaterial")
        self._feed(out, "Surface", shader)
        if displacement is not None:
            self._feed(out, "Displacement", displacement)
        return out

    def principled(self, **kw):
        p = self.n("ShaderNodeBsdfPrincipled")
        for k, v in kw.items():
            self._feed(p, k.replace("_", " "), v)
        return p

    def noise(self, vec, scale, detail=4.0, rough=0.5, dims="3D", distortion=0.0):
        t = self.n("ShaderNodeTexNoise", noise_dimensions=dims)
        if vec is not None:
            self._feed(t, "Vector", vec)
        self._feed(t, "Scale", scale)
        self._feed(t, "Detail", detail)
        self._feed(t, "Roughness", rough)
        self._feed(t, "Distortion", distortion)
        return t

    def ramp(self, fac, stops):
        r = self.n("ShaderNodeValToRGB")
        self._feed(r, "Fac", fac)
        els = r.color_ramp.elements
        while len(els) > len(stops):
            els.remove(els[-1])
        while len(els) < len(stops):
            els.new(0.5)
        for e, (pos, c) in zip(els, stops):
            e.position = pos
            e.color = (*c, 1.0) if len(c) == 3 else c
        return r

    def bump(self, height, strength, distance=0.01, normal=None):
        b = self.n("ShaderNodeBump")
        self._feed(b, "Height", height)
        self._feed(b, "Strength", strength)
        self._feed(b, "Distance", distance)
        if normal is not None:
            self._feed(b, "Normal", normal)
        return b

    def mapping(self, vec, scale=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0)):
        m = self.n("ShaderNodeMapping")
        self._feed(m, "Vector", vec)
        self._feed(m, "Scale", scale)
        self._feed(m, "Location", loc)
        self._feed(m, "Rotation", rot)
        return m

    def ao(self, distance=0.3, samples=8, only_local=False):
        a = self.n("ShaderNodeAmbientOcclusion", samples=samples, only_local=only_local)
        self._feed(a, "Distance", distance)
        return a


def new_mat(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m


def load_img(fname, colorspace="sRGB"):
    path = os.path.join(TEX_DIR, fname)
    img = bpy.data.images.get(fname)
    if img is None:
        img = bpy.data.images.load(path)
    img.colorspace_settings.name = colorspace
    return img


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------
def wood(name, light=(0.20, 0.165, 0.125), dark=(0.105, 0.085, 0.062), rough=0.6,
         ring_scale=11.0, wear=0.15):
    """Stained hardwood / veneer.  Grain runs along local X after rotating the
    object coordinates by the per-object Euler custom property `grain`."""
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    attr = b.n("ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="grain")
    rot = b.n("ShaderNodeVectorRotate", rotation_type="EULER_XYZ")
    b.feed(rot, "Vector", (tc, "Object"))
    b.feed(rot, "Rotation", (attr, "Vector"))
    info = b.n("ShaderNodeObjectInfo")
    off = b.n("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    b.feed(off, 0, (info, "Random"))
    b.feed(off, 1, (13.7, 5.3, 9.1))
    b.feed(off, 2, (rot, "Vector"))
    co = (off, "Vector")
    # stretch distortion along grain
    stretch = b.mapping(co, scale=(0.35, 3.0, 3.0))
    dist = b.noise((stretch, "Vector"), 2.0, 3.0, 0.5)
    pert = b.n("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    b.feed(pert, 0, (dist, "Color"))
    b.feed(pert, 1, (0.0, 0.02, 0.02))
    b.feed(pert, 2, co)
    rings = b.n("ShaderNodeTexWave", wave_type="RINGS", rings_direction="X", wave_profile="SAW")
    b.feed(rings, "Vector", (pert, "Vector"))
    b.feed(rings, "Scale", ring_scale)
    b.feed(rings, "Distortion", 3.0)
    b.feed(rings, "Detail", 2.0)
    b.feed(rings, "Detail Scale", 1.5)
    ringf = b.math("POWER", (rings, "Fac"), 2.2)
    fibers_map = b.mapping(co, scale=(1.5, 90.0, 90.0))
    fibers = b.noise((fibers_map, "Vector"), 1.0, 6.0, 0.6)
    blot = b.noise(co, 3.0, 3.0, 0.5)
    t1 = b.math("MULTIPLY_ADD", ringf, 0.30, b.math("MULTIPLY", (fibers, "Fac"), 1.1))
    t2 = b.math("MULTIPLY_ADD", (blot, "Fac"), 0.35, t1)
    t3 = b.math("SUBTRACT", t2, 0.35)
    col = b.ramp(t3, [(0.0, light), (0.55, tuple((l + d) * 0.5 for l, d in zip(light, dark))), (1.0, dark)])
    # subtle grime in crevices
    ao = b.ao(0.05, 6, True)
    grime = b.mix_rgb(b.math("SUBTRACT", 1.0, (ao, "AO"), clamp=True), (col, "Color"), tuple(c * 0.55 for c in dark), "MIX")
    rnoise = b.noise(co, 9.0, 3.0, 0.6)
    roughv = b.math("MULTIPLY_ADD", (rnoise, "Fac"), wear, rough - wear * 0.5)
    hb = b.math("MULTIPLY_ADD", (fibers, "Fac"), 0.6, ringf)
    bmp = b.bump(hb, 0.06, 0.004)
    p = b.principled(**{"Base Color": grime, "Roughness": roughv, "Normal": (bmp, "Normal"),
                        "Specular IOR Level": 0.45, "Coat Weight": 0.08, "Coat Roughness": 0.35})
    b.output((p, "BSDF"))
    return m


def wall_paint(name, color=(0.49, 0.47, 0.385), rough=0.85, grime_strength=0.45, scale_bump=1.3):
    """Eggshell latex over drywall: low-frequency mottling, orange-peel bump,
    AO-driven grime near corners and floor."""
    m = new_mat(name)
    b = NB(m)
    geo = b.n("ShaderNodeNewGeometry")
    pos = (geo, "Position")
    mott = b.noise(pos, 0.9, 4.0, 0.55)
    mott2 = b.noise(pos, 6.0, 3.0, 0.5)
    c1 = b.mix_rgb(b.math("MULTIPLY", (mott, "Fac"), 1.0), tuple(c * 0.90 for c in color), tuple(min(1, c * 1.06) for c in color))
    c2 = b.mix_rgb(b.math("MULTIPLY", (mott2, "Fac"), 0.25), c1, tuple(c * 0.85 for c in color))
    ao = b.ao(0.35, 8, False)
    inv = b.math("SUBTRACT", 1.0, (ao, "AO"), clamp=True)
    # height based dirt (scuffs near floor)
    sep = b.n("ShaderNodeSeparateXYZ")
    b.feed(sep, "Vector", pos)
    low = b.math("SUBTRACT", 1.0, b.math("MULTIPLY", (sep, "Z"), 2.2), clamp=True)
    dn = b.noise(pos, 3.5, 5.0, 0.6)
    dirt = b.math("MULTIPLY", b.math("ADD", b.math("MULTIPLY", inv, grime_strength), b.math("MULTIPLY", low, 0.12)), b.math("ADD", (dn, "Fac"), 0.4))
    c3a = b.mix_rgb(b.math("MINIMUM", dirt, 0.6), c2, tuple(c * 0.55 for c in color))
    grain = b.noise(pos, 140.0, 3.0, 0.7)
    c3 = b.mix_rgb(b.math("MULTIPLY_ADD", (grain, "Fac"), 0.8, -0.2), c3a, tuple(c * 0.74 for c in color))
    peel = b.noise(pos, 280.0, 2.0, 0.5)
    lumpy = b.noise(pos, 5.0, 4.0, 0.6)
    h = b.math("MULTIPLY_ADD", (lumpy, "Fac"), 3.0, (peel, "Fac"))
    bmp = b.bump(h, 0.12 * scale_bump, 0.002)
    rv = b.math("MULTIPLY_ADD", (mott2, "Fac"), 0.1, rough - 0.05)
    p = b.principled(**{"Base Color": c3, "Roughness": rv, "Normal": (bmp, "Normal"), "Specular IOR Level": 0.35})
    b.output((p, "BSDF"))
    return m


def ceiling_tex(name, color=(0.56, 0.545, 0.50), bump=0.35):
    """Sprayed acoustic / knockdown ceiling."""
    m = new_mat(name)
    b = NB(m)
    geo = b.n("ShaderNodeNewGeometry")
    pos = (geo, "Position")
    vor = b.n("ShaderNodeTexVoronoi", feature="F1")
    b.feed(vor, "Vector", pos)
    b.feed(vor, "Scale", 140.0)
    b.feed(vor, "Randomness", 1.0)
    n = b.noise(pos, 60.0, 5.0, 0.65)
    n2 = b.noise(pos, 1.2, 3.0, 0.5)
    h = b.math("MULTIPLY_ADD", (vor, "Distance"), -0.6, (n, "Fac"))
    c0 = b.mix_rgb(b.math("MULTIPLY", (n2, "Fac"), 0.7), tuple(x * 0.88 for x in color), color)
    c = b.mix_rgb(b.math("MULTIPLY", (n, "Fac"), 0.5), c0, tuple(x * 0.8 for x in color))
    ao = b.ao(0.4, 6, False)
    inv = b.math("SUBTRACT", 1.0, (ao, "AO"), clamp=True)
    c2 = b.mix_rgb(b.math("MULTIPLY", inv, 0.4), c, tuple(x * 0.6 for x in color))
    bmp = b.bump(h, bump, 0.004)
    p = b.principled(**{"Base Color": c2, "Roughness": 0.92, "Normal": (bmp, "Normal"), "Specular IOR Level": 0.2})
    b.output((p, "BSDF"))
    return m


def carpet(name, dark=(0.044, 0.047, 0.053), mid=(0.128, 0.132, 0.141), fleck=(0.30, 0.305, 0.315)):
    """Commercial loop-pile carpet: tufted rows, multi-tone flecks (cm scale so
    they survive at viewing distance), wear/traffic mottling, strong pile bump."""
    m = new_mat(name)
    b = NB(m)
    geo = b.n("ShaderNodeNewGeometry")
    pos = (geo, "Position")
    rows_map = b.mapping(pos, scale=(1.0, 0.15, 1.0))
    rowd = b.noise((rows_map, "Vector"), 4.0, 2.0, 0.5)
    rowv = b.n("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    b.feed(rowv, 0, (rowd, "Color"))
    b.feed(rowv, 1, (0.006, 0.0, 0.0))
    b.feed(rowv, 2, pos)
    rows = b.n("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
    b.feed(rows, "Vector", (rowv, "Vector"))
    b.feed(rows, "Scale", 22.0)
    b.feed(rows, "Distortion", 2.0)
    b.feed(rows, "Detail", 3.0)
    # tuft clusters: elongated along rows
    tuft_map = b.mapping(pos, scale=(1.0, 0.45, 1.0))
    tuft = b.noise((tuft_map, "Vector"), 26.0, 6.0, 0.75)
    tuft_c = b.ramp((tuft, "Fac"), [(0.32, dark), (0.50, mid), (0.66, tuple(x * 1.9 for x in mid))])
    fl = b.noise(pos, 22.0, 3.0, 0.5)
    flk = b.math("POWER", b.math("MULTIPLY", (fl, "Fac"), 1.25, clamp=True), 7.0)
    c1 = b.mix_rgb(b.math("MULTIPLY", flk, 2.5, clamp=True), (tuft_c, "Color"), fleck)
    rowbreak = b.noise(pos, 6.0, 2.0, 0.5)
    c2 = b.mix_rgb(b.math("MULTIPLY", (rows, "Fac"), b.math("MULTIPLY", (rowbreak, "Fac"), 0.32)), c1, dark)
    big = b.noise(pos, 1.3, 4.0, 0.6)
    c3 = b.mix_rgb(b.math("MULTIPLY_ADD", (big, "Fac"), 0.6, -0.15), c2, tuple(x * 1.35 for x in mid))
    loops = b.n("ShaderNodeTexVoronoi", feature="F1")
    b.feed(loops, "Vector", pos)
    b.feed(loops, "Scale", 300.0)
    h1 = b.math("MULTIPLY_ADD", (tuft, "Fac"), 1.5, b.math("MULTIPLY", (rows, "Fac"), 0.4))
    h2 = b.math("MULTIPLY_ADD", (loops, "Distance"), -0.5, h1)
    bmp = b.bump(h2, 0.9, 0.006)
    rv = b.math("MULTIPLY_ADD", (tuft, "Fac"), 0.1, 0.85)
    p = b.principled(**{"Base Color": c3, "Roughness": rv, "Normal": (bmp, "Normal"),
                        "Specular IOR Level": 0.25, "Sheen Weight": 0.12, "Sheen Roughness": 0.5,
                        "Sheen Tint": (0.35, 0.38, 0.45, 1.0)})
    b.output((p, "BSDF"))
    return m


def fabric_image(name, image, uv_scale=1.0, sheen=0.7, rough=0.85, bump=0.25, tint=(1, 1, 1)):
    """Woven / brushed fabric with an image texture (plaid)."""
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    mp = b.mapping((tc, "UV"), scale=(uv_scale, uv_scale, uv_scale))
    it = b.n("ShaderNodeTexImage", image=load_img(image), interpolation="Cubic")
    b.feed(it, "Vector", (mp, "Vector"))
    fuzz = b.noise((mp, "Vector"), 120.0, 4.0, 0.6)
    lump = b.noise((tc, "Object"), 8.0, 3.0, 0.5)
    h = b.math("MULTIPLY_ADD", (fuzz, "Fac"), 0.8, b.math("MULTIPLY", (lump, "Fac"), 0.6))
    tinted = b.mix_rgb(1.0, (it, "Color"), tint, "MULTIPLY")
    c = b.mix_rgb(b.math("MULTIPLY", (lump, "Fac"), 0.25), tinted, (0.02, 0.02, 0.02), "MIX")
    bmp = b.bump(h, bump, 0.002)
    p = b.principled(**{"Base Color": c, "Roughness": rough, "Normal": (bmp, "Normal"),
                        "Sheen Weight": sheen, "Sheen Roughness": 0.35, "Specular IOR Level": 0.25})
    b.output((p, "BSDF"))
    return m


def fabric_plain(name, color, rough=0.8, sheen=0.5, weave_scale=700.0, bump=0.2, coord="Object", spec=0.3):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    v = (tc, coord)
    n = b.noise(v, 9.0, 4.0, 0.55)
    nf = b.noise(v, 150.0, 3.0, 0.6)
    c = b.mix_rgb(b.math("MULTIPLY_ADD", (n, "Fac"), 0.6, -0.15), color, tuple(x * 0.7 for x in color))
    # micro-structure from band-limited noise only: wave-based weave at sub-mm
    # scale aliases into moire rings at viewing distance
    nmicro = b.noise(v, 320.0, 2.0, 0.5)
    h = b.math("MULTIPLY_ADD", (nmicro, "Fac"), 0.5, (nf, "Fac"))
    bmp = b.bump(h, bump, 0.002)
    p = b.principled(**{"Base Color": c, "Roughness": rough, "Normal": (bmp, "Normal"),
                        "Sheen Weight": sheen, "Sheen Roughness": 0.4, "Specular IOR Level": spec})
    b.output((p, "BSDF"))
    return m


def painted_metal(name, color, rough=0.4, metallic=0.0, grime=0.25, bump=0.03, spec=0.5):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    v = (tc, "Object")
    n = b.noise(v, 6.0, 4.0, 0.6)
    n2 = b.noise(v, 60.0, 3.0, 0.5)
    ao = b.ao(0.08, 6, True)
    inv = b.math("SUBTRACT", 1.0, (ao, "AO"), clamp=True)
    c = b.mix_rgb(b.math("MULTIPLY", b.math("ADD", inv, b.math("MULTIPLY", (n, "Fac"), 0.3)), grime), color, tuple(x * 0.55 for x in color))
    rv = b.math("MULTIPLY_ADD", (n, "Fac"), 0.15, rough - 0.07)
    bmp = b.bump((n2, "Fac"), bump, 0.002)
    p = b.principled(**{"Base Color": c, "Roughness": rv, "Metallic": metallic, "Normal": (bmp, "Normal"), "Specular IOR Level": spec})
    b.output((p, "BSDF"))
    return m


def brushed_metal(name, color=(0.62, 0.62, 0.6), rough=0.28):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    mp = b.mapping((tc, "Object"), scale=(400.0, 4.0, 4.0))
    n = b.noise((mp, "Vector"), 1.0, 4.0, 0.6)
    n2 = b.noise((tc, "Object"), 20.0, 3.0, 0.5)
    rv = b.math("MULTIPLY_ADD", (n, "Fac"), 0.12, rough - 0.06)
    rv2 = b.math("MULTIPLY_ADD", (n2, "Fac"), 0.1, rv)
    bmp = b.bump((n, "Fac"), 0.05, 0.001)
    p = b.principled(**{"Base Color": color, "Metallic": 1.0, "Roughness": rv2, "Normal": (bmp, "Normal")})
    b.output((p, "BSDF"))
    return m


def plastic(name, color, rough=0.45, spec=0.5, bump=0.02):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    n = b.noise((tc, "Object"), 40.0, 3.0, 0.5)
    n2 = b.noise((tc, "Object"), 4.0, 3.0, 0.5)
    c = b.mix_rgb(b.math("MULTIPLY", (n2, "Fac"), 0.2), color, tuple(x * 0.8 for x in color))
    bmp = b.bump((n, "Fac"), bump, 0.002)
    p = b.principled(**{"Base Color": c, "Roughness": rough, "Normal": (bmp, "Normal"), "Specular IOR Level": spec})
    b.output((p, "BSDF"))
    return m


def rubber(name, color, rough=0.55):
    return plastic(name, color, rough, 0.35, 0.03)


def glass(name, reflect=0.9):
    """Window glass that lets light rays through (no caustic dependency) while
    keeping fresnel reflections for camera rays."""
    m = new_mat(name)
    b = NB(m)
    lp = b.n("ShaderNodeLightPath")
    tr = b.n("ShaderNodeBsdfTransparent")
    b.feed(tr, "Color", (0.92, 0.94, 0.93, 1.0))
    gl = b.n("ShaderNodeBsdfGlossy")
    b.feed(gl, "Roughness", 0.02)
    b.feed(gl, "Color", (1, 1, 1, 1))
    fr = b.n("ShaderNodeFresnel")
    b.feed(fr, "IOR", 1.52)
    f2 = b.math("MULTIPLY", (fr, "Fac"), reflect)
    mix = b.n("ShaderNodeMixShader")
    b.feed(mix, "Fac", f2)
    b.feed(mix, 1, (tr, "BSDF"))
    b.feed(mix, 2, (gl, "BSDF"))
    shadow = b.math("MAXIMUM", (lp, "Is Shadow Ray"), (lp, "Is Diffuse Ray"))
    mix2 = b.n("ShaderNodeMixShader")
    b.feed(mix2, "Fac", shadow)
    b.feed(mix2, 1, (mix, "Shader"))
    b.feed(mix2, 2, (tr, "BSDF"))
    b.output((mix2, "Shader"))
    return m


def paper_image(name, image, rough=0.45, back_color=(0.75, 0.74, 0.7)):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    it = b.n("ShaderNodeTexImage", image=load_img(image), interpolation="Cubic")
    b.feed(it, "Vector", (tc, "UV"))
    geo = b.n("ShaderNodeNewGeometry")
    c = b.mix_rgb((geo, "Backfacing"), (it, "Color"), back_color)
    n = b.noise((tc, "Object"), 30.0, 4.0, 0.6)
    n2 = b.noise((tc, "Object"), 3.0, 2.0, 0.5)
    rv = b.math("MULTIPLY_ADD", (n2, "Fac"), 0.2, rough - 0.1)
    bmp = b.bump((n, "Fac"), 0.05, 0.002)
    p = b.principled(**{"Base Color": c, "Roughness": rv, "Normal": (bmp, "Normal"), "Specular IOR Level": 0.4})
    b.output((p, "BSDF"))
    return m


def emission(name, color, strength, camera_only=False):
    m = new_mat(name)
    b = NB(m)
    e = b.n("ShaderNodeEmission")
    b.feed(e, "Color", (*color, 1.0))
    b.feed(e, "Strength", strength)
    if camera_only:
        lp = b.n("ShaderNodeLightPath")
        tr = b.n("ShaderNodeBsdfDiffuse")
        b.feed(tr, "Color", (0.8, 0.8, 0.8, 1.0))
        mix = b.n("ShaderNodeMixShader")
        b.feed(mix, "Fac", (lp, "Is Camera Ray"))
        b.feed(mix, 1, (tr, "BSDF"))
        b.feed(mix, 2, (e, "Emission"))
        b.output((mix, "Shader"))
    else:
        b.output((e, "Emission"))
    return m


def fixture_lens(name, strength=6.0, color=(1.0, 0.96, 0.9)):
    """Prismatic acrylic diffuser: glowing, with prism-pattern variation."""
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    mp = b.mapping((tc, "Object"), scale=(60.0, 60.0, 60.0))
    vor = b.n("ShaderNodeTexVoronoi", feature="F1", distance="CHEBYCHEV")
    b.feed(vor, "Vector", (mp, "Vector"))
    b.feed(vor, "Scale", 1.0)
    b.feed(vor, "Randomness", 0.0)
    grad = b.n("ShaderNodeTexGradient", gradient_type="SPHERICAL")
    gmp = b.mapping((tc, "Object"), scale=(1.6, 4.0, 1.0))
    b.feed(grad, "Vector", (gmp, "Vector"))
    s = b.math("MULTIPLY_ADD", (vor, "Distance"), 0.35, 0.8)
    s2 = b.math("MULTIPLY", s, b.math("MULTIPLY_ADD", (grad, "Fac"), 0.5, 0.6))
    e = b.n("ShaderNodeEmission")
    b.feed(e, "Color", (*color, 1.0))
    b.feed(e, "Strength", b.math("MULTIPLY", s2, strength))
    tl = b.n("ShaderNodeBsdfTranslucent")
    b.feed(tl, "Color", (0.9, 0.9, 0.9, 1.0))
    add = b.n("ShaderNodeAddShader")
    b.feed(add, 0, (e, "Emission"))
    b.feed(add, 1, (tl, "BSDF"))
    b.output((add, "Shader"))
    return m


def blind_slat(name, color=(0.72, 0.715, 0.69), translucency=0.55):
    """Vinyl blind slat: satin, slightly translucent so it glows when backlit."""
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    n = b.noise((tc, "Object"), 25.0, 3.0, 0.5)
    c = b.mix_rgb(b.math("MULTIPLY", (n, "Fac"), 0.3), color, tuple(x * 0.82 for x in color))
    p = b.principled(**{"Base Color": c, "Roughness": 0.38, "Specular IOR Level": 0.5})
    tl = b.n("ShaderNodeBsdfTranslucent")
    b.feed(tl, "Color", (0.95, 0.93, 0.88, 1.0))
    mix = b.n("ShaderNodeMixShader")
    b.feed(mix, "Fac", translucency)
    b.feed(mix, 1, (p, "BSDF"))
    b.feed(mix, 2, (tl, "BSDF"))
    b.output((mix, "Shader"))
    return m


def backdrop(name, image, strength=1.0):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    it = b.n("ShaderNodeTexImage", image=load_img(image), interpolation="Cubic")
    b.feed(it, "Vector", (tc, "UV"))
    e = b.n("ShaderNodeEmission")
    b.feed(e, "Color", (it, "Color"))
    b.feed(e, "Strength", strength)
    b.output((e, "Emission"))
    return m


def book_cloth(name, color):
    return fabric_plain(name, color, rough=0.7, sheen=0.2, weave_scale=900.0, bump=0.1)


def paper_block(name, color=(0.62, 0.58, 0.5)):
    m = new_mat(name)
    b = NB(m)
    tc = b.n("ShaderNodeTexCoord")
    w = b.n("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z")
    b.feed(w, "Vector", (tc, "Object"))
    b.feed(w, "Scale", 1500.0)
    b.feed(w, "Distortion", 2.0)
    c = b.mix_rgb(b.math("MULTIPLY", (w, "Fac"), 0.2), color, tuple(x * 0.8 for x in color))
    bmp = b.bump((w, "Fac"), 0.2, 0.001)
    p = b.principled(**{"Base Color": c, "Roughness": 0.8, "Normal": (bmp, "Normal")})
    b.output((p, "BSDF"))
    return m
