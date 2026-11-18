"""
Genera el kit de edificios urbanos por bioma para Ballitas (60 modelos GLB: 10 biomas x 6 tipos).

Uso, desde front/:
    "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b -P tools/blender/generar_ciudad.py
    (opcional: ... -- sombrio_casa neon_rascacielos   para generar solo algunos)

Convención:
- Un solo mesh por GLB, +Y arriba al exportar (export_yup=True).
- Origen en la base (y=0), centrado en XZ, altura normalizada a 1.0 y planta <= 1.05.
- Color por vértice (atributo Col), UVs limpias en fachadas (techos en esquina sin ventanas).
- Formas suaves (biseles y perfiles curvos, normales suavizadas por ángulo), <= 800 triángulos.
- Salida: public/models/ciudad/<bioma>_<tipo>.glb, _stats.json y MANIFIESTO.md.
"""
import bpy
import bmesh
import math
import os
import sys
import json
import random
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models", "ciudad")
MAX_TRIS = 800

TYPES = ("casa", "torre", "rascacielos", "comercio", "estacion", "parque")


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def lin(c):
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def mixc(c0, c1, t):
    return tuple(c0[i] + (c1[i] - c0[i]) * t for i in range(4))


# Paletas claras y contrastadas por bioma (se multiplican luego por el tinte de instancia,
# así que deben mantenerse luminosas para no oscurecer la ciudad).
PALETTES = {
    "sombrio": {
        "wall": "#c9c0e6", "wall2": "#a89bd1", "trim": "#e6dcf7", "roof": "#7a6aa6",
        "accent": "#d9b8ff", "park_ground": "#6e948c", "park_foliage": "#947ad1", "park_water": "#c7a3ff",
        "style": "spire",
    },
    "bosque": {
        "wall": "#e8d6be", "wall2": "#cfb38f", "trim": "#f5ebd8", "roof": "#94ba77",
        "accent": "#ffe08a", "park_ground": "#84bf78", "park_foliage": "#5ea85b", "park_water": "#9ce6d8",
        "style": "gable",
    },
    "mar": {
        "wall": "#f5f8fc", "wall2": "#d7e7f5", "trim": "#ffffff", "roof": "#6ec3e8",
        "accent": "#9cf7ff", "park_ground": "#8ed4c4", "park_foliage": "#6bc4a6", "park_water": "#7ce8ff",
        "style": "dome",
    },
    "desierto": {
        "wall": "#f7e4c6", "wall2": "#e3c394", "trim": "#fff3db", "roof": "#cf8d51",
        "accent": "#ffd175", "park_ground": "#d4bd85", "park_foliage": "#78b36b", "park_water": "#6de0d8",
        "style": "stepped",
    },
    "hielo": {
        "wall": "#e8f6ff", "wall2": "#c4e4fa", "trim": "#ffffff", "roof": "#85ccf2",
        "accent": "#b5f2ff", "park_ground": "#cdeeff", "park_foliage": "#8cc7eb", "park_water": "#a6f0ff",
        "style": "spire",
    },
    "volcan": {
        "wall": "#b8968f", "wall2": "#91706b", "trim": "#d9b6ad", "roof": "#6e524f",
        "accent": "#ff8f52", "park_ground": "#8c6962", "park_foliage": "#d97a4e", "park_water": "#ff9d47",
        "style": "stepped",
    },
    "cristal": {
        "wall": "#e3e8ff", "wall2": "#c6d0fa", "trim": "#f5f8ff", "roof": "#9ee3ff",
        "accent": "#d6b8ff", "park_ground": "#b3cbe8", "park_foliage": "#95e8dc", "park_water": "#b8f4ff",
        "style": "prism",
    },
    "nubes": {
        "wall": "#f7faff", "wall2": "#dceafa", "trim": "#ffffff", "roof": "#a8ccf5",
        "accent": "#ffeba8", "park_ground": "#d9ebff", "park_foliage": "#ffffff", "park_water": "#bfe6ff",
        "style": "dome",
    },
    "neon": {
        "wall": "#cad8ff", "wall2": "#9eb2eb", "trim": "#edf2ff", "roof": "#788fd4",
        "accent": "#66fff0", "park_ground": "#85a6cc", "park_foliage": "#6ee8d6", "park_water": "#ff8ae2",
        "style": "flat",
    },
    "jardin": {
        "wall": "#faf0e6", "wall2": "#f2d8e4", "trim": "#ffffff", "roof": "#a3d99c",
        "accent": "#ffb3d9", "park_ground": "#9ad694", "park_foliage": "#ff9ec7", "park_water": "#a6f2ff",
        "style": "gable",
    },
}


class CityMesh:
    """Constructor bmesh Z-arriba con color por vértice, UVs y suavizado."""

    def __init__(self, is_park=False):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.is_park = is_park

    def paint(self, faces, color, grad_top=None, z0=0.0, z1=1.0):
        c0 = lin(hexc(color) if isinstance(color, str) else color)
        c1 = lin(hexc(grad_top) if isinstance(grad_top, str) else grad_top) if grad_top else None
        span = max(1e-5, z1 - z0)
        for f in faces:
            if not f.is_valid:
                continue
            for l in f.loops:
                if c1:
                    t = max(0.0, min(1.0, (l.vert.co.z - z0) / span))
                    l[self.col] = mixc(c0, c1, t)
                else:
                    l[self.col] = c0

    def bevel_box(self, center, size, color, grad_top=None, rot=0.0, bevel=0.035, segs=1):
        """Caja biselada suave centrada en center=(x,y,z), tamaño size=(sx,sy,sz)."""
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        vs = res["verts"]
        fs = list({f for v in vs for f in v.link_faces})
        es = list({e for v in vs for e in v.link_edges})
        sx, sy, sz = size
        for v in vs:
            v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
        if bevel > 0.002 and min(sx, sy, sz) > bevel * 2.5:
            b = bmesh.ops.bevel(
                self.bm,
                geom=es,
                offset=bevel,
                offset_type="OFFSET",
                segments=segs,
                profile=0.5,
                affect="EDGES",
            )
            fs = list({f for f in fs if f.is_valid} | set(b.get("faces", [])))
            vs = list({v for f in fs for v in f.verts})
        ca, sa = math.cos(rot), math.sin(rot)
        for v in vs:
            x, y = v.co.x, v.co.y
            v.co.x = x * ca - y * sa + center[0]
            v.co.y = x * sa + y * ca + center[1]
            v.co.z += center[2]
        z0 = center[2] - sz * 0.5
        z1 = center[2] + sz * 0.5
        self.paint(fs, color, grad_top, z0, z1)
        return fs

    def lathe(self, prof, seg=12, color=None, grad_top=None, cap_top=True, cap_bot=True, offset=(0, 0, 0), rot=0.0):
        """Perfil [(radio, z)] de abajo a arriba."""
        ox, oy, oz = offset
        rings = []
        for r, z in prof:
            ring = []
            for i in range(seg):
                a = rot + 2.0 * math.pi * i / seg
                ring.append(self.bm.verts.new((ox + math.cos(a) * r, oy + math.sin(a) * r, oz + z)))
            rings.append(ring)
        faces = []
        for a, b in zip(rings, rings[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                try:
                    faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
                except ValueError:
                    pass
        if cap_bot and prof[0][0] > 0.002:
            faces.append(self.bm.faces.new(rings[0][::-1]))
        if cap_top and prof[-1][0] > 0.002:
            faces.append(self.bm.faces.new(rings[-1]))
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        faces = [f for f in faces if f.is_valid]
        z0 = oz + prof[0][1]
        z1 = oz + prof[-1][1]
        if color:
            self.paint(faces, color, grad_top, z0, z1)
        return faces

    def dome(self, center, rx, ry, rz, color, grad_top=None, seg=12, rings=5):
        """Media esfera suave (cúpula / copa orgánica) con base en center.z."""
        prof = []
        for k in range(rings + 1):
            t = (k / rings) * (math.PI / 2 if hasattr(math, "PI") else math.pi / 2)
            prof.append((math.cos(t), math.sin(t) * rz))
        prof[-1] = (0.0, rz)
        # Escala elíptica en XY
        ox, oy, oz = center
        ring_verts = []
        for r, z in prof:
            ring = []
            for i in range(seg):
                a = 2.0 * math.pi * i / seg
                ring.append(self.bm.verts.new((ox + math.cos(a) * r * rx, oy + math.sin(a) * r * ry, oz + z)))
            ring_verts.append(ring)
        faces = []
        for a, b in zip(ring_verts, ring_verts[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                try:
                    faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
                except ValueError:
                    pass
        faces.append(self.bm.faces.new(ring_verts[0][::-1]))
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        faces = [f for f in faces if f.is_valid]
        self.paint(faces, color, grad_top, oz, oz + rz)
        return faces

    def sphere(self, center, rx, ry, rz, color, grad_top=None, seg=10, rings=6):
        rs = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)
        vs = rs["verts"]
        for v in vs:
            v.co = Vector((v.co.x * rx + center[0], v.co.y * ry + center[1], v.co.z * rz + center[2]))
        fs = list({f for v in vs for f in v.link_faces})
        self.paint(fs, color, grad_top, center[2] - rz, center[2] + rz)
        return fs

    def gable_roof(self, center, sx, sy, sz, color, grad_top=None, rot=0.0):
        """Techo a dos aguas con alero limpio."""
        hx, hy = sx * 0.5, sy * 0.5
        oz = center[2]
        pts = [
            (-hx, -hy, oz), (hx, -hy, oz), (hx, hy, oz), (-hx, hy, oz),
            (-hx * 0.85, 0.0, oz + sz), (hx * 0.85, 0.0, oz + sz),
        ]
        ca, sa = math.cos(rot), math.sin(rot)
        vs = [
            self.bm.verts.new((x * ca - y * sa + center[0], x * sa + y * ca + center[1], z))
            for (x, y, z) in pts
        ]
        fs = [
            self.bm.faces.new((vs[0], vs[3], vs[2], vs[1])),
            self.bm.faces.new((vs[0], vs[1], vs[5], vs[4])),
            self.bm.faces.new((vs[2], vs[3], vs[4], vs[5])),
            self.bm.faces.new((vs[3], vs[0], vs[4])),
            self.bm.faces.new((vs[1], vs[2], vs[5])),
        ]
        self.paint(fs, color, grad_top, oz, oz + sz)
        return fs

    def arch(self, center, radius, thickness, depth, color, seg=8, rot=0.0):
        """Arco semicircular suave para estaciones y comercios."""
        ca, sa = math.cos(rot), math.sin(rot)
        r_in = max(0.05, radius - thickness)
        r_out = radius
        hy = depth * 0.5
        rings = []
        for i in range(seg + 1):
            a = math.pi * i / seg
            pts_sec = [
                (math.cos(a) * r_in, -hy, math.sin(a) * r_in),
                (math.cos(a) * r_out, -hy, math.sin(a) * r_out),
                (math.cos(a) * r_out, hy, math.sin(a) * r_out),
                (math.cos(a) * r_in, hy, math.sin(a) * r_in),
            ]
            ring = [
                self.bm.verts.new((
                    x * ca - y * sa + center[0],
                    x * sa + y * ca + center[1],
                    z + center[2],
                ))
                for (x, y, z) in pts_sec
            ]
            rings.append(ring)
        fs = []
        for r0, r1 in zip(rings, rings[1:]):
            for k in range(4):
                kn = (k + 1) % 4
                fs.append(self.bm.faces.new((r0[k], r0[kn], r1[kn], r1[k])))
        fs.append(self.bm.faces.new(rings[0][::-1]))
        fs.append(self.bm.faces.new(rings[-1]))
        self.paint(fs, color)
        return fs

    def finish(self, name):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        # Asignar UVs limpias: fachadas verticales reciben mapa de ventanas, techos/parques esquina neutra
        for f in self.bm.faces:
            is_wall = (not self.is_park) and abs(f.normal.z) < 0.72
            for l in f.loops:
                if is_wall:
                    co = l.vert.co
                    l[self.uv].uv = ((co.x + co.y) * 1.15 + 0.5, co.z * 1.75)
                else:
                    l[self.uv].uv = (0.005, 0.005)
        # Suavizado por ángulo: mantiene las caras planas limpias y suaviza cúpulas/biseles/cilindros
        for f in self.bm.faces:
            f.smooth = True
        sharp = [e for e in self.bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(52)]
        if sharp:
            bmesh.ops.split_edges(self.bm, edges=sharp)
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])

        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()

        # Normalizar: centrado en XY, base z=0, altura z=1.0
        zs = [v.co.z for v in me.vertices]
        xs = [v.co.x for v in me.vertices]
        ys = [v.co.y for v in me.vertices]
        cx = (max(xs) + min(xs)) * 0.5
        cy = (max(ys) + min(ys)) * 0.5
        minz = min(zs)
        h = max(1e-5, max(zs) - minz)
        w = max(1e-5, max(xs) - min(xs), max(ys) - min(ys))
        sc_z = 1.0 / h
        sc_xy = min(sc_z, 1.02 / w)
        for v in me.vertices:
            v.co.x = (v.co.x - cx) * sc_xy
            v.co.y = (v.co.y - cy) * sc_xy
            v.co.z = (v.co.z - minz) * sc_z
        me.update()

        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new("mat_" + name)
        mat.use_nodes = True
        bs = mat.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Roughness"].default_value = 0.68
        vc = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mat.node_tree.links.new(vc.outputs["Color"], bs.inputs["Base Color"])
        me.materials.append(mat)
        return ob


# ─────────────────────────── Constructores de los 6 tipos por bioma ───────────────────────────

def build_casa(pal):
    m = CityMesh()
    st = pal["style"]
    w, w2, tr, rf, ac = pal["wall"], pal["wall2"], pal["trim"], pal["roof"], pal["accent"]
    m.bevel_box((0, 0, 0.06), (0.92, 0.86, 0.12), w2, w, bevel=0.025)
    if st == "dome":
        m.lathe([(0.42, 0.10), (0.43, 0.54), (0.45, 0.58)], seg=14, color=w2, grad_top=w)
        m.dome((0, 0, 0.58), 0.42, 0.42, 0.34, rf, ac, seg=14, rings=5)
        m.bevel_box((0.28, 0.0, 0.30), (0.28, 0.34, 0.36), tr, bevel=0.02)
    elif st == "stepped":
        m.bevel_box((0, 0, 0.30), (0.86, 0.80, 0.42), w2, w, bevel=0.04)
        m.bevel_box((0, 0, 0.62), (0.62, 0.58, 0.26), w, tr, bevel=0.035)
        m.bevel_box((0, 0, 0.82), (0.36, 0.36, 0.16), rf, ac, bevel=0.025)
    elif st == "prism":
        m.lathe([(0.44, 0.10), (0.42, 0.56)], seg=6, color=w2, grad_top=w)
        m.lathe([(0.46, 0.56), (0.24, 0.84), (0.0, 1.0)], seg=6, color=rf, grad_top=ac, cap_bot=True)
    elif st == "spire":
        m.bevel_box((0, 0, 0.32), (0.78, 0.74, 0.46), w2, w, bevel=0.035)
        m.lathe([(0.54, 0.55), (0.22, 0.82), (0.0, 1.0)], seg=4, color=rf, grad_top=ac, rot=math.pi / 4)
        m.bevel_box((0.30, 0.0, 0.26), (0.22, 0.28, 0.28), tr, bevel=0.02)
    elif st == "flat":
        m.bevel_box((0, 0, 0.34), (0.82, 0.76, 0.50), w2, w, bevel=0.04)
        m.bevel_box((0, 0, 0.64), (0.86, 0.80, 0.07), ac, bevel=0.02)
        m.bevel_box((-0.10, 0.06, 0.78), (0.42, 0.38, 0.22), w, tr, bevel=0.025)
    else:  # gable
        m.bevel_box((0, 0, 0.32), (0.80, 0.72, 0.46), w2, w, bevel=0.035)
        m.gable_roof((0, 0, 0.54), 0.90, 0.82, 0.38, rf, ac)
        m.bevel_box((0.26, -0.22, 0.72), (0.14, 0.14, 0.24), tr, bevel=0.015)
    return m


def build_torre(pal):
    m = CityMesh()
    st = pal["style"]
    w, w2, tr, rf, ac = pal["wall"], pal["wall2"], pal["trim"], pal["roof"], pal["accent"]
    m.bevel_box((0, 0, 0.08), (0.84, 0.84, 0.16), w2, w, bevel=0.03)
    if st == "spire":
        m.lathe([(0.34, 0.14), (0.31, 0.45), (0.28, 0.68), (0.33, 0.72)], seg=8, color=w2, grad_top=w)
        m.lathe([(0.32, 0.72), (0.14, 0.88), (0.0, 1.0)], seg=8, color=rf, grad_top=ac)
    elif st == "dome":
        m.lathe([(0.36, 0.14), (0.32, 0.48), (0.28, 0.68), (0.35, 0.74), (0.30, 0.78)], seg=14, color=w2, grad_top=tr)
        m.dome((0, 0, 0.78), 0.29, 0.29, 0.22, rf, ac, seg=14, rings=5)
    elif st == "stepped":
        m.lathe([(0.40, 0.14), (0.38, 0.44)], seg=6, color=w2, grad_top=w)
        m.lathe([(0.32, 0.44), (0.30, 0.72)], seg=6, color=w, grad_top=tr)
        m.lathe([(0.22, 0.72), (0.18, 0.90), (0.0, 1.0)], seg=6, color=rf, grad_top=ac)
    elif st == "prism":
        m.lathe([(0.34, 0.14), (0.28, 0.70)], seg=5, color=w2, grad_top=w)
        m.lathe([(0.31, 0.70), (0.12, 0.90), (0.0, 1.0)], seg=5, color=rf, grad_top=ac)
    elif st == "flat":
        m.lathe([(0.34, 0.14), (0.34, 0.76)], seg=12, color=w2, grad_top=w)
        m.lathe([(0.39, 0.76), (0.39, 0.82), (0.26, 0.84)], seg=12, color=ac)
        m.lathe([(0.05, 0.84), (0.02, 1.0)], seg=6, color=tr, grad_top=ac)
    else:  # gable
        m.lathe([(0.34, 0.14), (0.32, 0.66), (0.38, 0.70)], seg=12, color=w2, grad_top=w)
        m.lathe([(0.40, 0.70), (0.20, 0.88), (0.0, 1.0)], seg=12, color=rf, grad_top=ac)
    return m


def build_rascacielos(pal):
    m = CityMesh()
    st = pal["style"]
    w, w2, tr, rf, ac = pal["wall"], pal["wall2"], pal["trim"], pal["roof"], pal["accent"]
    # Podio amplio
    m.bevel_box((0, 0, 0.08), (0.94, 0.94, 0.16), w2, w, bevel=0.03)
    # Cuerpo principal escalonado en 3 niveles
    m.bevel_box((0, 0, 0.34), (0.76, 0.76, 0.38), w2, w, bevel=0.04)
    m.bevel_box((0, 0, 0.64), (0.58, 0.58, 0.28), w, tr, bevel=0.035)
    if st in ("spire", "prism"):
        m.lathe([(0.28, 0.78), (0.14, 0.90), (0.0, 1.0)], seg=6, color=rf, grad_top=ac)
    elif st == "dome":
        m.bevel_box((0, 0, 0.82), (0.42, 0.42, 0.08), tr, bevel=0.02)
        m.dome((0, 0, 0.86), 0.22, 0.22, 0.14, rf, ac, seg=12, rings=4)
    elif st == "stepped":
        m.bevel_box((0, 0, 0.84), (0.40, 0.40, 0.14), rf, ac, bevel=0.025)
        m.bevel_box((0, 0, 0.95), (0.22, 0.22, 0.08), ac, bevel=0.015)
    elif st == "flat":
        m.bevel_box((0, 0, 0.79), (0.62, 0.62, 0.04), ac, bevel=0.015)
        m.bevel_box((0, 0, 0.85), (0.38, 0.38, 0.08), rf, ac, bevel=0.02)
        m.lathe([(0.035, 0.89), (0.015, 1.0)], seg=6, color=ac)
    else:  # gable
        m.gable_roof((0, 0, 0.78), 0.64, 0.64, 0.22, rf, ac)
    return m


def build_comercio(pal):
    m = CityMesh()
    st = pal["style"]
    w, w2, tr, rf, ac = pal["wall"], pal["wall2"], pal["trim"], pal["roof"], pal["accent"]
    m.bevel_box((0, 0, 0.06), (0.98, 0.92, 0.12), w2, bevel=0.025)
    m.bevel_box((0, 0, 0.32), (0.90, 0.82, 0.42), w2, w, bevel=0.035)
    # Marquesina saliente al frente (+Y / -Y)
    m.bevel_box((0, -0.45, 0.34), (0.86, 0.18, 0.08), ac, bevel=0.02)
    m.bevel_box((0, 0.45, 0.34), (0.86, 0.18, 0.08), ac, bevel=0.02)
    if st == "dome":
        m.dome((0, 0, 0.53), 0.38, 0.34, 0.26, rf, ac, seg=12, rings=4)
    elif st == "gable":
        m.gable_roof((0, 0, 0.53), 0.94, 0.86, 0.30, rf, ac)
    else:
        m.bevel_box((0, 0, 0.62), (0.72, 0.62, 0.18), rf, tr, bevel=0.03)
        m.bevel_box((0, 0, 0.78), (0.48, 0.14, 0.14), ac, bevel=0.02)
    return m


def build_estacion(pal):
    m = CityMesh()
    w, w2, tr, rf, ac = pal["wall"], pal["wall2"], pal["trim"], pal["roof"], pal["accent"]
    # Plataforma de embarque y cubierta abovedada
    m.bevel_box((0, 0, 0.07), (0.98, 0.94, 0.14), w2, tr, bevel=0.03)
    m.arch((0, 0, 0.14), 0.44, 0.10, 0.84, w, seg=10)
    m.arch((0, 0, 0.14), 0.47, 0.05, 0.24, ac, seg=10)
    # Torre de control lateral y antena
    m.bevel_box((0.32, 0.28, 0.44), (0.24, 0.24, 0.62), w2, rf, bevel=0.025)
    m.lathe([(0.04, 0.75), (0.015, 1.0)], seg=6, color=ac)
    return m


def build_parque(pal):
    m = CityMesh(is_park=True)
    pg, pf, pw, tr, ac = pal["park_ground"], pal["park_foliage"], pal["park_water"], pal["trim"], pal["accent"]
    m.lathe([(0.50, 0.0), (0.50, 0.08), (0.46, 0.12), (0.0, 0.12)], seg=14, color=pg)
    m.lathe([(0.20, 0.12), (0.21, 0.21), (0.16, 0.21), (0.14, 0.15), (0.0, 0.15)], seg=12, color=tr)
    m.lathe([(0.14, 0.18), (0.0, 0.18)], seg=12, color=pw, cap_bot=False)
    m.lathe([(0.035, 0.18), (0.045, 0.36), (0.02, 0.46), (0.0, 0.50)], seg=8, color=pw)
    trees = [(-0.24, -0.16, 0.19, 0.48), (0.24, -0.14, 0.16, 0.40), (-0.16, 0.24, 0.17, 0.44)]
    for tx, ty, rad, h in trees:
        m.lathe([(0.042, 0.11), (0.028, 0.11 + h * 0.55)], seg=7, color=pal["wall2"], offset=(tx, ty, 0.0))
        m.sphere((tx, ty, 0.11 + h * 0.78), rad, rad, rad * 0.88, pf, ac, seg=9, rings=5)
    # Pérgola / banca luminosa
    m.bevel_box((0.20, 0.22, 0.18), (0.18, 0.10, 0.08), tr, ac, rot=0.6, bevel=0.015)
    return m


BUILDERS = {
    "casa": build_casa,
    "torre": build_torre,
    "rascacielos": build_rascacielos,
    "comercio": build_comercio,
    "estacion": build_estacion,
    "parque": build_parque,
}


def export_model(biome_id, typ):
    name = f"{biome_id}_{typ}"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = BUILDERS[typ](PALETTES[biome_id])
    ob = m.finish(name)
    tris = len(ob.data.polygons)
    assert tris <= MAX_TRIS, f"{name}: {tris} tris excede {MAX_TRIS}"

    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_attributes=True,
        use_selection=True,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_cameras=False,
        export_lights=False,
    )
    d = ob.dimensions
    return {
        "tris": tris,
        "x": round(d.x, 3),
        "y_alto": round(d.z, 3),
        "z": round(d.y, 3),
        "bytes": os.path.getsize(path),
    }


def write_manifest(stats):
    lines = [
        "# Manifiesto del kit urbano por bioma (`public/models/ciudad/`)",
        "",
        "Generados con `front/tools/blender/generar_ciudad.py` (Blender 5.3, headless).",
        "Convención: un solo mesh por GLB, color por vértice (`COLOR_1`/`COLOR_0`), UVs limpias en fachadas,",
        "origen en la base (`y=0`), centrados en XZ, altura ~1.0, formas suaves y `<= 800` triángulos.",
        "",
        "| modelo | tris | ancho×alto×fondo | bytes |",
        "|---|---|---|---|",
    ]
    for k in sorted(stats.keys()):
        s = stats[k]
        lines.append(f"| {k} | {s['tris']} | {s['x']:.3f}×{s['y_alto']:.3f}×{s['z']:.3f} | {s['bytes']} |")
    with open(os.path.join(OUT, "MANIFIESTO.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    sel = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()
    os.makedirs(OUT, exist_ok=True)
    stats_path = os.path.join(OUT, "_stats.json")
    stats = json.load(open(stats_path, encoding="utf-8")) if os.path.exists(stats_path) else {}

    for biome_id in PALETTES:
        for typ in TYPES:
            name = f"{biome_id}_{typ}"
            if sel and name not in sel:
                continue
            stats[name] = export_model(biome_id, typ)
            print("OK", name, stats[name])

    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=1, sort_keys=True)
    write_manifest(stats)
    print(f"Listo: {len(stats)} modelos en {OUT}")


main()
