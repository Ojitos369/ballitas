"""
Genera 18 modelos GLB low-poly (nuevos, no toca los existentes) para Ballitas.

Uso, desde front/:
    ~/Documents/apps/blender/blender -b -P tools/blender/generar_modelos.py
    (opcional: ... -- nombre1 nombre2   para generar solo algunos)

Convención (igual que public/models existentes): un solo mesh, +Y arriba al exportar,
origen en la base (y=0), ~1 unidad de alto, color por vértice (atributo Col), <= 2500 tris.
Salida: public/models/<nombre>.glb y public/models/_stats.json (tris y dimensiones).
"""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models")
MAX_TRIS = 2500


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def lin(c):  # color vertex en lineal para que se vea igual en three
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


class M:
    """Constructor de malla con bmesh en coordenadas Z-arriba (Blender); el exportador convierte a Y-arriba."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")

    def paint(self, faces, color):
        c = lin(color)
        for f in faces:
            for l in f.loops:
                l[self.col] = c

    def lathe(self, prof, seg=10, color=None, grad=None, jitter=0.0, seed=1, cap_top=True, cap_bot=True):
        """prof: [(radio, z)] de abajo a arriba. grad: (color_abajo, color_arriba) opcional."""
        rnd = random.Random(seed)
        rings = []
        for r, z in prof:
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                k = 1 + (rnd.uniform(-jitter, jitter) if r > 0.001 else 0)
                ring.append(self.bm.verts.new((math.cos(a) * r * k, math.sin(a) * r * k, z)))
            rings.append(ring)
        faces = []
        for a, b in zip(rings, rings[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                try:
                    faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
                except ValueError:
                    pass
        if cap_bot and prof[0][0] > 0.001:
            faces.append(self.bm.faces.new(rings[0][::-1]))
        if cap_top and prof[-1][0] > 0.001:
            faces.append(self.bm.faces.new(rings[-1]))
        # r=0 duplicados: weld
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        faces = [f for f in faces if f.is_valid]
        if grad:
            z0, z1 = prof[0][1], prof[-1][1]
            for f in faces:
                for l in f.loops:
                    t = (l.vert.co.z - z0) / max(1e-6, z1 - z0)
                    c0, c1 = lin(grad[0]), lin(grad[1])
                    l[self.col] = tuple(c0[k] + (c1[k] - c0[k]) * t for k in range(4))
        elif color:
            self.paint(faces, color)
        return faces

    def box(self, c, s, color, rot=0.0):
        """caja centrada en c=(x,y,z), tamaño s=(sx,sy,sz), rotación Z."""
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        vs = r["verts"]
        for v in vs:
            v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
            x, y = v.co.x, v.co.y
            v.co.x = x * math.cos(rot) - y * math.sin(rot) + c[0]
            v.co.y = x * math.sin(rot) + y * math.cos(rot) + c[1]
            v.co.z += c[2]
        fs = list({f for v in vs for f in v.link_faces})
        self.paint(fs, color)
        return fs

    def prism(self, pts, z0, z1, color, top=None):
        """Prisma extruido de un polígono (x,y) entre z0 y z1; top=color opcional para la cara superior."""
        v0 = [self.bm.verts.new((x, y, z0)) for x, y in pts]
        v1 = [self.bm.verts.new((x, y, z1)) for x, y in pts]
        n = len(pts)
        fs = [self.bm.faces.new((v0[i], v0[(i + 1) % n], v1[(i + 1) % n], v1[i])) for i in range(n)]
        fs.append(self.bm.faces.new(v0[::-1]))
        t = self.bm.faces.new(v1)
        fs.append(t)
        self.paint(fs, color)
        if top:
            self.paint([t], top)
        return fs

    def cone(self, c, r, h, color, seg=6, tilt=(0, 0), r2=0.0, rot=0.0):
        """Cono/cilindro de r a r2, base en c, inclinado tilt=(dx,dy) por unidad de altura."""
        rn = random.Random(int(abs(c[0] * 97 + c[1] * 31)) + 1)
        v0 = [self.bm.verts.new((c[0] + math.cos(rot + 2 * math.pi * i / seg) * r, c[1] + math.sin(rot + 2 * math.pi * i / seg) * r, c[2])) for i in range(seg)]
        if r2 > 0.001:
            v1 = [self.bm.verts.new((c[0] + tilt[0] * h + math.cos(rot + 2 * math.pi * i / seg) * r2, c[1] + tilt[1] * h + math.sin(rot + 2 * math.pi * i / seg) * r2, c[2] + h)) for i in range(seg)]
            fs = [self.bm.faces.new((v0[i], v0[(i + 1) % seg], v1[(i + 1) % seg], v1[i])) for i in range(seg)]
            fs.append(self.bm.faces.new(v1))
        else:
            ap = self.bm.verts.new((c[0] + tilt[0] * h, c[1] + tilt[1] * h, c[2] + h))
            fs = [self.bm.faces.new((v0[i], v0[(i + 1) % seg], ap)) for i in range(seg)]
        fs.append(self.bm.faces.new(v0[::-1]))
        self.paint(fs, color)
        return fs

    def sphere(self, c, r, color, seg=8, rings=5, squash=1.0):
        rs = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)
        for v in rs["verts"]:
            v.co = Vector((v.co.x * r + c[0], v.co.y * r + c[1], v.co.z * r * squash + c[2]))
        fs = list({f for v in rs["verts"] for f in v.link_faces})
        self.paint(fs, color)
        return fs

    def finish(self, name):
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        # atributo de color en bytes (el exportador lo escribe como COLOR_0)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new("mat_" + name)
        mat.use_nodes = True
        bs = mat.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Roughness"].default_value = 0.85
        vc = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mat.node_tree.links.new(vc.outputs["Color"], bs.inputs["Base Color"])
        me.materials.append(mat)
        # normalizar: base z=0, centrado XY, alto 1 (excepto 'ancho' donde manda el XY mayor)
        zs = [v.co.z for v in me.vertices]
        xs = [v.co.x for v in me.vertices]
        ys = [v.co.y for v in me.vertices]
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        for v in me.vertices:
            v.co.x -= cx
            v.co.y -= cy
            v.co.z -= min(zs)
        return ob


# ---------------------------------------------------------------- modelos
def volcan_erupcion():
    m = M()
    roca, osc, lava, lava2 = hexc("#4a3a36"), hexc("#2c2220"), hexc("#ff5a1f"), hexc("#ffb347")
    m.lathe([(0.62, 0), (0.55, 0.12), (0.38, 0.55), (0.24, 0.86), (0.26, 0.92), (0.17, 0.9), (0.0, 0.8)],
            seg=12, grad=(osc, roca), jitter=0.06, seed=3, cap_bot=True, cap_top=False)
    # borde superior alterno y lava en el cráter
    m.lathe([(0.2, 0.88), (0.0, 0.84)], seg=12, color=lava2, cap_bot=False, cap_top=False)
    # grietas de lava: lajas emisivas por la ladera
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        for k, (rr, zz, w) in enumerate([(0.5, 0.18, 0.05), (0.4, 0.4, 0.045), (0.3, 0.66, 0.04)]):
            nx, ny = math.cos(a + k * 0.12), math.sin(a + k * 0.12)
            m.box((nx * rr * 0.97, ny * rr * 0.97, zz), (w, 0.1, 0.16), lava if k % 2 == 0 else lava2, rot=a + k * 0.12)
    # chorro de lava y bolas
    m.cone((0, 0, 0.86), 0.07, 0.1, lava, seg=6, r2=0.04)
    m.sphere((0.03, 0.02, 1.0), 0.06, lava2, seg=6, rings=3)
    return m.finish("volcan_erupcion")


def geiser():
    m = M()
    m.lathe([(0.55, 0), (0.5, 0.08), (0.38, 0.22), (0.26, 0.3), (0.2, 0.33), (0.11, 0.3), (0.1, 0.2)],
            seg=12, grad=(hexc("#7d6f58"), hexc("#e6d9a6")), jitter=0.07, seed=5, cap_top=False)
    m.lathe([(0.2, 0.33), (0.12, 0.31), (0.1, 0.22)], seg=12, color=hexc("#3cc6c0"), cap_bot=False, cap_top=False)
    # terrazas minerales (anillos)
    m.lathe([(0.62, 0), (0.6, 0.04), (0.5, 0.06), (0.0, 0.06)], seg=12, color=hexc("#cfae56"), cap_bot=False, cap_top=False)
    # columna de vapor/agua
    m.lathe([(0.07, 0.33), (0.1, 0.6), (0.06, 0.85), (0.0, 1.0)], seg=8, grad=(hexc("#bfefff"), hexc("#ffffff")), cap_bot=False, cap_top=False)
    return m.finish("geiser")


def _rampa(name, base, top, edge, rails=None):
    """Cuña (rampa) 1 de largo en X, sube de 0 a ~0.5 de alto en +X; ancho 0.8."""
    m = M()
    w = 0.4
    pts = [(-0.5, -w), (0.5, -w), (0.5, w), (-0.5, w)]
    # cuña
    a = [m.bm.verts.new(p) for p in [(-0.5, -w, 0), (0.5, -w, 0), (0.5, w, 0), (-0.5, w, 0), (0.5, -w, 0.5), (0.5, w, 0.5)]]
    fs = [m.bm.faces.new(f) for f in [(a[0], a[3], a[2], a[1]), (a[0], a[1], a[4]), (a[3], a[5], a[2]), (a[1], a[2], a[5], a[4]), (a[0], a[4], a[5], a[3])]]
    m.paint(fs, base)
    m.paint([fs[4]], top)
    # bordes laterales
    for sy in (-1, 1):
        m.prism([(-0.5, sy * w), (0.5, sy * w), (0.5, sy * (w - 0.06)), (-0.5, sy * (w - 0.06))], 0.0, 0.07, edge)
    for x in (-0.42, -0.14, 0.14, 0.42):  # peldaños / travesaños
        m.box((x, 0, 0.5 * (x + 0.5) + 0.015), (0.05, 2 * w - 0.14, 0.03), edge)
    if rails:
        for sy in (-1, 1):
            for x in (-0.4, 0.0, 0.4):
                m.cone((x, sy * (w - 0.03), 0.5 * (x + 0.5)), 0.025, 0.22, rails, seg=5, r2=0.02)
    ob = m.finish(name)
    return ob


def rampa_roca():
    return _rampa("rampa_roca", hexc("#6b625a"), hexc("#8d8378"), hexc("#4a433d"))


def rampa_hielo():
    return _rampa("rampa_hielo", hexc("#9fd6f0"), hexc("#d8f4ff"), hexc("#5fb0d8"))


def rampa_madera():
    return _rampa("rampa_madera", hexc("#8a5a2c"), hexc("#b57a3c"), hexc("#5a3718"), rails=hexc("#6e4521"))


def cascada_roca():
    m = M()
    roca, mus, agua = hexc("#5d5750"), hexc("#4b7a3a"), hexc("#7fd4f5")
    # peñasco superior y base escalonados
    m.lathe([(0.55, 0), (0.5, 0.2), (0.42, 0.5), (0.34, 0.85), (0.3, 1.0)], seg=9, grad=(hexc("#3f3a35"), roca), jitter=0.1, seed=9, cap_top=True)
    m.cone((-0.05, 0.3, 0.9), 0.3, 0.1, mus, seg=7, r2=0.22)
    # lámina de agua cayendo
    m.box((0.0, -0.36, 0.5), (0.2, 0.06, 0.95), agua)
    m.box((0.0, -0.34, 0.04), (0.34, 0.2, 0.06), hexc("#e8fbff"))  # espuma
    m.box((0.0, -0.32, 0.98), (0.24, 0.1, 0.05), agua)
    for sx in (-0.2, 0.2):
        m.box((sx, -0.34, 0.45), (0.07, 0.1, 0.9), hexc("#45403a"))
    return m.finish("cascada_roca")


def isla_nube():
    m = M()
    blanco, azul = hexc("#ffffff"), hexc("#bcd9f2")
    # panza de la isla: cono invertido de roca/nube
    m.lathe([(0.0, 0.0), (0.18, 0.12), (0.4, 0.3), (0.55, 0.42), (0.55, 0.5)], seg=10, grad=(hexc("#9aa7c2"), azul), jitter=0.05, seed=2, cap_bot=False, cap_top=True)
    for (x, y, z, r) in [(0, 0, 0.62, 0.34), (0.3, 0.1, 0.55, 0.24), (-0.32, -0.05, 0.56, 0.25), (0.05, -0.28, 0.54, 0.22), (-0.08, 0.3, 0.55, 0.22), (0.12, 0.08, 0.82, 0.22)]:
        m.sphere((x, y, z), r, blanco, seg=8, rings=5, squash=0.8)
    return m.finish("isla_nube")


def puente_cristal():
    m = M()
    glass, edge, glow = hexc("#9fe9ff"), hexc("#3a6a8a"), hexc("#e6fbff")
    # tablero largo (eje X) con arco suave: 5 losas
    for i in range(5):
        x = -0.42 + i * 0.21
        z = 0.22 + 0.1 * math.sin((i / 4) * math.pi)
        m.box((x, 0, z), (0.2, 0.46, 0.05), glass)
        m.box((x, 0, z + 0.028), (0.16, 0.38, 0.005), glow)
    for sy in (-1, 1):  # barandas de cristal
        for i in range(5):
            x = -0.42 + i * 0.21
            z = 0.22 + 0.1 * math.sin((i / 4) * math.pi)
            m.cone((x, sy * 0.23, z), 0.03, 0.2, edge, seg=4, r2=0.02, rot=0.78)
            m.cone((x, sy * 0.23, z + 0.2), 0.045, 0.1, glow, seg=4, r2=0.0, rot=0.78)
    for sx in (-0.5, 0.5):  # pilares
        m.cone((sx * 0.95, 0, 0), 0.07, 0.22, edge, seg=5, r2=0.05)
    return m.finish("puente_cristal")


def alga_larga():
    m = M()
    seg = 10
    for k, (ox, oy, h, ph) in enumerate([(0, 0, 1.0, 0), (0.12, 0.05, 0.8, 1.3), (-0.1, -0.06, 0.65, 2.4)]):
        for i in range(seg):
            z0, z1 = h * i / seg, h * (i + 1) / seg
            w0, w1 = 0.07 * (1 - i / seg) + 0.01, 0.07 * (1 - (i + 1) / seg) + 0.01
            x0, x1 = ox + 0.07 * math.sin(i * 0.9 + ph), ox + 0.07 * math.sin((i + 1) * 0.9 + ph)
            t = i / seg
            col = tuple(a + (b - a) * t for a, b in zip(hexc("#1f6b3a"), hexc("#7be08a")))
            m.cone((x0, oy, z0), w0, z1 - z0, col, seg=4, r2=w1, tilt=((x1 - x0) / (z1 - z0), 0), rot=0.78)
    return m.finish("alga_larga")


def concha_gigante():
    m = M()
    # abanico: 9 costillas radiales extruidas
    n = 9
    base, lip, perla = hexc("#e8a9b8"), hexc("#fff0f4"), hexc("#f6f1ff")
    for half, z0, tilt, col in [(0, 0.0, 0.0, base), (1, 0.12, 0.45, base)]:
        pass
    # valva inferior (cuenco) y superior abierta
    m.lathe([(0.0, 0.0), (0.3, 0.02), (0.5, 0.14), (0.52, 0.3)], seg=14, grad=(hexc("#c97b91"), base), cap_bot=False, cap_top=False)
    m.lathe([(0.52, 0.3), (0.46, 0.3), (0.28, 0.12), (0.0, 0.08)], seg=14, color=hexc("#fbe3ea"), cap_bot=False, cap_top=False)
    # costillas
    for i in range(n):
        a = -math.pi / 2 + (i / (n - 1)) * math.pi
        m.cone((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.1), 0.03, 0.3, lip, seg=4, tilt=(math.cos(a) * 0.9, math.sin(a) * 0.9), r2=0.02, rot=a)
    # tapa levantada
    m.prism([(-0.5, -0.25), (0.5, -0.25), (0.45, 0.25), (-0.45, 0.25)], 0.0, 0.0, base) if False else None
    m.lathe([(0.0, 0.45), (0.28, 0.5), (0.5, 0.7), (0.5, 0.9), (0.0, 0.7)], seg=10, grad=(base, lip), cap_bot=False, cap_top=False, jitter=0.02)
    m.sphere((0.0, 0.0, 0.2), 0.12, perla, seg=8, rings=5)
    return m.finish("concha_gigante")


def saguaro_grande():
    m = M()
    v, vd = hexc("#4f9a4a"), hexc("#2f6a35")
    m.lathe([(0.16, 0), (0.17, 0.2), (0.16, 0.7), (0.15, 0.9), (0.08, 1.0), (0.0, 1.02)], seg=10, grad=(vd, v), cap_top=False)
    for sy, z, h in ((1, 0.35, 0.4), (-1, 0.5, 0.32)):  # brazos en L
        m.cone((sy * 0.15, 0, z), 0.065, 0.2, v, seg=7, r2=0.06, tilt=(sy * 1.2, 0), rot=0.4)
        m.cone((sy * 0.38, 0, z + 0.14), 0.06, h, v, seg=7, r2=0.045)
        m.sphere((sy * 0.38, 0, z + 0.14 + h), 0.05, v, seg=7, rings=4)
    for i in range(10):  # espinas / flor
        a = i * 0.63
        m.cone((math.cos(a) * 0.16, math.sin(a) * 0.16, 0.1 + i * 0.08), 0.008, 0.05, hexc("#f2e6b8"), seg=3, tilt=(math.cos(a), math.sin(a)))
    m.sphere((0, 0, 1.03), 0.04, hexc("#ff6fa0"), seg=6, rings=3)
    return m.finish("saguaro_grande")


def estalagmita_hielo():
    m = M()
    for (x, y, h, r, s) in [(0, 0, 1.0, 0.16, 1), (0.2, 0.08, 0.6, 0.11, 2), (-0.17, -0.1, 0.72, 0.12, 3), (0.05, -0.22, 0.4, 0.08, 4), (-0.12, 0.17, 0.46, 0.09, 5)]:
        m.cone((x, y, 0), r, h, hexc("#bfeaff"), seg=6, r2=0.0, tilt=(0.04 * s % 0.1 - 0.04, 0.03), rot=s)
        m.cone((x, y, 0), r * 1.15, h * 0.18, hexc("#6fb8dc"), seg=6, r2=r * 0.9)
    # punta clara: re-pinta cúspide
    for f in m.bm.faces:
        if sum(v.co.z for v in f.verts) / len(f.verts) > 0.55:
            m.paint([f], hexc("#f2fbff"))
    return m.finish("estalagmita_hielo")


def geoda():
    m = M()
    out, inn, cry, gl = hexc("#6a5d70"), hexc("#3a2d55"), hexc("#c58bff"), hexc("#f0d8ff")
    # semiesfera hueca mirando hacia arriba, cristales por dentro
    m.lathe([(0.52, 0.0), (0.56, 0.18), (0.5, 0.36), (0.44, 0.48)], seg=12, grad=(hexc("#4a4150"), out), jitter=0.05, seed=4, cap_top=False)
    m.lathe([(0.44, 0.48), (0.38, 0.4), (0.26, 0.28), (0.0, 0.24)], seg=12, color=inn, cap_bot=False, cap_top=False)
    rn = random.Random(7)
    for i in range(16):
        a = rn.uniform(0, 6.28)
        r = rn.uniform(0.02, 0.3)
        h = rn.uniform(0.2, 0.46)
        m.cone((math.cos(a) * r, math.sin(a) * r, 0.26), rn.uniform(0.04, 0.07), h, cry if i % 3 else gl, seg=5, r2=0.0,
               tilt=(math.cos(a) * r * 0.9, math.sin(a) * r * 0.9), rot=a)
    return m.finish("geoda")


def lapida():
    m = M()
    st, stm = hexc("#8c8f94"), hexc("#5d6064")
    m.box((0, 0, 0.04), (0.62, 0.34, 0.08), stm)                    # base
    m.box((0, 0, 0.42), (0.44, 0.12, 0.68), st)
    m.lathe([(0.22, 0.76), (0.2, 0.86), (0.13, 0.96), (0.0, 1.0)], seg=8, color=st, cap_bot=False, cap_top=False)  # remate (cilindro girado)
    # remate redondeado: cilindro plano orientado a Y
    for f in m.bm.faces:
        pass
    m.box((0, -0.07, 0.55), (0.06, 0.02, 0.26), stm)                # cruz grabada
    m.box((0, -0.07, 0.6), (0.2, 0.02, 0.05), stm)
    m.cone((0.28, 0.1, 0.02), 0.05, 0.2, hexc("#4a6b3a"), seg=5, r2=0.0)  # hierba
    m.cone((-0.27, -0.12, 0.02), 0.05, 0.16, hexc("#4a6b3a"), seg=5, r2=0.0)
    return m.finish("lapida")


def tronco_hueco():
    m = M()
    cor, int_, anillo = hexc("#6b4527"), hexc("#2a170a"), hexc("#c8a06a")
    # tronco tumbado sobre el eje X: se construye vertical y se rota al final
    m.lathe([(0.42, 0), (0.44, 0.15), (0.4, 0.55), (0.43, 0.9), (0.4, 1.0)], seg=10, grad=(hexc("#4c2f18"), cor), jitter=0.05, seed=6, cap_bot=False, cap_top=False)
    m.lathe([(0.4, 1.0), (0.32, 1.0), (0.3, 0.9), (0.3, 0.1), (0.4, 0.0)], seg=10, color=int_, cap_bot=False, cap_top=False)  # hueco
    m.lathe([(0.4, 1.0), (0.4, 1.0), (0.32, 1.0)], seg=10, color=anillo, cap_bot=False, cap_top=False)
    m.lathe([(0.4, 0.0), (0.32, 0.0)], seg=10, color=anillo, cap_bot=False, cap_top=False)
    for (a, z) in [(0.9, 0.3), (3.5, 0.6)]:  # hongos de repisa
        m.cone((math.cos(a) * 0.43, math.sin(a) * 0.43, z), 0.1, 0.04, hexc("#e0b85a"), seg=6, r2=0.07, tilt=(math.cos(a) * 0.5, math.sin(a) * 0.5))
    return m.finish("tronco_hueco")


def fuente_jardin():
    m = M()
    pie, agua, esp = hexc("#cdd1c4"), hexc("#7fe0ee"), hexc("#f4fbff")
    m.lathe([(0.55, 0), (0.55, 0.12), (0.48, 0.14), (0.0, 0.14)], seg=14, grad=(hexc("#9aa090"), pie), cap_bot=True, cap_top=False)  # pileta
    m.lathe([(0.48, 0.14), (0.46, 0.14), (0.0, 0.13)], seg=14, color=agua, cap_bot=False, cap_top=False)
    m.lathe([(0.08, 0.14), (0.1, 0.4), (0.07, 0.56)], seg=8, color=pie, cap_bot=False, cap_top=False)
    m.lathe([(0.0, 0.5), (0.28, 0.56), (0.3, 0.62), (0.0, 0.57)], seg=12, color=pie, cap_bot=False, cap_top=False)  # plato
    m.lathe([(0.0, 0.58), (0.26, 0.6), (0.0, 0.59)], seg=12, color=agua, cap_bot=False, cap_top=False)
    m.lathe([(0.04, 0.58), (0.05, 0.8), (0.03, 0.95), (0.0, 1.0)], seg=6, grad=(agua, esp), cap_bot=False, cap_top=False)  # chorro
    for i in range(6):  # gotas
        a = i * 1.05
        m.sphere((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.2), 0.025, esp, seg=5, rings=3)
    return m.finish("fuente_jardin")


def hongo_gigante():
    m = M()
    tallo, sombrero, pt = hexc("#f2e6cf"), hexc("#d83a3a"), hexc("#ffffff")
    m.lathe([(0.14, 0), (0.12, 0.2), (0.1, 0.5), (0.11, 0.6)], seg=9, grad=(hexc("#cdbb9a"), tallo), cap_bot=True, cap_top=False)
    m.lathe([(0.5, 0.52), (0.52, 0.6), (0.44, 0.78), (0.28, 0.93), (0.0, 1.0)], seg=12, grad=(hexc("#a82a2a"), sombrero), cap_bot=False, cap_top=False)
    m.lathe([(0.5, 0.52), (0.14, 0.58), (0.0, 0.6)], seg=12, color=hexc("#e8d9bd"), cap_bot=False, cap_top=False)  # láminas
    for (a, r, z, s) in [(0.2, 0.25, 0.9, 0.07), (2.3, 0.33, 0.82, 0.06), (4.0, 0.28, 0.87, 0.06), (5.3, 0.4, 0.74, 0.05), (1.2, 0.42, 0.72, 0.05)]:
        m.sphere((math.cos(a) * r, math.sin(a) * r, z), s, pt, seg=6, rings=3, squash=0.5)
    return m.finish("hongo_gigante")


def luciernaga_farol():
    m = M()
    metal, vidrio, brillo = hexc("#3d3a45"), hexc("#fff3a8"), hexc("#fff9d8")
    m.lathe([(0.1, 0), (0.07, 0.04), (0.05, 0.1), (0.04, 0.6)], seg=8, color=metal, cap_top=False)   # poste
    m.cone((0, 0, 0.58), 0.16, 0.05, metal, seg=6, r2=0.14)                                              # plataforma
    m.lathe([(0.14, 0.63), (0.17, 0.72), (0.14, 0.82)], seg=6, color=vidrio, cap_bot=False, cap_top=False)   # linterna
    m.sphere((0, 0, 0.72), 0.1, brillo, seg=6, rings=4)                                                  # luz
    m.cone((0, 0, 0.82), 0.2, 0.1, metal, seg=6, r2=0.02)                                                # techo
    m.sphere((0, 0, 0.94), 0.03, metal, seg=5, rings=3)
    # luciérnaga decorativa y alas
    m.sphere((0.22, 0.05, 0.62), 0.04, brillo, seg=5, rings=3)
    m.box((0.22, 0.0, 0.67), (0.1, 0.01, 0.04), hexc("#cbe3ff"), rot=0.6)
    m.box((0.22, 0.1, 0.67), (0.1, 0.01, 0.04), hexc("#cbe3ff"), rot=-0.6)
    return m.finish("luciernaga_farol")


ALL = [volcan_erupcion, geiser, rampa_roca, rampa_hielo, rampa_madera, cascada_roca, isla_nube, puente_cristal,
       alga_larga, concha_gigante, saguaro_grande, estalagmita_hielo, geoda, lapida, tronco_hueco, fuente_jardin,
       hongo_gigante, luciernaga_farol]


def main():
    sel = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    os.makedirs(OUT, exist_ok=True)
    stats_path = os.path.join(OUT, "_stats.json")
    stats = json.load(open(stats_path)) if os.path.exists(stats_path) else {}
    for fn in ALL:
        if sel and fn.__name__ not in sel:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ob = fn()
        tris = len(ob.data.polygons)
        dims = ob.dimensions
        ob.data.update()
        sc = 1.0 / max(dims.z, 1e-6)
        # escala uniforme: alto 1 salvo que sea más ancho que alto (puentes/rampas/isla/concha) -> máx(x,y)=1.0
        ref = max(dims.z, max(dims.x, dims.y) if fn.__name__ in ("rampa_roca", "rampa_hielo", "rampa_madera", "puente_cristal", "isla_nube", "concha_gigante", "fuente_jardin", "geoda", "tronco_hueco", "geiser") else 0)
        sc = 1.0 / ref
        for v in ob.data.vertices:
            v.co *= sc
        ob.data.update()
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT, fn.__name__ + ".glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                                  export_attributes=True, use_selection=True, export_materials="EXPORT",
                                  export_image_format="NONE", export_cameras=False, export_lights=False)
        d = ob.dimensions
        assert tris <= MAX_TRIS, f"{fn.__name__}: {tris} tris"
        stats[fn.__name__] = {"tris": tris, "x": round(d.x, 3), "y_alto": round(d.z, 3), "z": round(d.y, 3),
                              "bytes": os.path.getsize(path)}
        print("OK", fn.__name__, stats[fn.__name__])
    json.dump(stats, open(stats_path, "w"), indent=1)


main()
