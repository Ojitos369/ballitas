import json
import math
import os
import sys
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'kit')
TEX = os.path.join(ROOT, 'public', 'tex', 'kit')

THEMES = [
    'sombrio', 'bosque', 'mar', 'desierto', 'hielo',
    'volcan', 'cristal', 'nubes', 'neon', 'jardin',
]

LOD_TARGETS = {
    'anillo_neon': 192, 'tunel_arco': 160, 'bordillo': 120,
    'barrera': 120, 'caja_evento': 160, 'caja_cambio': 160,
}


def mat(name, tx, em=False, em_str=1.2, rough=0.45, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    img_path = os.path.join(TEX, tx + '.webp')
    im = bpy.data.images.load(img_path, check_existing=True)
    im.pack()
    q = nt.nodes.new('ShaderNodeTexImage')
    q.image = im
    nt.links.new(q.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        bs.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
    if em:
        nt.links.new(q.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = em_str
    return m


def _apply_smooth_and_bevel(o, bevel_w=0.0, bevel_seg=1):
    if bevel_w > 0:
        b = o.modifiers.new('Bisel', 'BEVEL')
        b.width = bevel_w
        b.segments = bevel_seg
        b.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _place(o, rot=(0.0, 0.0, 0.0), scale=None):
    if scale is not None:
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if any(rot):
        o.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def cube(pos, dim, ma, rot=(0.0, 0.0, 0.0), bev=0.025, bev_seg=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    _place(o, rot=rot, scale=dim)
    _apply_smooth_and_bevel(o, bevel_w=bev, bevel_seg=bev_seg)
    o.data.materials.append(ma)
    return o


def cyl(pos, r, d, ma, v=16, r2=None, rot=(0.0, 0.0, 0.0), bev=0.0):
    bpy.ops.mesh.primitive_cone_add(
        vertices=v,
        radius1=r,
        radius2=r if r2 is None else r2,
        depth=d,
        location=pos,
    )
    o = bpy.context.object
    _place(o, rot=rot)
    _apply_smooth_and_bevel(o, bevel_w=bev, bevel_seg=1)
    o.data.materials.append(ma)
    return o


def ball(pos, sc, ma, seg=16, rings=10, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=rings, radius=1, location=pos
    )
    o = bpy.context.object
    _place(o, rot=rot, scale=sc)
    _apply_smooth_and_bevel(o)
    o.data.materials.append(ma)
    return o


def tor(pos, R, r, ma, maj=24, min_seg=10, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=R,
        minor_radius=r,
        major_segments=maj,
        minor_segments=min_seg,
        location=pos,
    )
    o = bpy.context.object
    _place(o, rot=rot)
    _apply_smooth_and_bevel(o)
    o.data.materials.append(ma)
    return o


# ---------- Piezas comunes ----------

def build_anillo_neon(mats):
    # Aro vertical mirando hacia +/-Y (eje Z en Three.js), diámetro interior = 1.0
    m_white = mats['anillo']
    m_dark = mats['metal_oscuro']
    m_rivet = mats['metal_cian']
    R = 0.56
    r_core = 0.06  # interior = 2*(0.56 - 0.06) = 1.00
    cz = 0.66
    objs = [
        tor((0, 0, cz), R, r_core, m_white, maj=24, min_seg=8, rot=(math.pi / 2, 0, 0)),
    ]
    # Carcasa exterior segmentada tipo arco de luces (8 abrazaderas con remaches)
    for i in range(8):
        ang = i * math.tau / 8.0
        px = (R + 0.025) * math.cos(ang)
        pz = cz + (R + 0.025) * math.sin(ang)
        objs.append(cube((px, 0, pz), (0.14, 0.19, 0.16), m_dark, rot=(0, -ang, 0), bev=0.0))
        rx = (R + 0.095) * math.cos(ang)
        rz = cz + (R + 0.095) * math.sin(ang)
        objs.append(cyl((rx, 0, rz), 0.03, 0.03, m_rivet, v=6, rot=(0, -ang + math.pi / 2, 0)))
    # Soportes inferiores robustos
    for sx in (-0.36, 0.36):
        objs.append(cube((sx, 0, 0.09), (0.22, 0.28, 0.18), m_dark, bev=0.015))
        objs.append(cyl((sx, 0, 0.22), 0.07, 0.14, m_rivet, v=10))
    return objs


def build_caja_evento(mats):
    # Caja flotante translúcida brillante con estrella de 4 puntas en las caras
    m_glass = mats['vidrio_violeta']
    m_star = mats['vidrio_dorado']
    m_frame = mats['metal_cian']
    objs = [
        # Sombra/base flotante sutil abajo para origen y=0
        cyl((0, 0, 0.02), 0.24, 0.04, m_frame, v=16, r2=0.18),
        # Cubo flotante principal translúcido
        cube((0, 0, 0.46), (0.64, 0.64, 0.64), m_glass, bev=0.05, bev_seg=2),
    ]
    # Estrella de 4 puntas afilada en cada cara lateral y arriba
    # (pos, rot_para_apuntar_al_eje_de_la_cara)
    for sx, sy, rx, ry, rz in (
        (0, -0.33, 0, 0, 0),
        (0, 0.33, 0, 0, math.pi),
        (-0.33, 0, 0, 0, -math.pi / 2),
        (0.33, 0, 0, 0, math.pi / 2),
    ):
        # Centro rombo + 4 puntas cónicas en plano XZ local
        objs.append(cube((sx, sy, 0.46), (0.14, 0.04, 0.14), m_star, rot=(0, math.pi / 4, rz), bev=0.0))
        for dx, dz, ang_p in ((0, 0.12, 0), (0, -0.12, math.pi), (0.12, 0, -math.pi / 2), (-0.12, 0, math.pi / 2)):
            # rotar (dx, 0, dz) alrededor de Z por rz
            wx = sx + dx * math.cos(rz)
            wy = sy + dx * math.sin(rz)
            objs.append(cyl((wx, wy, 0.46 + dz), 0.06, 0.16, m_star, v=4, r2=0.005, rot=(0, ang_p, rz)))
    # Estrella superior
    objs.append(cube((0, 0, 0.79), (0.14, 0.14, 0.04), m_star, rot=(0, 0, math.pi / 4), bev=0.0))
    for dx, dy, rx, ry in ((0, 0.12, -math.pi / 2, 0), (0, -0.12, math.pi / 2, 0), (0.12, 0, 0, math.pi / 2), (-0.12, 0, 0, -math.pi / 2)):
        objs.append(cyl((dx, dy, 0.79), 0.06, 0.16, m_star, v=4, r2=0.005, rot=(rx, ry, 0)))
    return objs


def build_caja_cambio(mats):
    # Cajón con rayas de advertencia amarillo/negro y un rayo propio en relieve
    m_warn = mats['rayas_amarillas']
    m_dark = mats['metal_oscuro']
    m_bolt = mats['vidrio_dorado']
    objs = [
        cube((0, 0, 0.34), (0.68, 0.68, 0.68), m_warn, bev=0.03, bev_seg=2),
        # Marcos superior e inferior oscuros
        cube((0, 0, 0.06), (0.72, 0.72, 0.12), m_dark, bev=0.015),
        cube((0, 0, 0.62), (0.72, 0.72, 0.12), m_dark, bev=0.015),
    ]
    # Rayo dorado brillante en relieve en frente, atrás y arriba
    for sy, rot_z in ((-0.35, 0.0), (0.35, math.pi)):
        objs.append(cube((0.05, sy, 0.46), (0.14, 0.05, 0.24), m_bolt, rot=(0, -0.5, rot_z), bev=0.008))
        objs.append(cube((0.0, sy, 0.34), (0.28, 0.05, 0.10), m_bolt, rot=(0, 0.08, rot_z), bev=0.008))
        objs.append(cube((-0.05, sy, 0.22), (0.14, 0.05, 0.24), m_bolt, rot=(0, -0.5, rot_z), bev=0.008))
    objs.append(cube((0.05, 0.10, 0.70), (0.14, 0.22, 0.05), m_bolt, rot=(0, 0, -0.5), bev=0.008))
    objs.append(cube((0.0, 0.0, 0.70), (0.26, 0.10, 0.05), m_bolt, rot=(0, 0, 0.08), bev=0.008))
    objs.append(cube((-0.05, -0.10, 0.70), (0.14, 0.22, 0.05), m_bolt, rot=(0, 0, -0.5), bev=0.008))
    return objs


def build_turbo_placa(mats):
    m_neon = mats['neon']
    m_base = mats['metal_azul']
    m_arrow = mats['metal_amarillo']
    objs = [
        cube((0, 0, 0.06), (1.0, 0.72, 0.12), m_base, bev=0.02, bev_seg=2),
        cube((0, 0, 0.13), (0.90, 0.62, 0.04), m_neon, bev=0.01),
    ]
    # Tres chevrones direccionales
    for y in (-0.18, 0.0, 0.18):
        objs.append(cube((-0.14, y, 0.16), (0.28, 0.07, 0.04), m_arrow, rot=(0, 0, 0.45), bev=0.008))
        objs.append(cube((0.14, y, 0.16), (0.28, 0.07, 0.04), m_arrow, rot=(0, 0, -0.45), bev=0.008))
    return objs


def build_barrera_o_bordillo(mats, is_barrier):
    m_main = mats['rayas_amarillas'] if is_barrier else mats['rayas_rojas']
    m_det = mats['metal_oscuro'] if is_barrier else mats['metal_cian']
    h = 0.44 if is_barrier else 0.28
    objs = [
        cube((0, 0, h / 2), (1.0, 0.56, h), m_main, bev=0.03, bev_seg=2),
        cube((0, 0, 0.04), (1.02, 0.60, 0.08), m_det, bev=0.015),
    ]
    for x in (-0.36, 0.0, 0.36):
        objs.append(cube((x, -0.29, h / 2 + 0.02), (0.10, 0.04, h * 0.65), m_det, bev=0.01))
    return objs


def build_arco_salida(mats):
    m_post = mats['metal_cian']
    m_top = mats['lona_roja']
    m_light = mats['neon']
    objs = []
    for sx in (-0.42, 0.42):
        objs.append(cube((sx, 0, 0.07), (0.22, 0.24, 0.14), m_post, bev=0.02))
        objs.append(cyl((sx, 0, 0.50), 0.09, 0.78, m_post, v=14, r2=0.075, bev=0.0))
    objs.append(cube((0, 0, 0.90), (1.0, 0.22, 0.18), m_top, bev=0.02, bev_seg=1))
    for lx in (-0.26, 0.0, 0.26):
        objs.append(ball((lx, -0.11, 0.90), (0.055, 0.035, 0.055), m_light, seg=10, rings=6))
    return objs


def build_tunel_arco(mats):
    m_shell = mats['metal_azul']
    m_neon = mats['neon']
    objs = []
    # Bases laterales
    for sx in (-0.45, 0.45):
        objs.append(cube((sx, 0, 0.07), (0.18, 0.28, 0.14), m_shell, bev=0.02))
    # Costillas continuas formando arco suave
    steps = 9
    for i in range(steps):
        ang = math.pi * i / (steps - 1)
        px = 0.44 * math.cos(ang)
        pz = 0.12 + 0.46 * math.sin(ang)
        objs.append(cube((px, 0, pz), (0.16, 0.24, 0.19), m_shell, rot=(0, ang - math.pi / 2, 0), bev=0.02))
    # Tira neón interior
    for i in range(7):
        ang = math.pi * (i + 1) / 8.0
        px = 0.36 * math.cos(ang)
        pz = 0.12 + 0.38 * math.sin(ang)
        objs.append(cube((px, 0, pz), (0.06, 0.26, 0.10), m_neon, rot=(0, ang - math.pi / 2, 0), bev=0.008))
    return objs


def build_pilar(mats):
    m_body = mats['metal_azul']
    m_trim = mats['metal_cian']
    return [
        cube((0, 0, 0.08), (0.56, 0.56, 0.16), m_body, bev=0.025, bev_seg=2),
        cyl((0, 0, 0.21), 0.22, 0.10, m_trim, v=16, r2=0.18, bev=0.01),
        cyl((0, 0, 0.52), 0.15, 0.56, m_body, v=16, r2=0.14, bev=0.01),
        cyl((0, 0, 0.80), 0.20, 0.08, m_trim, v=16, r2=0.22, bev=0.01),
        cube((0, 0, 0.90), (0.52, 0.52, 0.14), m_body, bev=0.025, bev_seg=2),
    ]


def build_banderin(mats):
    m_pole = mats['metal_cian']
    m_flag = mats['lona_roja']
    m_gold = mats['metal_amarillo']
    return [
        cyl((0, 0, 0.06), 0.22, 0.12, m_pole, v=16, r2=0.18, bev=0.015),
        cyl((0, 0, 0.52), 0.075, 0.84, m_pole, v=14, r2=0.06),
        ball((0, 0, 0.96), (0.09, 0.09, 0.09), m_gold, seg=12, rings=8),
        # Bandera ondulada con volumen
        cube((0.18, 0.0, 0.78), (0.28, 0.05, 0.26), m_flag, rot=(0, 0, 0.12), bev=0.015),
        cube((0.39, 0.03, 0.77), (0.22, 0.05, 0.22), m_flag, rot=(0, 0, -0.18), bev=0.015),
    ]


def build_farola_pista(mats):
    m_pole = mats['metal_azul']
    m_head = mats['metal_amarillo']
    m_glow = mats['neon']
    return [
        cyl((0, 0, 0.07), 0.20, 0.14, m_pole, v=16, r2=0.15, bev=0.015),
        cyl((0, 0, 0.46), 0.08, 0.68, m_pole, v=14, r2=0.065),
        # Brazo superior inclinado
        cube((0.10, 0, 0.84), (0.28, 0.12, 0.11), m_pole, rot=(0, -0.25, 0), bev=0.015),
        # Cabeza de farola y foco emisivo
        cube((0.24, 0, 0.89), (0.30, 0.24, 0.14), m_head, bev=0.025, bev_seg=2),
        ball((0.26, 0, 0.80), (0.11, 0.09, 0.06), m_glow, seg=12, rings=8),
    ]


# ---------- Rebotes por bioma (10) ----------

def build_rebote(tema, mats):
    m_main = mats['main']
    m_det = mats['det']
    m_pad = mats['pad']

    if tema == 'bosque':
        # Hongo trampolín clásico
        objs = [
            cyl((0, 0, 0.20), 0.20, 0.40, m_det, v=14, r2=0.15, bev=0.01),
            tor((0, 0, 0.34), 0.17, 0.035, m_det, maj=14, min_seg=6),
            ball((0, 0, 0.46), (0.44, 0.44, 0.22), m_main, seg=14, rings=8),
        ]
        for a in range(5):
            ang = a * math.tau / 5.0
            objs.append(ball((0.24 * math.cos(ang), 0.24 * math.sin(ang), 0.56), (0.075, 0.075, 0.04), m_det, seg=8, rings=5))
        return objs

    if tema == 'desierto':
        # Cactus cojín con flor trampolín arriba
        return [
            cyl((0, 0, 0.32), 0.22, 0.64, m_main, v=16, r2=0.20, bev=0.02),
            cyl((-0.26, 0, 0.34), 0.10, 0.30, m_main, v=12, r2=0.09, bev=0.015),
            cyl((0.26, 0, 0.38), 0.10, 0.34, m_main, v=12, r2=0.09, bev=0.015),
            ball((0, 0, 0.64), (0.28, 0.28, 0.11), m_pad, seg=16, rings=8),
        ]

    if tema == 'mar':
        # Almeja abierta con cojín perlado brillante
        return [
            ball((0, 0, 0.10), (0.42, 0.38, 0.10), m_det, seg=16, rings=8),
            ball((0, 0, 0.22), (0.34, 0.30, 0.12), m_pad, seg=16, rings=8),
            cube((0, 0.30, 0.36), (0.56, 0.10, 0.38), m_main, rot=(-0.45, 0, 0), bev=0.03, bev_seg=2),
        ]

    if tema == 'hielo':
        # Cojín de hielo octogonal con picos en el borde
        objs = [
            cyl((0, 0, 0.10), 0.44, 0.20, m_det, v=12, r2=0.40, bev=0.02),
            cyl((0, 0, 0.24), 0.38, 0.12, m_main, v=16, r2=0.34, bev=0.025),
        ]
        for i in range(6):
            ang = i * math.tau / 6.0
            objs.append(cyl((0.40 * math.cos(ang), 0.40 * math.sin(ang), 0.22), 0.08, 0.26, m_det, v=8, r2=0.01))
        return objs

    if tema == 'volcan':
        # Cráter volcánico con burbuja de magma trampolín
        return [
            cyl((0, 0, 0.16), 0.46, 0.32, m_main, v=14, r2=0.34, bev=0.02),
            tor((0, 0, 0.32), 0.30, 0.06, m_det, maj=18, min_seg=8),
            ball((0, 0, 0.32), (0.28, 0.28, 0.14), m_pad, seg=16, rings=8),
        ]

    if tema == 'cristal':
        # Plataforma geoda con gema hexagonal plana
        objs = [
            cyl((0, 0, 0.10), 0.42, 0.20, m_det, v=10, r2=0.36, bev=0.02),
            cyl((0, 0, 0.25), 0.34, 0.14, m_main, v=8, r2=0.30, bev=0.02),
        ]
        for i in range(4):
            ang = i * math.tau / 4.0 + 0.4
            objs.append(cyl((0.36 * math.cos(ang), 0.36 * math.sin(ang), 0.20), 0.09, 0.28, m_main, v=6, r2=0.01, rot=(0.25 * math.sin(ang), -0.25 * math.cos(ang), 0)))
        return objs

    if tema == 'nubes':
        # Nube esponjosa sosteniendo un cojín trampolín
        return [
            ball((-0.22, -0.10, 0.16), (0.24, 0.22, 0.16), m_det, seg=10, rings=6),
            ball((0.22, -0.10, 0.16), (0.24, 0.22, 0.16), m_det, seg=10, rings=6),
            ball((0.0, 0.18, 0.18), (0.26, 0.24, 0.17), m_det, seg=10, rings=6),
            cyl((0, 0, 0.32), 0.34, 0.14, m_main, v=16, r2=0.32, bev=0.02),
            tor((0, 0, 0.38), 0.28, 0.04, m_pad, maj=16, min_seg=6),
        ]

    if tema == 'neon':
        # Pad sci-fi con aro luminoso
        return [
            cyl((0, 0, 0.08), 0.46, 0.16, m_det, v=12, r2=0.42, bev=0.02),
            cyl((0, 0, 0.18), 0.36, 0.08, m_main, v=18, r2=0.34, bev=0.015),
            tor((0, 0, 0.23), 0.28, 0.045, m_pad, maj=20, min_seg=8),
        ]

    if tema == 'jardin':
        # Flor trampolín gigante de 6 pétalos anchos y centro acolchado
        objs = [
            cyl((0, 0, 0.18), 0.12, 0.36, m_det, v=12, r2=0.09),
            ball((0, 0, 0.38), (0.18, 0.18, 0.10), m_pad, seg=12, rings=6),
        ]
        for i in range(6):
            ang = i * math.tau / 6.0
            objs.append(ball((0.26 * math.cos(ang), 0.26 * math.sin(ang), 0.35), (0.16, 0.13, 0.06), m_main, seg=10, rings=5, rot=(0, 0, ang)))
        return objs

    # sombrio: caldero/pedestal oscuro con domo espectral brillante
    return [
        cyl((0, 0, 0.16), 0.36, 0.32, m_main, v=14, r2=0.32, bev=0.02),
        tor((0, 0, 0.32), 0.31, 0.05, m_det, maj=18, min_seg=8),
        ball((0, 0, 0.33), (0.28, 0.28, 0.16), m_pad, seg=16, rings=8),
    ]


# ---------- Decoración por bioma (20) ----------

def build_deco(tema, variante, mats):
    m_main = mats['main']
    m_det = mats['det']
    m_extra = mats['extra']

    if tema == 'bosque':
        if variante == 'hito':
            # Tronco con hongos laterales
            return [
                cyl((0, 0, 0.36), 0.26, 0.72, m_main, v=14, r2=0.19, bev=0.02),
                cyl((0.18, 0.10, 0.14), 0.12, 0.28, m_main, v=10, r2=0.07, rot=(0.3, 0.4, 0)),
                ball((-0.24, -0.08, 0.42), (0.14, 0.14, 0.07), m_det, seg=12, rings=6),
                ball((0.20, -0.14, 0.26), (0.11, 0.11, 0.06), m_det, seg=10, rings=6),
            ]
        # flora: helecho frondoso radial
        objs = [cyl((0, 0, 0.08), 0.12, 0.16, m_det, v=10, r2=0.08)]
        for i in range(6):
            ang = i * math.tau / 6.0
            objs.append(cube((0.22 * math.cos(ang), 0.22 * math.sin(ang), 0.24), (0.34, 0.12, 0.04), m_main, rot=(0, -0.45, ang), bev=0.01))
        return objs

    if tema == 'mar':
        if variante == 'hito':
            # Boya marítima con flotador, estructura y faro
            return [
                tor((0, 0, 0.10), 0.28, 0.10, m_det, maj=18, min_seg=8),
                cyl((0, 0, 0.38), 0.16, 0.44, m_main, v=12, r2=0.10, bev=0.015),
                ball((0, 0, 0.64), (0.10, 0.10, 0.10), m_extra, seg=12, rings=8),
            ]
        # flora: coral ramificado
        return [
            cyl((0, 0, 0.14), 0.22, 0.28, m_main, v=12, r2=0.14, bev=0.015),
            cyl((-0.14, 0, 0.42), 0.08, 0.44, m_det, v=10, r2=0.06, rot=(0, -0.35, 0), bev=0.01),
            cyl((0.14, 0.08, 0.46), 0.08, 0.48, m_det, v=10, r2=0.05, rot=(0.2, 0.35, 0), bev=0.01),
            cyl((0.02, -0.14, 0.38), 0.07, 0.36, m_main, v=10, r2=0.05, rot=(-0.3, 0.1, 0), bev=0.01),
        ]

    if tema == 'desierto':
        if variante == 'hito':
            # Roca arco del desierto
            return [
                cyl((-0.30, 0, 0.28), 0.16, 0.56, m_main, v=12, r2=0.12, rot=(0, 0.15, 0), bev=0.02),
                cyl((0.30, 0, 0.28), 0.16, 0.56, m_main, v=12, r2=0.12, rot=(0, -0.15, 0), bev=0.02),
                cube((0, 0, 0.56), (0.72, 0.24, 0.16), m_main, bev=0.03, bev_seg=2),
            ]
        # flora: jarrón de cerámica con cuello y tapa/suculenta
        return [
            cyl((0, 0, 0.06), 0.18, 0.12, m_det, v=14, r2=0.22, bev=0.01),
            ball((0, 0, 0.30), (0.28, 0.28, 0.24), m_main, seg=16, rings=10),
            cyl((0, 0, 0.54), 0.12, 0.16, m_main, v=14, r2=0.16, bev=0.015),
            tor((0, 0, 0.62), 0.15, 0.035, m_det, maj=16, min_seg=8),
        ]

    if tema == 'hielo':
        if variante == 'hito':
            # Estalagmita de hielo
            return [
                cyl((0, 0, 0.42), 0.26, 0.84, m_main, v=8, r2=0.03, bev=0.015),
                cyl((-0.20, 0.08, 0.26), 0.15, 0.52, m_det, v=7, r2=0.02, rot=(0, -0.2, 0)),
                cyl((0.18, -0.10, 0.22), 0.13, 0.44, m_det, v=7, r2=0.02, rot=(0, 0.22, 0)),
            ]
        # flora: muñeco de nieve con sombrero
        return [
            ball((0, 0, 0.20), (0.28, 0.28, 0.22), m_main, seg=14, rings=8),
            ball((0, 0, 0.48), (0.21, 0.21, 0.18), m_main, seg=14, rings=8),
            ball((0, 0, 0.70), (0.14, 0.14, 0.14), m_main, seg=14, rings=8),
            cyl((0, 0, 0.82), 0.18, 0.04, m_det, v=14),
            cyl((0, 0, 0.90), 0.11, 0.14, m_det, v=14),
            cyl((0, -0.16, 0.70), 0.03, 0.12, m_extra, v=8, r2=0.005, rot=(math.pi / 2, 0, 0)),
        ]

    if tema == 'volcan':
        if variante == 'hito':
            # Chimenea volcánica humeante
            return [
                cyl((0, 0, 0.34), 0.34, 0.68, m_main, v=12, r2=0.18, bev=0.02),
                tor((0, 0, 0.68), 0.16, 0.045, m_det, maj=14, min_seg=8),
                ball((0, 0, 0.84), (0.14, 0.14, 0.10), m_extra, seg=10, rings=6),
            ]
        # flora: roca escarpada con grietas de lava brillante
        return [
            cyl((0, 0, 0.24), 0.34, 0.48, m_main, v=7, r2=0.18, bev=0.02),
            cyl((-0.14, 0.08, 0.18), 0.22, 0.36, m_main, v=6, r2=0.10, rot=(0.2, -0.25, 0)),
            cube((0.0, -0.04, 0.28), (0.56, 0.12, 0.22), m_extra, rot=(0.15, 0.35, 0.4), bev=0.01),
            cube((0.04, 0.04, 0.24), (0.12, 0.52, 0.20), m_det, rot=(-0.2, 0.1, -0.5), bev=0.01),
        ]

    if tema == 'cristal':
        if variante == 'hito':
            # Monolito / prisma alto en base
            return [
                cyl((0, 0, 0.08), 0.30, 0.16, m_det, v=8, r2=0.26, bev=0.015),
                cyl((0, 0, 0.48), 0.16, 0.72, m_main, v=6, r2=0.02, bev=0.01),
            ]
        # flora: racimo de prismas
        return [
            cyl((0, 0, 0.36), 0.15, 0.72, m_main, v=6, r2=0.02),
            cyl((-0.18, 0.06, 0.26), 0.11, 0.52, m_main, v=6, r2=0.02, rot=(0.15, -0.35, 0)),
            cyl((0.18, -0.08, 0.24), 0.10, 0.48, m_det, v=6, r2=0.02, rot=(-0.2, 0.35, 0)),
            cyl((0.04, 0.18, 0.20), 0.09, 0.40, m_det, v=6, r2=0.02, rot=(-0.3, 0, 0)),
        ]

    if tema == 'nubes':
        if variante == 'hito':
            # Globo aerostático pequeño con canasta
            return [
                cube((0, 0, 0.10), (0.22, 0.22, 0.18), m_det, bev=0.02),
                cyl((-0.09, -0.09, 0.28), 0.015, 0.24, m_det, v=6),
                cyl((0.09, -0.09, 0.28), 0.015, 0.24, m_det, v=6),
                ball((0, 0, 0.62), (0.30, 0.30, 0.34), m_main, seg=16, rings=10),
            ]
        # flora: nube con escalera
        return [
            ball((-0.16, 0, 0.24), (0.26, 0.22, 0.18), m_main, seg=12, rings=8),
            ball((0.16, 0, 0.26), (0.28, 0.24, 0.20), m_main, seg=12, rings=8),
            ball((0.0, 0, 0.38), (0.24, 0.20, 0.18), m_main, seg=12, rings=8),
            cube((-0.10, -0.24, 0.26), (0.04, 0.04, 0.52), m_det, rot=(-0.35, 0, 0), bev=0.005),
            cube((0.10, -0.24, 0.26), (0.04, 0.04, 0.52), m_det, rot=(-0.35, 0, 0), bev=0.005),
            cube((0.0, -0.21, 0.18), (0.22, 0.04, 0.04), m_det, bev=0.005),
            cube((0.0, -0.27, 0.34), (0.22, 0.04, 0.04), m_det, bev=0.005),
        ]

    if tema == 'neon':
        if variante == 'hito':
            # Poste holográfico con prisma flotante
            return [
                cyl((0, 0, 0.08), 0.22, 0.16, m_det, v=12, r2=0.16, bev=0.015),
                cyl((0, 0, 0.36), 0.07, 0.44, m_det, v=12),
                tor((0, 0, 0.58), 0.16, 0.03, m_main, maj=18, min_seg=8),
                cube((0, 0, 0.76), (0.18, 0.18, 0.18), m_main, rot=(0.6, 0.6, 0.6), bev=0.015),
            ]
        # flora: cono de tráfico neón
        return [
            cube((0, 0, 0.05), (0.48, 0.48, 0.10), m_det, bev=0.015),
            cyl((0, 0, 0.42), 0.18, 0.68, m_main, v=16, r2=0.05, bev=0.01),
            cyl((0, 0, 0.42), 0.135, 0.14, m_extra, v=16, r2=0.115),
        ]

    if tema == 'jardin':
        if variante == 'hito':
            # Seto recortado topiario en maceta
            return [
                cyl((0, 0, 0.12), 0.20, 0.24, m_det, v=14, r2=0.25, bev=0.015),
                cyl((0, 0, 0.34), 0.06, 0.22, m_det, v=10),
                ball((0, 0, 0.54), (0.28, 0.28, 0.24), m_main, seg=14, rings=8),
                ball((0, 0, 0.80), (0.16, 0.16, 0.15), m_main, seg=12, rings=8),
            ]
        # flora: flor gigante
        objs = [
            cyl((0, 0, 0.30), 0.06, 0.60, m_det, v=10),
            ball((0, 0, 0.62), (0.12, 0.12, 0.08), m_extra, seg=12, rings=6),
        ]
        for i in range(5):
            ang = i * math.tau / 5.0
            objs.append(ball((0.20 * math.cos(ang), 0.20 * math.sin(ang), 0.60), (0.14, 0.11, 0.05), m_main, seg=10, rings=6, rot=(0, 0, ang)))
        return objs

    # sombrio
    if variante == 'hito':
        # Lápida gótica con base y cruz/relieve
        return [
            cube((0, 0, 0.07), (0.56, 0.34, 0.14), m_det, bev=0.02),
            cube((0, 0, 0.40), (0.42, 0.18, 0.56), m_main, bev=0.04, bev_seg=2),
            cube((0, -0.10, 0.46), (0.18, 0.04, 0.06), m_extra, bev=0.008),
            cube((0, -0.10, 0.42), (0.06, 0.04, 0.24), m_extra, bev=0.008),
        ]
    # flora: calabaza tallada con tallo
    return [
        ball((0, 0, 0.24), (0.34, 0.32, 0.24), m_main, seg=16, rings=10),
        cyl((0, 0, 0.50), 0.06, 0.14, m_det, v=10, r2=0.03, rot=(0.2, 0.1, 0)),
        cube((-0.10, -0.29, 0.28), (0.07, 0.04, 0.07), m_extra, rot=(0, 0.78, 0)),
        cube((0.10, -0.29, 0.28), (0.07, 0.04, 0.07), m_extra, rot=(0, 0.78, 0)),
    ]


def export_asset(name, pieza, tema, objs, em):
    bpy.ops.object.select_all(action='DESELECT')
    for x in objs:
        x.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    vs = ob.data.vertices
    lo = [min(v.co[i] for v in vs) for i in range(3)]
    hi = [max(v.co[i] for v in vs) for i in range(3)]
    cx = (lo[0] + hi[0]) / 2.0
    cy = (lo[1] + hi[1]) / 2.0
    for v in vs:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= lo[2]
    ob.data.update()

    if pieza != 'aro':
        f = 1.0 / max(ob.dimensions)
        for v in vs:
            v.co *= f
        ob.data.update()

    tris = sum(len(q.vertices) - 2 for q in ob.data.polygons)
    dims = [round(ob.dimensions.x, 4), round(ob.dimensions.z, 4), round(ob.dimensions.y, 4)]
    if tris > 900:
        print(f'WARN {name} excede 900 tris: {tris}')

    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, name + '.glb'),
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_image_format='AUTO',
        export_materials='EXPORT',
    )
    return {
        'nombre': name,
        'pieza': pieza,
        'tema': tema,
        'tris': tris,
        'dims': dims,
        'mov': False,
        'emisivo': em,
    }


def build_common_mats():
    return {
        'anillo': mat('anillo_blanco', 'anillo_blanco', em=True, em_str=1.8, rough=0.2),
        'metal_oscuro': mat('metal_oscuro', 'asfalto', rough=0.35, metal=0.8),
        'metal_cian': mat('metal_cian', 'metal_cian', rough=0.35, metal=0.7),
        'metal_azul': mat('metal_azul', 'metal_azul', rough=0.35, metal=0.7),
        'metal_amarillo': mat('metal_amarillo', 'metal_amarillo', em=True, em_str=0.8, rough=0.3, metal=0.5),
        # La caja conserva el tono violeta brillante, pero evita una cara grande en blending.
        'vidrio_violeta': mat('vidrio_violeta', 'vidrio_violeta', em=True, em_str=0.5, rough=0.12),
        'vidrio_dorado': mat('vidrio_dorado', 'vidrio_dorado', em=True, em_str=1.4, rough=0.15),
        'rayas_amarillas': mat('rayas_amarillas', 'rayas_amarillas', rough=0.45),
        'rayas_rojas': mat('rayas_rojas', 'rayas_rojas', rough=0.45),
        'neon': mat('neon', 'neon', em=True, em_str=1.6, rough=0.25),
        'lona_roja': mat('lona_roja', 'lona_roja', rough=0.7),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    if '--lod-only' in sys.argv:
        generate_lod_variants()
        return
    data = []

    common_specs = [
        ('anillo_neon', 'aro', True, build_anillo_neon),
        ('caja_evento', 'evento', True, build_caja_evento),
        ('caja_cambio', 'cambio', True, build_caja_cambio),
        ('turbo_placa', 'turbo', True, build_turbo_placa),
        ('barrera', 'barrera', False, lambda m: build_barrera_o_bordillo(m, True)),
        ('bordillo', 'bordillo', False, lambda m: build_barrera_o_bordillo(m, False)),
        ('arco_salida', 'arco', True, build_arco_salida),
        ('tunel_arco', 'tunel', True, build_tunel_arco),
        ('pilar', 'soporte', False, build_pilar),
        ('banderin', 'bandera', False, build_banderin),
        ('farola_pista', 'farola', True, build_farola_pista),
    ]
    for name, pieza, em, fn in common_specs:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        cm = build_common_mats()
        data.append(export_asset(name, pieza, None, fn(cm), em))

    rebote_tex = {
        'sombrio': ('sombrio', 'metal_azul', 'vidrio_violeta', True),
        'bosque': ('hongo', 'madera_caja', 'hongo', True),
        'mar': ('concha', 'mar', 'almeja', True),
        'desierto': ('cactus', 'desierto', 'petalo', True),
        'hielo': ('hielo_rebote', 'hielo', 'hielo_rebote', True),
        'volcan': ('roca_geiser', 'volcan', 'goma_naranja', True),
        'cristal': ('cristal', 'metal_azul', 'cristal', True),
        'nubes': ('nube_trampolin', 'nubes', 'vidrio_dorado', True),
        'neon': ('neon', 'asfalto', 'neon', True),
        'jardin': ('petalo', 'jardin', 'vidrio_dorado', True),
    }
    for t in THEMES:
        tx_m, tx_d, tx_p, em = rebote_tex[t]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mats = {
            'main': mat(f'reb_{t}_m', tx_m, em=(t in ('hielo', 'cristal', 'neon')), em_str=0.9),
            'det': mat(f'reb_{t}_d', tx_d, rough=0.5),
            'pad': mat(f'reb_{t}_p', tx_p, em=em, em_str=1.1, rough=0.25),
        }
        data.append(export_asset('rebote_' + t, 'rebote', t, build_rebote(t, mats), em))

    deco_tex = {
        ('sombrio', 'hito'): ('sombrio', 'asfalto', 'vidrio_violeta', True),
        ('sombrio', 'flora'): ('goma_naranja', 'madera_caja', 'vidrio_dorado', True),
        ('bosque', 'hito'): ('bosque', 'hongo', 'hoja_luminosa', False),
        ('bosque', 'flora'): ('hoja_luminosa', 'bosque', 'hongo', False),
        ('mar', 'hito'): ('lona_roja', 'metal_amarillo', 'neon', True),
        ('mar', 'flora'): ('metal_coral', 'mar', 'concha', False),
        ('desierto', 'hito'): ('desierto', 'roca_geiser', 'desierto', False),
        ('desierto', 'flora'): ('ceramica', 'madera_teal', 'desierto', False),
        ('hielo', 'hito'): ('hielo', 'hielo_rebote', 'hielo', True),
        ('hielo', 'flora'): ('nubes', 'lona_roja', 'goma_naranja', False),
        ('volcan', 'hito'): ('roca_geiser', 'volcan', 'nubes', True),
        ('volcan', 'flora'): ('asfalto', 'volcan', 'goma_naranja', True),
        ('cristal', 'hito'): ('cristal', 'metal_azul', 'cristal', True),
        ('cristal', 'flora'): ('cristal', 'vidrio_violeta', 'cristal', True),
        ('nubes', 'hito'): ('lona_roja', 'madera_caja', 'nubes', False),
        ('nubes', 'flora'): ('nubes', 'madera_caja', 'nube_trampolin', False),
        ('neon', 'hito'): ('neon', 'asfalto', 'metal_cian', True),
        ('neon', 'flora'): ('goma_naranja', 'asfalto', 'neon', True),
        ('jardin', 'hito'): ('jardin', 'ceramica', 'madera_caja', False),
        ('jardin', 'flora'): ('petalo', 'jardin', 'vidrio_dorado', False),
    }
    for t in THEMES:
        for var in ('hito', 'flora'):
            tx_m, tx_d, tx_e, em = deco_tex[(t, var)]
            bpy.ops.wm.read_factory_settings(use_empty=True)
            mats = {
                'main': mat(f'dec_{t}_{var}_m', tx_m, em=(t in ('cristal', 'neon', 'hielo') and var == 'flora') or (t == 'cristal' and var == 'hito'), em_str=0.8),
                'det': mat(f'dec_{t}_{var}_d', tx_d, em=(t == 'volcan'), em_str=1.0),
                'extra': mat(f'dec_{t}_{var}_e', tx_e, em=em, em_str=1.1),
            }
            data.append(export_asset(f'deco_{t}_{var}', 'deco', t, build_deco(t, var, mats), em))

    with open(os.path.join(OUT, 'kit.json'), 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    over = [(d['nombre'], d['tris']) for d in data if d['tris'] > 900]
    print('OK kit assets', len(data), 'max_tris:', max(d['tris'] for d in data))
    if over:
        raise Exception(f'Exceden 900 tris: {over}')
    generate_lod_variants()


def generate_lod_variants():
    """Crea LODs decimados desde los GLB fuente, conservando materiales y UV."""
    manifest_path = os.path.join(OUT, 'kit.json')
    with open(manifest_path, encoding='utf8') as f:
        manifest = json.load(f)
    by_name = {x['nombre']: x for x in manifest}
    for name, target in LOD_TARGETS.items():
        src = os.path.join(OUT, name + '.glb')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=src)
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        if not meshes:
            raise RuntimeError('No hay malla para ' + name)
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        ob = bpy.context.object
        if name == 'caja_evento':
            for material in ob.data.materials:
                if material and material.use_nodes:
                    bsdf = material.node_tree.nodes.get('Principled BSDF')
                    if bsdf and 'Alpha' in bsdf.inputs:
                        bsdf.inputs['Alpha'].default_value = 1.0
                    color = material.diffuse_color
                    material.diffuse_color = (color[0], color[1], color[2], 1.0)
        original = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        mod = ob.modifiers.new('LOD decimado', 'DECIMATE')
        mod.ratio = min(1.0, target / max(original, 1))
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if tris > target + 8:
            raise RuntimeError(f'{name}_lod excede objetivo: {tris} > {target}')
        out_name = name + '_lod'
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT, out_name + '.glb'),
            export_format='GLB', use_selection=True, export_yup=True,
            export_apply=True, export_image_format='AUTO', export_materials='EXPORT',
        )
        source = by_name[name]
        by_name[out_name] = {
            'nombre': out_name, 'pieza': source['pieza'], 'tema': source['tema'],
            'tris': tris, 'dims': source['dims'], 'mov': source['mov'],
            'emisivo': source['emisivo'], 'lod_de': name,
        }
        print(f'LOD {out_name}: {original} -> {tris} tris')
    with open(manifest_path, 'w', encoding='utf8') as f:
        json.dump(list(by_name.values()), f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
