"""
Generador procedural de los 13 modelos GLB del contrato de Ballitas usando Blender 5.3.

Uso desde front/:
    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b -P tools/assets/generate_models.py

Produce:
    - public/models/<nombre>.glb (13 archivos, un solo mesh c/u, +Y arriba, < 4000 tris)
    - tools/assets/preview/models_sheet.png (hoja de contacto renderizada en Cycles)
"""

import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MODELS_DIR = os.path.join(FRONT_DIR, "public", "models")
PREVIEW_DIR = os.path.join(SCRIPT_DIR, "preview")
SHEET_PATH = os.path.join(PREVIEW_DIR, "models_sheet.png")

MAX_TRIS = 4000


def ensure_dirs():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_neutral_material(name="Mat_Neutral", roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.layer_name = "Col"

    nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_mesh_obj(name, bm, mat=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    if not mesh.color_attributes:
        mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
        for c in mesh.color_attributes["Col"].data:
            c.color = (1.0, 1.0, 1.0, 1.0)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat is not None:
        obj.data.materials.append(mat)
    return obj


def set_bm_vertex_color(bm, col_rgba):
    layer = bm.loops.layers.color.get("Col")
    if layer is None:
        layer = bm.loops.layers.color.new("Col")
    for f in bm.faces:
        for loop in f.loops:
            loop[layer] = col_rgba


def set_bm_height_gradient(bm, z_min, z_max, col_bot, col_top):
    layer = bm.loops.layers.color.get("Col")
    if layer is None:
        layer = bm.loops.layers.color.new("Col")
    span = max(1e-5, z_max - z_min)
    for f in bm.faces:
        for loop in f.loops:
            t = max(0.0, min(1.0, (loop.vert.co.z - z_min) / span))
            r = col_bot[0] + (col_top[0] - col_bot[0]) * t
            g = col_bot[1] + (col_top[1] - col_bot[1]) * t
            b = col_bot[2] + (col_top[2] - col_bot[2]) * t
            loop[layer] = (r, g, b, 1.0)


def join_and_bake(objs, name, mat, subsurf_levels=0, bevel_width=0.0, bevel_segments=2):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    if bevel_width > 0.0:
        bev = obj.modifiers.new(name="Bevel", type="BEVEL")
        bev.width = bevel_width
        bev.segments = bevel_segments
        bev.limit_method = "ANGLE"
        bev.angle_limit = math.radians(32.0)

    if subsurf_levels > 0:
        sub = obj.modifiers.new(name="Subsurf", type="SUBSURF")
        sub.levels = subsurf_levels
        sub.render_levels = subsurf_levels

    # Aplicar todos los modificadores
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)

    # Un solo material
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    # Sombreado suave
    mesh = obj.data
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.update()
    return obj


def add_subsurf_to_obj(obj, levels=2):
    sub = obj.modifiers.new(name="Subsurf", type="SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=sub.name)


def add_bevel_to_obj(obj, width=0.015, segments=2, angle_deg=30.0):
    bev = obj.modifiers.new(name="Bevel", type="BEVEL")
    bev.width = width
    bev.segments = segments
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(angle_deg)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bev.name)


def normalize_vertical(obj):
    """Centra en X/Y (que serán X/Z en glTF), apoya base en Z=0 y escala a altura 1.0."""
    mesh = obj.data
    coords = [v.co.copy() for v in mesh.vertices]
    xs = [c.x for c in coords]
    ys = [c.y for c in coords]
    zs = [c.z for c in coords]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)

    cx = 0.5 * (min_x + max_x)
    cy = 0.5 * (min_y + max_y)
    height = max_z - min_z
    scale = 1.0 / height if height > 1e-6 else 1.0

    for v in mesh.vertices:
        v.co.x = (v.co.x - cx) * scale
        v.co.y = (v.co.y - cy) * scale
        v.co.z = (v.co.z - min_z) * scale
    mesh.update()


def normalize_clamp(obj):
    """Centra en (0,0,0), eje Y_blender (=Z_gltf) ancho 0.15, diámetro X/Z_blender (=X/Y_gltf) 1.0."""
    mesh = obj.data
    coords = [v.co.copy() for v in mesh.vertices]
    xs = [c.x for c in coords]
    ys = [c.y for c in coords]
    zs = [c.z for c in coords]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    cz = 0.5 * (min(zs) + max(zs))

    diam_x = max(xs) - min(xs)
    diam_z = max(zs) - min(zs)
    diam = max(diam_x, diam_z, 1e-6)
    xy_scale = 1.0 / diam

    width_y = max(ys) - min(ys)
    y_scale = 0.15 / max(width_y, 1e-6)

    for v in mesh.vertices:
        v.co.x = (v.co.x - cx) * xy_scale
        v.co.z = (v.co.z - cz) * xy_scale
        v.co.y = (v.co.y - cy) * y_scale
    mesh.update()


def count_tris(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def make_tube_chain(points, radii, segs=8, cap_ends=True, col_bot=(0.82, 0.82, 0.82, 1.0), col_top=(0.96, 0.96, 0.96, 1.0)):
    """Construye un tubo orgánico suave a lo largo de una lista de puntos y radios."""
    bm = bmesh.new()
    rings = []
    n = len(points)
    for i, (pt, rad) in enumerate(zip(points, radii)):
        if i == 0:
            tangent = (points[1] - points[0]).normalized()
        elif i == n - 1:
            tangent = (points[-1] - points[-2]).normalized()
        else:
            tangent = (points[i + 1] - points[i - 1]).normalized()

        up = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
        side = tangent.cross(up).normalized()
        binorm = side.cross(tangent).normalized()

        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / segs
            offset = (side * math.cos(ang) + binorm * math.sin(ang)) * rad
            v = bm.verts.new(pt + offset)
            ring.append(v)
        rings.append(ring)

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    if cap_ends:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])

    zs = [p.z for p in points]
    set_bm_height_gradient(bm, min(zs), max(zs), col_bot, col_top)
    return bm


def make_lathe(profile_rz, segs=12, col_bot=(0.85, 0.85, 0.85, 1.0), col_top=(1.0, 1.0, 1.0, 1.0)):
    """Construye una malla de revolución alrededor del eje Z a partir de pares (radio, z)."""
    bm = bmesh.new()
    rings = []
    bot_center = None
    top_center = None

    for idx, (r, z) in enumerate(profile_rz):
        if r <= 1e-5:
            v = bm.verts.new(Vector((0.0, 0.0, z)))
            if idx == 0:
                bot_center = v
            else:
                top_center = v
            rings.append([v])
        else:
            ring = []
            for s in range(segs):
                ang = (2.0 * math.pi * s) / segs
                ring.append(bm.verts.new(Vector((r * math.cos(ang), r * math.sin(ang), z))))
            rings.append(ring)

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        if len(r0) == 1 and len(r1) > 1:
            c = r0[0]
            for s in range(segs):
                sn = (s + 1) % segs
                bm.faces.new((c, r1[sn], r1[s]))
        elif len(r0) > 1 and len(r1) == 1:
            c = r1[0]
            for s in range(segs):
                sn = (s + 1) % segs
                bm.faces.new((r0[s], r0[sn], c))
        elif len(r0) > 1 and len(r1) > 1:
            for s in range(segs):
                sn = (s + 1) % segs
                bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    zs = [p[1] for p in profile_rz]
    set_bm_height_gradient(bm, min(zs), max(zs), col_bot, col_top)
    return bm


# ---------------------------------------------------------------------------
# 1. TREE: Árbol orgánico retorcido con copa de esferas fusionadas
# ---------------------------------------------------------------------------
def build_tree(mat):
    objs = []
    trunk_pts = [
        Vector((0.0, 0.0, 0.0)),
        Vector((0.02, -0.01, 0.14)),
        Vector((0.06, 0.03, 0.30)),
        Vector((-0.02, 0.04, 0.46)),
        Vector((-0.03, -0.01, 0.62)),
    ]
    trunk_r = [0.11, 0.075, 0.062, 0.052, 0.040]
    bm_trunk = make_tube_chain(trunk_pts, trunk_r, segs=6, col_bot=(0.78, 0.77, 0.75, 1.0), col_top=(0.86, 0.85, 0.83, 1.0))
    objs.append(create_mesh_obj("tree_trunk", bm_trunk, mat))

    # Dos ramas retorcidas
    b1_pts = [Vector((0.01, 0.03, 0.40)), Vector((0.12, 0.08, 0.52)), Vector((0.20, 0.05, 0.62))]
    b1_r = [0.044, 0.032, 0.022]
    objs.append(create_mesh_obj("tree_b1", make_tube_chain(b1_pts, b1_r, segs=5, col_bot=(0.82, 0.81, 0.80, 1.0), col_top=(0.88, 0.87, 0.86, 1.0)), mat))

    b2_pts = [Vector((-0.01, 0.02, 0.36)), Vector((-0.14, -0.06, 0.48)), Vector((-0.20, -0.08, 0.58))]
    b2_r = [0.040, 0.030, 0.020]
    objs.append(create_mesh_obj("tree_b2", make_tube_chain(b2_pts, b2_r, segs=5, col_bot=(0.82, 0.81, 0.80, 1.0), col_top=(0.88, 0.87, 0.86, 1.0)), mat))

    # Copa de esferas fusionadas frondosas (cubo base -> Subsurf nivel 2)
    blobs = [
        (Vector((0.0, 0.0, 0.71)), (0.31, 0.29, 0.24), (0.97, 0.98, 0.97, 1.0)),
        (Vector((0.20, 0.06, 0.64)), (0.22, 0.20, 0.17), (0.94, 0.96, 0.94, 1.0)),
        (Vector((-0.20, -0.06, 0.62)), (0.21, 0.19, 0.17), (0.93, 0.95, 0.93, 1.0)),
        (Vector((-0.05, 0.18, 0.66)), (0.20, 0.20, 0.16), (0.95, 0.97, 0.95, 1.0)),
        (Vector((0.06, -0.17, 0.64)), (0.20, 0.19, 0.16), (0.94, 0.96, 0.94, 1.0)),
        (Vector((0.01, 0.01, 0.86)), (0.21, 0.21, 0.16), (1.0, 1.0, 1.0, 1.0)),
    ]
    for i, (pos, sc, col) in enumerate(blobs):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.45)
        for v in bm.verts:
            v.co = Vector((v.co.x * sc[0], v.co.y * sc[1], v.co.z * sc[2])) + pos
        set_bm_vertex_color(bm, col)
        objs.append(create_mesh_obj(f"tree_blob_{i}", bm, mat))

    obj = join_and_bake(objs, "tree", mat, subsurf_levels=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 2. PINE: Pino redondeado estilizado
# ---------------------------------------------------------------------------
def build_pine(mat):
    objs = []
    trunk = make_lathe([(0.0, 0.0), (0.095, 0.0), (0.065, 0.08), (0.055, 0.30), (0.0, 0.30)], segs=6, col_bot=(0.78, 0.77, 0.75, 1.0), col_top=(0.84, 0.83, 0.82, 1.0))
    objs.append(create_mesh_obj("pine_trunk", trunk, mat))

    tiers = [
        (0.20, 0.54, 0.31, 0.88),
        (0.42, 0.76, 0.24, 0.94),
        (0.64, 1.00, 0.17, 1.00),
    ]
    for i, (z0, z1, rmax, cval) in enumerate(tiers):
        prof = [
            (0.0, z0 + 0.02),
            (rmax * 0.85, z0),
            (rmax, z0 + (z1 - z0) * 0.16),
            (rmax * 0.65, z0 + (z1 - z0) * 0.58),
            (rmax * 0.20, z1 - 0.03),
            (0.0, z1),
        ]
        bm = make_lathe(prof, segs=6, col_bot=(cval - 0.05, cval - 0.04, cval - 0.05, 1.0), col_top=(cval, cval, cval, 1.0))
        # Ondulación suave en el borde inferior
        for v in bm.verts:
            if abs(v.co.z - z0) < 0.05 and v.co.xy.length > rmax * 0.5:
                ang = math.atan2(v.co.y, v.co.x)
                v.co.z += 0.015 * math.sin(ang * 5.0)
        objs.append(create_mesh_obj(f"pine_tier_{i}", bm, mat))

    obj = join_and_bake(objs, "pine", mat, subsurf_levels=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 3. MUSHROOM: Hongo con sombrero y laminillas
# ---------------------------------------------------------------------------
def build_mushroom(mat):
    objs = []
    # Tallo orgánico ligeramente curvo
    stem_pts = [
        Vector((0.0, 0.0, 0.0)),
        Vector((0.0, 0.0, 0.04)),
        Vector((0.02, 0.01, 0.22)),
        Vector((0.01, 0.0, 0.44)),
        Vector((0.0, 0.0, 0.64)),
    ]
    stem_r = [0.16, 0.15, 0.11, 0.095, 0.12]
    objs.append(create_mesh_obj("mush_stem", make_tube_chain(stem_pts, stem_r, segs=10, col_bot=(0.88, 0.87, 0.85, 1.0), col_top=(0.95, 0.94, 0.92, 1.0)), mat))

    # Sombrero abombado
    cap_prof = [
        (0.0, 0.56),
        (0.16, 0.54),
        (0.34, 0.50),
        (0.42, 0.52),
        (0.45, 0.58),
        (0.40, 0.72),
        (0.28, 0.88),
        (0.14, 0.97),
        (0.0, 1.00),
    ]
    bm_cap = make_lathe(cap_prof, segs=16, col_bot=(0.90, 0.90, 0.90, 1.0), col_top=(1.0, 1.0, 1.0, 1.0))
    objs.append(create_mesh_obj("mush_cap", bm_cap, mat))

    # Laminillas radiales bajo el sombrero
    num_gills = 12
    for i in range(num_gills):
        ang = (2.0 * math.pi * i) / num_gills
        bm_g = bmesh.new()
        bmesh.ops.create_cube(bm_g, size=1.0)
        for v in bm_g.verts:
            x_loc = 0.13 + (v.co.x + 0.5) * 0.26
            y_loc = v.co.y * 0.018
            z_loc = 0.525 + v.co.z * 0.045
            ca, sa = math.cos(ang), math.sin(ang)
            v.co = Vector((x_loc * ca - y_loc * sa, x_loc * sa + y_loc * ca, z_loc))
        set_bm_vertex_color(bm_g, (0.82, 0.81, 0.80, 1.0))
        objs.append(create_mesh_obj(f"mush_gill_{i}", bm_g, mat))

    # Manchas sutiles en relieve sobre el sombrero
    spots = [
        (0.18, 0.12, 0.84, 0.075),
        (-0.20, 0.08, 0.82, 0.070),
        (0.05, -0.22, 0.80, 0.068),
        (-0.08, 0.24, 0.77, 0.060),
        (0.24, -0.14, 0.74, 0.058),
    ]
    for i, (sx, sy, sz, sr) in enumerate(spots):
        bm_s = bmesh.new()
        bmesh.ops.create_icosphere(bm_s, subdivisions=1, radius=sr)
        nrm = Vector((sx, sy, sz - 0.58)).normalized()
        for v in bm_s.verts:
            v.co = Vector((sx, sy, sz)) + v.co * 0.9 - nrm * (sr * 0.45)
        set_bm_vertex_color(bm_s, (1.0, 1.0, 1.0, 1.0))
        objs.append(create_mesh_obj(f"mush_spot_{i}", bm_s, mat))

    obj = join_and_bake(objs, "mushroom", mat, subsurf_levels=1)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 4. CRYSTAL: Cristal prismático con puntas biseladas
# ---------------------------------------------------------------------------
def make_crystal_shard(radius, height, tilt_euler, offset_xy, col_bot, col_top):
    bm = bmesh.new()
    segs = 6
    b_ring = []
    m_ring = []
    t_ring = []
    z_mid = height * 0.74
    for s in range(segs):
        ang = (2.0 * math.pi * s) / segs
        ca, sa = math.cos(ang), math.sin(ang)
        b_ring.append(bm.verts.new(Vector((radius * ca, radius * sa, 0.0))))
        m_ring.append(bm.verts.new(Vector((radius * 0.92 * ca, radius * 0.92 * sa, z_mid))))
        t_ring.append(bm.verts.new(Vector((radius * 0.45 * ca, radius * 0.45 * sa, height * 0.90))))
    apex = bm.verts.new(Vector((0.0, 0.0, height)))
    base_c = bm.verts.new(Vector((0.0, 0.0, 0.0)))

    for s in range(segs):
        sn = (s + 1) % segs
        bm.faces.new((b_ring[s], b_ring[sn], m_ring[sn], m_ring[s]))
        bm.faces.new((m_ring[s], m_ring[sn], t_ring[sn], t_ring[s]))
        bm.faces.new((t_ring[s], t_ring[sn], apex))
        bm.faces.new((base_c, b_ring[sn], b_ring[s]))

    set_bm_height_gradient(bm, 0.0, height, col_bot, col_top)
    rot = Euler(tilt_euler, "XYZ").to_matrix().to_4x4()
    for v in bm.verts:
        v.co = (rot @ v.co) + Vector((offset_xy[0], offset_xy[1], 0.0))
    return bm


def build_crystal(mat):
    objs = []
    shards = [
        (0.14, 1.00, (0.04, -0.05, 0.2), (0.0, 0.0)),
        (0.10, 0.70, (0.28, 0.12, 1.1), (0.12, -0.05)),
        (0.09, 0.62, (-0.25, 0.20, 2.3), (-0.11, 0.08)),
        (0.08, 0.50, (0.18, -0.32, 3.8), (-0.06, -0.11)),
        (0.075, 0.44, (-0.34, -0.15, 5.0), (0.09, 0.11)),
    ]
    for i, (r, h, tilt, off) in enumerate(shards):
        bm = make_crystal_shard(r, h, tilt, off, (0.84, 0.86, 0.90, 1.0), (1.0, 1.0, 1.0, 1.0))
        objs.append(create_mesh_obj(f"crystal_{i}", bm, mat))

    # Base de apoyo biselada
    bm_base = make_lathe([(0.0, 0.0), (0.24, 0.0), (0.22, 0.06), (0.14, 0.13), (0.0, 0.14)], segs=8, col_bot=(0.80, 0.82, 0.85, 1.0), col_top=(0.88, 0.90, 0.93, 1.0))
    objs.append(create_mesh_obj("crystal_base", bm_base, mat))

    obj = join_and_bake(objs, "crystal", mat, subsurf_levels=0, bevel_width=0.012, bevel_segments=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 5. ROCK: Roca redondeada orgánica
# ---------------------------------------------------------------------------
def build_rock(mat):
    objs = []
    stones = [
        (Vector((0.0, 0.0, 0.30)), (0.40, 0.32, 0.34), (0.12, -0.18, 0.35), (0.95, 0.95, 0.95, 1.0)),
        (Vector((0.26, 0.08, 0.18)), (0.24, 0.21, 0.20), (0.35, -0.25, 1.25), (0.90, 0.90, 0.90, 1.0)),
        (Vector((-0.24, -0.10, 0.16)), (0.22, 0.19, 0.18), (-0.25, 0.40, 2.50), (0.89, 0.89, 0.89, 1.0)),
    ]
    for i, (pos, sc, rot_e, col) in enumerate(stones):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        rot = Euler(rot_e, "XYZ").to_matrix()
        # Planos de corte suaves para crear facetas estilizadas de roca
        planes = [
            Vector((0.7, 0.5, 0.5)).normalized(),
            Vector((-0.6, 0.4, 0.7)).normalized(),
            Vector((0.2, -0.8, 0.5)).normalized(),
            Vector((-0.5, -0.5, -0.3)).normalized(),
        ]
        for idx, v in enumerate(bm.verts):
            p = v.co.copy()
            for pl in planes:
                d = p.dot(pl)
                if d > 0.68:
                    p -= pl * (d - 0.68) * 0.75
            n = 1.0 + 0.08 * math.sin(p.x * 4.2 + i) * math.cos(p.y * 3.7)
            p = Vector((p.x * sc[0] * n, p.y * sc[1] * n, p.z * sc[2] * n))
            p = rot @ p + pos
            p.z = max(0.0, p.z)
            v.co = p
        set_bm_height_gradient(bm, 0.0, 0.64, (0.83, 0.83, 0.83, 1.0), col)
        objs.append(create_mesh_obj(f"rock_{i}", bm, mat))

    obj = join_and_bake(objs, "rock", mat, subsurf_levels=1)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 6. FLOWER: Flor estilizada con tallo, hojas y pétalos
# ---------------------------------------------------------------------------
def build_flower(mat):
    objs = []
    # Tallo curvo
    stem_pts = [
        Vector((0.0, 0.0, 0.0)),
        Vector((0.02, 0.0, 0.20)),
        Vector((-0.02, 0.02, 0.44)),
        Vector((0.0, 0.03, 0.68)),
        Vector((0.0, 0.0, 0.78)),
    ]
    stem_r = [0.055, 0.040, 0.035, 0.032, 0.045]
    objs.append(create_mesh_obj("flower_stem", make_tube_chain(stem_pts, stem_r, segs=6, col_bot=(0.82, 0.85, 0.82, 1.0), col_top=(0.88, 0.90, 0.88, 1.0)), mat))

    # Dos hojas laterales (cubos -> Subsurf 2)
    for idx, (ang, hz, sc) in enumerate([(0.4, 0.26, 1.0), (3.5, 0.38, 0.85)]):
        bm_l = bmesh.new()
        bmesh.ops.create_cube(bm_l, size=1.45)
        ca, sa = math.cos(ang), math.sin(ang)
        for v in bm_l.verts:
            lx = (v.co.x + 1.0) * 0.13 * sc
            ly = v.co.y * 0.07 * sc
            lz = v.co.z * 0.022 * sc + math.sin((v.co.x + 1.0) * 1.3) * 0.04 * sc
            v.co = Vector((lx * ca - ly * sa, lx * sa + ly * ca, hz + lz))
        set_bm_vertex_color(bm_l, (0.86, 0.89, 0.86, 1.0))
        objs.append(create_mesh_obj(f"flower_leaf_{idx}", bm_l, mat))

    # Botón central
    bm_c = bmesh.new()
    bmesh.ops.create_cube(bm_c, size=0.16)
    for v in bm_c.verts:
        v.co.z = v.co.z * 0.65 + 0.83
    set_bm_vertex_color(bm_c, (0.90, 0.90, 0.86, 1.0))
    objs.append(create_mesh_obj("flower_center", bm_c, mat))

    # 6 pétalos redondeados en corola
    num_petals = 6
    for i in range(num_petals):
        ang = (2.0 * math.pi * i) / num_petals
        bm_p = bmesh.new()
        bmesh.ops.create_cube(bm_p, size=1.45)
        ca, sa = math.cos(ang), math.sin(ang)
        for v in bm_p.verts:
            px = 0.06 + (v.co.x + 1.0) * 0.14
            py = v.co.y * 0.105
            pz = v.co.z * 0.024 + (px - 0.06) * 0.38
            v.co = Vector((px * ca - py * sa, px * sa + py * ca, 0.81 + pz))
        set_bm_vertex_color(bm_p, (0.99, 0.99, 1.0, 1.0))
        objs.append(create_mesh_obj(f"flower_petal_{i}", bm_p, mat))

    obj = join_and_bake(objs, "flower", mat, subsurf_levels=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 7. CORAL: Coral ramificado orgánico
# ---------------------------------------------------------------------------
def build_coral(mat):
    objs = []
    branches = [
        ([Vector((0.0, 0.0, 0.0)), Vector((0.0, 0.0, 0.18)), Vector((0.02, 0.02, 0.45)), Vector((-0.02, 0.04, 0.78)), Vector((0.0, 0.02, 0.98))], [0.14, 0.10, 0.075, 0.06, 0.045]),
        ([Vector((0.0, 0.0, 0.22)), Vector((0.14, 0.08, 0.42)), Vector((0.22, 0.12, 0.68)), Vector((0.20, 0.10, 0.86))], [0.07, 0.055, 0.048, 0.040]),
        ([Vector((0.0, 0.0, 0.26)), Vector((-0.15, 0.06, 0.48)), Vector((-0.24, 0.04, 0.72))], [0.065, 0.050, 0.042]),
        ([Vector((0.02, 0.01, 0.36)), Vector((0.06, -0.16, 0.56)), Vector((0.08, -0.22, 0.78))], [0.058, 0.046, 0.038]),
        ([Vector((0.14, 0.08, 0.44)), Vector((0.26, -0.04, 0.60))], [0.042, 0.034]),
    ]
    for i, (pts, rads) in enumerate(branches):
        bm = make_tube_chain(pts, rads, segs=7, col_bot=(0.84, 0.84, 0.84, 1.0), col_top=(1.0, 1.0, 1.0, 1.0))
        objs.append(create_mesh_obj(f"coral_b_{i}", bm, mat))

    obj = join_and_bake(objs, "coral", mat, subsurf_levels=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 8. ICE_SPIRE: Aguja de hielo biselada
# ---------------------------------------------------------------------------
def build_ice_spire(mat):
    objs = []
    spires = [
        (0.16, 1.00, (0.02, -0.02, 0.0), (0.0, 0.0)),
        (0.10, 0.56, (0.18, 0.10, 0.8), (0.11, -0.06)),
        (0.09, 0.48, (-0.16, 0.14, 2.2), (-0.10, 0.07)),
        (0.08, 0.38, (0.08, -0.22, 4.1), (-0.05, -0.10)),
    ]
    for i, (r, h, tilt, off) in enumerate(spires):
        bm = bmesh.new()
        segs = 6
        rings = []
        levels = [(0.0, r), (h * 0.45, r * 0.72), (h * 0.82, r * 0.32)]
        for z, rad in levels:
            ring = []
            twist = z * 0.35
            for s in range(segs):
                ang = (2.0 * math.pi * s) / segs + twist
                ring.append(bm.verts.new(Vector((rad * math.cos(ang), rad * math.sin(ang), z))))
            rings.append(ring)
        apex = bm.verts.new(Vector((0.0, 0.0, h)))
        base_c = bm.verts.new(Vector((0.0, 0.0, 0.0)))

        for l in range(len(rings) - 1):
            for s in range(segs):
                sn = (s + 1) % segs
                bm.faces.new((rings[l][s], rings[l][sn], rings[l + 1][sn], rings[l + 1][s]))
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((rings[-1][s], rings[-1][sn], apex))
            bm.faces.new((base_c, rings[0][sn], rings[0][s]))

        set_bm_height_gradient(bm, 0.0, h, (0.84, 0.88, 0.93, 1.0), (1.0, 1.0, 1.0, 1.0))
        rot = Euler(tilt, "XYZ").to_matrix().to_4x4()
        for v in bm.verts:
            v.co = (rot @ v.co) + Vector((off[0], off[1], 0.0))
        objs.append(create_mesh_obj(f"ice_{i}", bm, mat))

    obj = join_and_bake(objs, "ice_spire", mat, subsurf_levels=0, bevel_width=0.010, bevel_segments=2)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 9. CACTUS: Cactus estilizado con costillas y brazos
# ---------------------------------------------------------------------------
def build_cactus(mat):
    objs = []

    def make_ribbed_limb(pts, rads, segs=12):
        bm = make_tube_chain(pts, rads, segs=segs, col_bot=(0.85, 0.88, 0.85, 1.0), col_top=(0.98, 0.99, 0.98, 1.0))
        # Modulación sutil de costillas cada 2 vértices
        for i, v in enumerate(bm.verts):
            ang = math.atan2(v.co.y, v.co.x)
            rib = 1.0 + 0.07 * math.cos(ang * 6.0)
            v.co.x *= rib
            v.co.y *= rib
        return bm

    trunk_pts = [Vector((0, 0, 0.0)), Vector((0, 0, 0.08)), Vector((0, 0, 0.50)), Vector((0, 0, 0.90)), Vector((0, 0, 0.98))]
    trunk_r = [0.13, 0.145, 0.14, 0.125, 0.05]
    objs.append(create_mesh_obj("cactus_trunk", make_ribbed_limb(trunk_pts, trunk_r, segs=12), mat))

    arm1_pts = [Vector((0.08, 0, 0.42)), Vector((0.24, 0, 0.44)), Vector((0.29, 0, 0.56)), Vector((0.29, 0, 0.74)), Vector((0.29, 0, 0.79))]
    arm1_r = [0.08, 0.085, 0.085, 0.08, 0.035]
    objs.append(create_mesh_obj("cactus_arm1", make_tube_chain(arm1_pts, arm1_r, segs=8, col_bot=(0.86, 0.89, 0.86, 1.0), col_top=(0.98, 0.99, 0.98, 1.0)), mat))

    arm2_pts = [Vector((-0.08, 0, 0.34)), Vector((-0.23, 0.02, 0.36)), Vector((-0.27, 0.02, 0.48)), Vector((-0.27, 0.02, 0.62)), Vector((-0.27, 0.02, 0.66))]
    arm2_r = [0.075, 0.08, 0.08, 0.075, 0.03]
    objs.append(create_mesh_obj("cactus_arm2", make_tube_chain(arm2_pts, arm2_r, segs=8, col_bot=(0.86, 0.89, 0.86, 1.0), col_top=(0.98, 0.99, 0.98, 1.0)), mat))

    # Pequeña corona/flor superior
    bm_top = bmesh.new()
    bmesh.ops.create_icosphere(bm_top, subdivisions=1, radius=0.055)
    for v in bm_top.verts:
        v.co.z = v.co.z * 0.6 + 0.99
    set_bm_vertex_color(bm_top, (1.0, 0.97, 0.98, 1.0))
    objs.append(create_mesh_obj("cactus_top", bm_top, mat))

    obj = join_and_bake(objs, "cactus", mat, subsurf_levels=1)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 10. LAMP: Farola estilizada
# ---------------------------------------------------------------------------
def build_lamp(mat):
    objs = []
    # Poste con pedestal moldurado
    post_prof = [
        (0.0, 0.0),
        (0.14, 0.0),
        (0.13, 0.04),
        (0.09, 0.08),
        (0.08, 0.14),
        (0.045, 0.18),
        (0.036, 0.50),
        (0.055, 0.52),
        (0.034, 0.54),
        (0.028, 0.80),
        (0.0, 0.82),
    ]
    objs.append(create_mesh_obj("lamp_post", make_lathe(post_prof, segs=12, col_bot=(0.82, 0.83, 0.85, 1.0), col_top=(0.92, 0.93, 0.95, 1.0)), mat))

    # Brazo curvo en cuello de cisne
    arm_pts = [
        Vector((0.0, 0.0, 0.78)),
        Vector((0.05, 0.0, 0.90)),
        Vector((0.14, 0.0, 0.96)),
        Vector((0.23, 0.0, 0.94)),
        Vector((0.26, 0.0, 0.87)),
    ]
    arm_r = [0.026, 0.022, 0.020, 0.018, 0.022]
    objs.append(create_mesh_obj("lamp_arm", make_tube_chain(arm_pts, arm_r, segs=8, col_bot=(0.88, 0.89, 0.91, 1.0), col_top=(0.94, 0.95, 0.96, 1.0)), mat))

    # Cúpula y luminaria
    head_prof = [
        (0.0, 0.72),
        (0.055, 0.75),
        (0.065, 0.81),
        (0.105, 0.83),
        (0.115, 0.85),
        (0.075, 0.88),
        (0.030, 0.90),
        (0.0, 0.90),
    ]
    bm_head = make_lathe(head_prof, segs=12, col_bot=(1.0, 1.0, 1.0, 1.0), col_top=(0.90, 0.91, 0.94, 1.0))
    for v in bm_head.verts:
        v.co.x += 0.26
    objs.append(create_mesh_obj("lamp_head", bm_head, mat))

    obj = join_and_bake(objs, "lamp", mat, subsurf_levels=1)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 11. PYLON: Pilón de celosía metálico
# ---------------------------------------------------------------------------
def make_strut(p0, p1, r, segs=6, col=(0.90, 0.91, 0.93, 1.0)):
    return make_tube_chain([p0, p1], [r, r], segs=segs, cap_ends=True, col_bot=col, col_top=col)


def build_pylon(mat):
    objs = []
    # Base hexagonal biselada
    pad = make_lathe([(0.0, 0.0), (0.38, 0.0), (0.36, 0.05), (0.31, 0.07), (0.0, 0.07)], segs=6, col_bot=(0.82, 0.83, 0.85, 1.0), col_top=(0.88, 0.89, 0.91, 1.0))
    objs.append(create_mesh_obj("pylon_pad", pad, mat))

    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    bot_r, mid_r, top_r = 0.25, 0.19, 0.14
    bot_p = [Vector((sx * bot_r, sy * bot_r, 0.05)) for sx, sy in corners]
    mid_p = [Vector((sx * mid_r, sy * mid_r, 0.50)) for sx, sy in corners]
    top_p = [Vector((sx * top_r, sy * top_r, 0.94)) for sx, sy in corners]

    for i in range(4):
        j = (i + 1) % 4
        # Patas principales
        objs.append(create_mesh_obj(f"pyl_leg_{i}", make_strut(bot_p[i], top_p[i], 0.026, 6, (0.92, 0.93, 0.95, 1.0)), mat))
        # Anillos horizontales
        objs.append(create_mesh_obj(f"pyl_bot_{i}", make_strut(bot_p[i], bot_p[j], 0.020, 6, (0.88, 0.89, 0.91, 1.0)), mat))
        objs.append(create_mesh_obj(f"pyl_mid_{i}", make_strut(mid_p[i], mid_p[j], 0.018, 6, (0.90, 0.91, 0.93, 1.0)), mat))
        objs.append(create_mesh_obj(f"pyl_top_{i}", make_strut(top_p[i], top_p[j], 0.022, 6, (0.94, 0.95, 0.97, 1.0)), mat))
        # Diagonales en celosía
        objs.append(create_mesh_obj(f"pyl_d1_{i}", make_strut(bot_p[i], mid_p[j], 0.013, 4, (0.88, 0.89, 0.91, 1.0)), mat))
        objs.append(create_mesh_obj(f"pyl_d2_{i}", make_strut(mid_p[i], top_p[j], 0.013, 4, (0.90, 0.91, 0.93, 1.0)), mat))

    # Cuna superior que abraza el tubo
    cradle_pts = [
        Vector((-0.24, 0.0, 1.00)),
        Vector((-0.14, 0.0, 0.94)),
        Vector((0.14, 0.0, 0.94)),
        Vector((0.24, 0.0, 1.00)),
    ]
    objs.append(create_mesh_obj("pyl_cradle", make_tube_chain(cradle_pts, [0.024, 0.028, 0.028, 0.024], segs=6, col_bot=(0.94, 0.95, 0.97, 1.0), col_top=(1.0, 1.0, 1.0, 1.0)), mat))

    obj = join_and_bake(objs, "pylon", mat, subsurf_levels=0, bevel_width=0.005, bevel_segments=1)
    normalize_vertical(obj)
    return obj


# ---------------------------------------------------------------------------
# 12. CLAMP: Abrazadera/anillo metálico de tubo (diámetro 1, ancho 0.15, eje Z_gltf = Y_blender)
# ---------------------------------------------------------------------------
def build_clamp(mat):
    objs = []
    # Anillo biselado alrededor de Z_blender y luego rotado 90° en X para que el eje sea Y_blender (= Z_gltf)
    prof = [
        (0.43, -0.068),
        (0.46, -0.075),
        (0.495, -0.045),
        (0.495, 0.045),
        (0.46, 0.075),
        (0.43, 0.068),
        (0.43, -0.068),
    ]
    bm_ring = make_lathe(prof, segs=32, col_bot=(0.90, 0.91, 0.94, 1.0), col_top=(0.96, 0.97, 0.99, 1.0))
    # Rotar para que el eje del anillo sea Y_blender (que en glTF +Y up será Z_gltf)
    rot_x = Matrix.Rotation(math.pi / 2.0, 4, "X")
    for v in bm_ring.verts:
        v.co = rot_x @ v.co
    objs.append(create_mesh_obj("clamp_ring", bm_ring, mat))

    # 8 tornillos / pernos radiales biselados alrededor del anillo (simetría exacta X/Y)
    for i in range(8):
        ang = (2.0 * math.pi * i) / 8.0
        bm_bolt = make_lathe([(0.0, -0.025), (0.032, -0.025), (0.032, 0.015), (0.022, 0.028), (0.0, 0.028)], segs=6, col_bot=(0.82, 0.84, 0.88, 1.0), col_top=(1.0, 1.0, 1.0, 1.0))
        # Orientar radialmente en el plano X-Z de Blender (que será X-Y en glTF)
        r_mat = Matrix.Rotation(ang, 4, "Y") @ Matrix.Rotation(math.pi / 2.0, 4, "X")
        pos = Vector((0.49 * math.sin(ang), 0.0, 0.49 * math.cos(ang)))
        for v in bm_bolt.verts:
            v.co = (r_mat @ v.co) + pos
        objs.append(create_mesh_obj(f"clamp_bolt_{i}", bm_bolt, mat))

    obj = join_and_bake(objs, "clamp", mat, subsurf_levels=0, bevel_width=0.006, bevel_segments=1)
    normalize_clamp(obj)
    return obj


# ---------------------------------------------------------------------------
# 13. POD: Cápsula / estación espacial estilizada
# ---------------------------------------------------------------------------
def build_pod(mat):
    objs = []
    # Cuerpo principal de la cápsula
    body_prof = [
        (0.0, 0.06),
        (0.20, 0.08),
        (0.29, 0.22),
        (0.32, 0.42),
        (0.30, 0.62),
        (0.22, 0.78),
        (0.11, 0.87),
        (0.0, 0.90),
    ]
    objs.append(create_mesh_obj("pod_body", make_lathe(body_prof, segs=16, col_bot=(0.88, 0.89, 0.92, 1.0), col_top=(0.98, 0.99, 1.0, 1.0)), mat))

    # Anillo ecuatorial
    ring_prof = [
        (0.30, 0.40),
        (0.35, 0.42),
        (0.35, 0.47),
        (0.30, 0.49),
    ]
    objs.append(create_mesh_obj("pod_ring", make_lathe(ring_prof, segs=16, col_bot=(0.82, 0.84, 0.88, 1.0), col_top=(0.88, 0.90, 0.94, 1.0)), mat))

    # Visor / escotilla frontal (orientado hacia -Y_blender = +Z_gltf frente)
    bm_vis = bmesh.new()
    bmesh.ops.create_icosphere(bm_vis, subdivisions=1, radius=1.0)
    for v in bm_vis.verts:
        v.co = Vector((v.co.x * 0.14, v.co.y * 0.08 - 0.27, v.co.z * 0.11 + 0.58))
    set_bm_vertex_color(bm_vis, (0.84, 0.88, 0.94, 1.0))
    objs.append(create_mesh_obj("pod_visor", bm_vis, mat))

    # 3 patas estabilizadoras
    for i in range(3):
        ang = (2.0 * math.pi * i) / 3.0 + math.pi / 6.0
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            Vector((0.24 * ca, 0.24 * sa, 0.24)),
            Vector((0.36 * ca, 0.36 * sa, 0.10)),
            Vector((0.38 * ca, 0.38 * sa, 0.0)),
        ]
        bm_leg = make_tube_chain(pts, [0.045, 0.040, 0.052], segs=6, col_bot=(0.82, 0.83, 0.86, 1.0), col_top=(0.90, 0.91, 0.94, 1.0))
        objs.append(create_mesh_obj(f"pod_leg_{i}", bm_leg, mat))

    # Antena superior
    ant_prof = [(0.0, 0.88), (0.025, 0.88), (0.015, 0.97), (0.032, 0.985), (0.0, 1.00)]
    objs.append(create_mesh_obj("pod_ant", make_lathe(ant_prof, segs=8, col_bot=(0.86, 0.88, 0.90, 1.0), col_top=(1.0, 1.0, 1.0, 1.0)), mat))

    obj = join_and_bake(objs, "pod", mat, subsurf_levels=1)
    normalize_vertical(obj)
    return obj


BUILDERS = [
    ("tree", build_tree, 0.65, 0.0),
    ("pine", build_pine, 0.65, 0.0),
    ("mushroom", build_mushroom, 0.50, 0.0),
    ("crystal", build_crystal, 0.22, 0.05),
    ("rock", build_rock, 0.78, 0.0),
    ("flower", build_flower, 0.48, 0.0),
    ("coral", build_coral, 0.58, 0.0),
    ("ice_spire", build_ice_spire, 0.18, 0.05),
    ("cactus", build_cactus, 0.62, 0.0),
    ("lamp", build_lamp, 0.38, 0.35),
    ("pylon", build_pylon, 0.35, 0.65),
    ("clamp", build_clamp, 0.30, 0.80),
    ("pod", build_pod, 0.32, 0.45),
]


def export_model(obj, filepath):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_vertex_color="MATERIAL",
    )


def validate_and_render_sheet(exported_paths):
    clear_scene()
    scene = bpy.context.scene

    # Configurar Cycles CPU rápido para hoja de contacto
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 920
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = SHEET_PATH

    # Fondo oscuro neutro para apreciar siluetas blancas/sutiles
    world = bpy.data.worlds.new("SheetWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.04, 0.05, 0.08, 1.0)
        bg.inputs[1].default_value = 0.7

    cols = 5
    spacing_x = 1.75
    spacing_y = 2.25

    imported_objs = []
    for idx, (name, glb_path) in enumerate(exported_paths):
        bpy.ops.import_scene.gltf(filepath=glb_path)
        meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
        assert len(meshes) == 1, f"{name}: se esperaba 1 mesh, hay {len(meshes)}"
        obj = meshes[0]
        tris = count_tris(obj)
        assert tris < MAX_TRIS, f"{name}: excede {MAX_TRIS} tris ({tris})"

        # Verificar bounding box en coordenadas de mundo (tras import glTF, Blender aplica rot X +90 al objeto o a la malla)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

        xs = [v.co.x for v in obj.data.vertices]
        ys = [v.co.y for v in obj.data.vertices]
        zs = [v.co.z for v in obj.data.vertices]
        print(
            f"[VALID] {name:10s} | tris={tris:4d} | "
            f"X=[{min(xs):+.3f},{max(xs):+.3f}] "
            f"Y_gltf=[{min(zs):+.3f},{max(zs):+.3f}] "
            f"Z_gltf=[{-max(ys):+.3f},{-min(ys):+.3f}]"
        )

        # Ubicar en la cuadrícula (en Blender, X e Y son el plano horizontal, Z es arriba)
        col_i = idx % cols
        row_i = idx // cols
        gx = (col_i - 2.0) * spacing_x
        gy = -(row_i - 1.0) * spacing_y
        if name == "clamp":
            obj.location = (gx, gy, 0.50)
        else:
            obj.location = (gx, gy, 0.0)
        imported_objs.append(obj)

        # Etiqueta de texto 3D debajo de cada modelo
        bpy.ops.object.text_add(location=(gx, gy - 0.58, 0.02))
        txt = bpy.context.active_object
        txt.data.body = name
        txt.data.size = 0.18
        txt.data.align_x = "CENTER"
        txt.rotation_euler = (math.radians(38.0), 0.0, 0.0)

    # Piso sutil
    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0.0, 0.0, -0.005))
    floor = bpy.context.active_object
    fmat = bpy.data.materials.new("FloorMat")
    fmat.use_nodes = True
    fmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.09, 0.11, 0.16, 1.0)
    fmat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    floor.data.materials.append(fmat)

    # Iluminación 3 puntos
    def add_light(name, ltype, loc, rot_deg, energy, color=(1, 1, 1)):
        ldata = bpy.data.lights.new(name=name, type=ltype)
        ldata.energy = energy
        ldata.color = color
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        lobj.location = loc
        lobj.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        scene.collection.objects.link(lobj)

    add_light("Key", "SUN", (4, -6, 8), (48, 12, 25), 2.8, (1.0, 0.98, 0.95))
    add_light("Fill", "SUN", (-6, -4, 4), (60, -20, -40), 1.0, (0.78, 0.88, 1.0))
    add_light("Rim", "SUN", (0, 6, 5), (-55, 0, 180), 1.2, (0.90, 0.95, 1.0))

    # Cámara ortográfica / telefoto inclinada para ver toda la cuadrícula claramente
    cam_data = bpy.data.cameras.new("SheetCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 9.8
    cam_obj = bpy.data.objects.new("SheetCam", cam_data)
    cam_obj.location = (0.0, -8.5, 6.2)
    direction = Vector((0.0, 0.0, 0.35)) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    bpy.ops.render.render(write_still=True)
    print(f"[SHEET] Renderizado en {SHEET_PATH}")


def main():
    ensure_dirs()
    exported = []
    for name, builder, rough, metal in BUILDERS:
        clear_scene()
        mat = make_neutral_material(f"Mat_{name}", roughness=rough, metallic=metal)
        obj = builder(mat)
        tris = count_tris(obj)
        glb_path = os.path.join(MODELS_DIR, f"{name}.glb")
        export_model(obj, glb_path)
        size_kb = os.path.getsize(glb_path) / 1024.0
        print(f"[EXPORT] {name:10s} -> {tris:4d} tris, {size_kb:5.1f} KB")
        exported.append((name, glb_path))

    validate_and_render_sheet(exported)


if __name__ == "__main__":
    main()
