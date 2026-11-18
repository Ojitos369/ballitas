"""Genera decoración temática low-poly para los caminos de Ballitas.

Uso: blender -b -P tools/blender/generar_vida.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from generar_modelos import M, hexc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models")


def make(name, palette, shape):
    m = M()
    c = [hexc(x) for x in palette]
    shape(m, c)
    ob = m.finish(name)
    # Normaliza en Blender Z-up; el exportador GLB convierte a Y-up.
    dims = ob.dimensions
    scale = 1.0 / max(dims.x, dims.y, dims.z)
    for v in ob.data.vertices:
        v.co *= scale
    ob.data.update()
    return ob


def farol(m, c):
    m.lathe([(0.12, 0), (0.08, .08), (.055, .58)], 8, c[0], cap_top=False)
    m.lathe([(.16, .56), (.17, .63), (.13, .82), (.16, .88)], 8, c[1])
    m.sphere((0, 0, .72), .105, c[2], 7, 4)
    m.cone((0, 0, .86), .2, .11, c[0], 7, r2=.02)
    m.sphere((0, 0, .99), .035, c[1], 6, 3)


def altar(m, c):
    m.lathe([(.42, 0), (.48, .12), (.32, .2), (.3, .62), (.4, .72), (.28, .82)], 9, c[0], cap_top=False)
    m.sphere((0, 0, .8), .18, c[1], 7, 4)
    for i in range(5):
        import math
        a = i * 6.283 / 5
        m.cone((math.cos(a)*.25, math.sin(a)*.25, .7), .06, .23, c[2], 5, r2=0)


def nido(m, c):
    m.lathe([(.42, 0), (.48, .12), (.43, .2), (.35, .22), (.28, .16), (.2, .2)], 10, c[0], cap_top=False)
    m.sphere((-.1, 0, .2), .12, c[1], 6, 4)
    m.sphere((.12, .04, .2), .13, c[2], 6, 4)
    m.sphere((0, -.1, .24), .1, c[1], 6, 4)


def casita(m, c):
    m.lathe([(.34, 0), (.4, .12), (.32, .4), (.3, .52)], 8, c[0], cap_top=True)
    m.cone((0, 0, .48), .48, .43, c[1], 8, r2=0)
    m.lathe([(.1, -.01), (.1, .25)], 7, c[2], cap_top=False)
    m.sphere((.2, -.2, .36), .055, c[2], 6, 3)


def boya(m, c):
    m.lathe([(.31, 0), (.36, .12), (.28, .22), (.16, .38), (.13, .63)], 9, c[0])
    m.lathe([(.14, .32), (.29, .38), (.28, .46)], 9, c[1])
    m.cone((0, 0, .62), .18, .22, c[2], 7, r2=.04)
    m.sphere((0, 0, .87), .06, c[1], 6, 4)


def concha(m, c):
    m.lathe([(.42, 0), (.48, .12), (.45, .34), (.3, .43), (.12, .4), (0, .34)], 10, c[0], cap_bot=False, cap_top=False)
    for i in range(7):
        import math
        a = math.pi * (i + 1) / 8
        m.cone((math.cos(a)*.2, math.sin(a)*.2, .12), .035, .32, c[1], 4, tilt=(math.cos(a)*.5, math.sin(a)*.5), r2=.018)


def iglu(m, c):
    m.lathe([(.45, 0), (.48, .2), (.42, .48), (.3, .7), (.13, .86), (0, .9)], 10, c[0], cap_top=False)
    m.lathe([(.14, 0), (.14, .28), (.12, .32)], 8, c[1], cap_bot=False, cap_top=False)
    for z in (.2, .4):
        m.lathe([(.42-z*.15, z), (.44-z*.15, z+.035)], 10, c[2], cap_bot=False, cap_top=False)


def cristal(m, c):
    for x, y, h, r in [(0, 0, .92, .16), (-.23, .02, .63, .13), (.22, .08, .7, .12), (.06, -.22, .55, .1)]:
        m.cone((x, y, 0), r*1.35, .09, c[0], 6, r2=r)
        m.cone((x, y, .06), r, h, c[1], 6, r2=0, tilt=(x*.15, y*.15))


def arco(m, c):
    for x in (-.34, .34):
        m.lathe([(.13, 0), (.16, .12), (.13, .68)], 7, c[0], cap_top=False)
    m.cone((-.34, 0, .65), .16, .22, c[0], 7, r2=.16, tilt=(1.55, 0))
    m.sphere((0, 0, .82), .1, c[1], 7, 4)


def oasis(m, c):
    m.lathe([(.45, 0), (.48, .08), (.38, .13), (.3, .1)], 10, c[0], cap_top=False)
    m.lathe([(.29, .11), (.28, .12), (.08, .12), (0, .11)], 10, c[1], cap_bot=False, cap_top=False)
    m.lathe([(.1, .12), (.12, .5), (.1, .55)], 7, c[2], cap_top=False)
    m.cone((0, 0, .52), .2, .08, c[0], 7, r2=.18)


def balloon(m, c):
    m.sphere((0, 0, .68), .31, c[0], 9, 6, .8)
    m.cone((0, 0, .38), .09, .12, c[1], 6, r2=.05)
    for x in (-.07, .07):
        m.cone((x, 0, .12), .012, .29, c[2], 4, tilt=(-x*.3, 0), r2=.01)
    m.lathe([(.13, 0), (.13, .12), (.1, .14)], 7, c[1])


def windmill(m, c):
    m.lathe([(.13, 0), (.09, .12), (.07, .67)], 7, c[0], cap_top=False)
    m.sphere((0, 0, .7), .1, c[2], 7, 4)
    for a in (0, 1.571, 3.142, 4.712):
        import math
        m.cone((math.cos(a)*.07, math.sin(a)*.07, .7), .09, .4, c[1], 5, tilt=(math.cos(a)*.45, math.sin(a)*.45), r2=.015)


def kiosk(m, c):
    m.lathe([(.38, 0), (.42, .1), (.34, .42), (.32, .46)], 9, c[0], cap_top=False)
    m.lathe([(.43, .44), (.48, .5), (.4, .56)], 9, c[1], cap_bot=False, cap_top=False)
    m.sphere((0, -.26, .3), .08, c[2], 7, 4)
    m.sphere((0, .25, .3), .08, c[2], 7, 4)


def flor(m, c):
    m.lathe([(.07, 0), (.06, .12), (.045, .45)], 7, c[0], cap_top=False)
    m.sphere((0, 0, .66), .2, c[1], 8, 5)
    for i in range(6):
        import math
        a = i * math.pi / 3
        m.sphere((math.cos(a)*.18, math.sin(a)*.18, .65), .12, c[2], 6, 4, .8)


def globeflower(m, c):
    m.lathe([(.11, 0), (.09, .14), (.06, .35)], 7, c[0], cap_top=False)
    for i in range(6):
        import math
        a = i * math.pi / 3
        m.sphere((math.cos(a)*.16, math.sin(a)*.16, .76), .15, c[1], 6, 4, .75)
    m.sphere((0, 0, .76), .12, c[2], 7, 4)


ASSETS = [
    ("sombrio_farol", ["#393344", "#64536f", "#b28cff"], farol),
    ("sombrio_altar", ["#39323e", "#b27aeb", "#665477"], altar),
    ("bosque_nido", ["#725035", "#e7c98b", "#9cbf63"], nido),
    ("bosque_casita", ["#805b3d", "#56824d", "#e8d6aa"], casita),
    ("mar_boya", ["#e86f55", "#fff0a8", "#55c9d6"], boya),
    ("mar_concha", ["#d58ca0", "#fff0f3", "#ffcf90"], concha),
    ("desierto_oasis", ["#bd9250", "#54c6c0", "#8b542f"], oasis),
    ("desierto_molino", ["#875637", "#d6ad71", "#f2d27a"], windmill),
    ("hielo_iglu", ["#c8eafb", "#78b8dc", "#f4fcff"], iglu),
    ("hielo_farol", ["#5c91b3", "#c5f5ff", "#82d7ee"], farol),
    ("volcan_altar", ["#493632", "#ff683e", "#a64227"], altar),
    ("volcan_farol", ["#493632", "#ff8a45", "#ffd06b"], farol),
    ("cristal_prisma", ["#6388a5", "#b8ecff", "#f6d7ff"], cristal),
    ("cristal_arco", ["#6788a8", "#d9baff", "#9ffcff"], arco),
    ("nubes_globo", ["#fff2c9", "#f4a9cc", "#7ccbe5"], balloon),
    ("nubes_casita", ["#fff2d9", "#b8c8f0", "#e8a7cc"], casita),
    ("neon_kiosco", ["#263c52", "#31e8d3", "#ff4fc8"], kiosk),
    ("neon_molino", ["#284253", "#4cf6dd", "#ff5ac8"], windmill),
    ("jardin_gazebo", ["#62865a", "#edc77a", "#f4f0dc"], arco),
    ("jardin_flor", ["#52874b", "#ee73a8", "#ffc958"], globeflower),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    stats_path = os.path.join(OUT, "_stats.json")
    import json
    stats = json.load(open(stats_path)) if os.path.exists(stats_path) else {}
    for name, palette, shape in ASSETS:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ob = make(name, palette, shape)
        tris = len(ob.data.polygons)
        if tris > 600:
            raise ValueError(f"{name}: {tris} tris")
        path = os.path.join(OUT, name + ".glb")
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True,
                                  export_apply=True, export_attributes=True, use_selection=True,
                                  export_materials="EXPORT", export_image_format="NONE",
                                  export_cameras=False, export_lights=False)
        d = ob.dimensions
        stats[name] = {"tris": tris, "x": round(d.x, 3), "y_alto": round(d.z, 3),
                       "z": round(d.y, 3), "bytes": os.path.getsize(path)}
        print("OK", name, stats[name])
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=1)


if __name__ == "__main__":
    main()
