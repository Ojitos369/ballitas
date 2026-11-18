import json
import math
import os
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'public', 'models', 'kit')

bpy.ops.wm.read_factory_settings(use_empty=True)
with open(os.path.join(KIT, 'kit.json'), encoding='utf8') as f:
    items = json.load(f)

cols = 7
rows = math.ceil(len(items) / cols)
spacing_x = 1.85
spacing_y = 2.40

# Material emisivo blanco para etiquetas legibles sobre fondo nocturno
mat_label = bpy.data.materials.new('Etiqueta_Blanca')
mat_label.use_nodes = True
nt_l = mat_label.node_tree
bs_l = nt_l.nodes.get('Principled BSDF')
bs_l.inputs['Base Color'].default_value = (0.95, 0.97, 1.0, 1.0)
bs_l.inputs['Emission Color'].default_value = (0.92, 0.96, 1.0, 1.0)
bs_l.inputs['Emission Strength'].default_value = 1.2

for i, item in enumerate(items):
    col = i % cols
    row = rows - 1 - (i // cols)
    x = (col - (cols - 1) / 2.0) * spacing_x
    y = (row - (rows - 1) / 2.0) * spacing_y

    bpy.ops.import_scene.gltf(filepath=os.path.join(KIT, item['nombre'] + '.glb'))
    for o in bpy.context.selected_objects:
        o.location.x += x
        o.location.y += y

    bpy.ops.object.text_add(location=(x, y - 0.78, 0.015))
    label = bpy.context.object
    label.data.body = item['nombre']
    label.data.size = 0.145
    label.data.align_x = 'CENTER'
    label.data.extrude = 0.002
    label.rotation_euler = (math.radians(28), 0.0, 0.0)
    label.data.materials.append(mat_label)

# Suelo oscuro tipo escena nocturna
bpy.ops.mesh.primitive_plane_add(size=36, location=(0, 0, -0.01))
ground = bpy.context.object
ground.name = 'Fondo_Nocturno'
mat_g = bpy.data.materials.new('Suelo_Nocturno')
mat_g.use_nodes = True
bs_g = mat_g.node_tree.nodes.get('Principled BSDF')
bs_g.inputs['Base Color'].default_value = (0.025, 0.035, 0.065, 1.0)
bs_g.inputs['Roughness'].default_value = 0.72
ground.data.materials.append(mat_g)

# Entorno nocturno
world = bpy.data.worlds.new('Nocturno')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.015, 0.022, 0.045, 1.0)
bg.inputs['Strength'].default_value = 0.45
bpy.context.scene.world = world

# Iluminación de tres puntos (Key, Fill, Rim)
lights = [
    ('Key', (-8.0, -10.0, 12.0), 2600, 10.0, (1.0, 0.96, 0.90)),
    ('Fill', (10.0, -8.0, 8.0), 1100, 11.0, (0.60, 0.78, 1.0)),
    ('Rim', (0.0, 11.0, 9.0), 1800, 10.0, (0.75, 0.88, 1.0)),
]
for lname, loc, power, size, col in lights:
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.name = lname
    l.data.energy = power
    l.data.shape = 'DISK'
    l.data.size = size
    l.data.color = col
    l.rotation_euler = (Vector((0, 0, 0.3)) - l.location).to_track_quat('-Z', 'Y').to_euler()

# Cámara ortográfica 3/4 para ver altura y silueta
bpy.ops.object.camera_add(location=(0.0, -10.5, 12.0))
cam = bpy.context.object
cam.rotation_euler = (Vector((0.0, -0.2, 0.25)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = cols * spacing_x + 1.1
bpy.context.scene.camera = cam

sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 32
sc.render.resolution_x = 1800
sc.render.resolution_y = 1480
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = os.path.join(os.path.dirname(__file__), 'kit_contacto.png')
bpy.ops.render.render(write_still=True)
