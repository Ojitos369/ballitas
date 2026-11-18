import bpy, os, json, math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..')); KIT=os.path.join(ROOT,'public','models','kit')
bpy.ops.wm.read_factory_settings(use_empty=True)
items=json.load(open(os.path.join(KIT,'kit.json'),encoding='utf8'))
cols=7; spacing=1.65
for i,item in enumerate(items):
 x=(i%cols-(cols-1)/2)*spacing; y=(i//cols-(math.ceil(len(items)/cols)-1)/2)*spacing
 bpy.ops.import_scene.gltf(filepath=os.path.join(KIT,item['nombre']+'.glb'))
 imported=list(bpy.context.selected_objects)
 for o in imported:o.location.x+=x;o.location.y+=y
 # Compact name tag, laid flat to face the review camera.
 bpy.ops.object.text_add(location=(x-.62,y-.62,.015)); label=bpy.context.object;label.data.body=item['nombre'];label.data.size=.13;label.data.extrude=0
 mat=bpy.data.materials.new('Tinta etiquetas');mat.diffuse_color=(.025,.035,.06,1);label.data.materials.append(mat)
# Ground and lighting
bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.03)); ground=bpy.context.object;ground.name='Fondo';ground.data.materials.append(bpy.data.materials.new('Fondo teal'));ground.data.materials[0].diffuse_color=(.045,.11,.15,1)
world=bpy.data.worlds.new('Estudio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.2,.25,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8;bpy.context.scene.world=world
for loc,power,size in [((-8,-8,12),1800,9),((8,4,10),1300,8)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(math.radians(25),0,math.radians(35))
bpy.ops.object.camera_add(location=(0,-8,17));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=cols*spacing+1;bpy.context.scene.camera=cam
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=32;sc.render.resolution_x=1500;sc.render.resolution_y=1100;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=os.path.join(os.path.dirname(__file__),'kit_contacto.png');sc.camera.data.lens=50
bpy.ops.render.render(write_still=True)
