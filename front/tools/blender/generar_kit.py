import bpy, math, os, json
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..')); OUT=os.path.join(ROOT,'public','models','kit'); TEX=os.path.join(ROOT,'public','tex','kit')
THEMES=['sombrio','bosque','mar','desierto','hielo','volcan','cristal','nubes','neon','jardin']; A=[]
def add(n,p,t,tx,s,e=False): A.append((n,p,t,tx,s,e))
def cube(pos,dim,ma):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.scale=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); b=o.modifiers.new('Bisel','BEVEL'); b.width=.04; b.segments=2; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name); o.data.materials.append(ma); return o
def cyl(pos,r,d,ma,v=10,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r,radius2=r if r2 is None else r2,depth=d,location=pos); o=bpy.context.object; o.data.materials.append(ma); return o
def ball(pos,sc,ma):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=1,location=pos);o=bpy.context.object;o.scale=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma);return o
def tor(pos,R,r,ma): bpy.ops.mesh.primitive_torus_add(major_radius=R,minor_radius=r,major_segments=16,minor_segments=6,location=pos);o=bpy.context.object;o.data.materials.append(ma);return o
def mat(name,tx,em=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;bs=n.get('Principled BSDF');im=bpy.data.images.load(os.path.join(TEX,tx+'.webp'),check_existing=True);im.pack();q=n.new('ShaderNodeTexImage');q.image=im;m.node_tree.links.new(q.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.5
 if em:m.node_tree.links.new(q.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=1.2
 return m
def build(a):
 name,p,t,tx,s,em=a;bpy.ops.wm.read_factory_settings(use_empty=True);M=mat(name,tx,em);D=mat(name+' detalle','metal_cian',em);W=mat(name+' madera','madera_caja');o=[]
 if s=='ring':o=[tor((0,0,.7),.62,.12,M),cyl((-.58,0,.33),.055,.66,D,8),cyl((.58,0,.33),.055,.66,D,8)]
 elif s in ('event','change'):o=[cube((0,0,.42),(.72,.62,.62),W),cube((0,-.33,.42),(.46,.035,.42),M),tor((0,-.36,.42),.13,.04,D)]
 elif s in ('turbo','barrier','curb'):
  o=[cube((0,0,.15 if s!='barrier' else .22),(1,.62,.3 if s!='barrier' else .44),M)]
  for x in (-.36,-.12,.12,.36):
   q=cube((x,-.32,.15 if s!='barrier' else .22),(.10,.025,.24 if s!='barrier' else .35),D);q.rotation_euler[2]=.4 if s=='turbo' else 0;o.append(q)
 elif s in ('arch','tunnel'):
  if s=='arch':o=[cyl((-.43,0,.48),.08,.96,M),cyl((.43,0,.48),.08,.96,M),cube((0,0,.94),(.94,.16,.16),D)]
  else:
   for i in range(7):
    q=cube((.48*math.cos(math.pi*i/6),0,.48+.48*math.sin(math.pi*i/6)),(.19,.18,.19),M);q.rotation_euler[1]=-math.pi*i/6;o.append(q)
 elif s in ('pillar','lamp','flag'):o=[cyl((0,0,.48),.07,.96,D),cube((0,0,.92) if s=='lamp' else (.17,0,.74) if s=='flag' else (0,0,.08),(.35,.24,.14) if s=='lamp' else (.36,.035,.2) if s=='flag' else (.5,.5,.16),M)]
 elif s=='mushroom':o=[cyl((0,0,.22),.14,.44,D),ball((0,0,.48),(.38,.34,.2),M)]+[ball((x,-.24,.52),(.04,.025,.04),D) for x in (-.14,.14)]
 elif s=='clam':o=[ball((0,0,.16),(.4,.34,.14),D),ball((0,0,.34),(.37,.3,.2),M)]
 elif s=='cactus':o=[cyl((0,0,.38),.15,.76,M),cyl((-.2,0,.38),.09,.36,M,8),cyl((.2,0,.46),.09,.4,M,8)]
 elif s=='ice':o=[ball((0,0,.22),(.36,.32,.2),M),cyl((0,0,.48),.2,.42,D,6,.1)]
 elif s=='geyser':o=[cyl((0,0,.15),.4,.3,M,9,.28),tor((0,0,.3),.24,.05,D),cyl((0,0,.5),.1,.4,M,8,.04)]
 elif s=='crystal':o=[cyl((0,0,.28),.2,.56,M,6,.01),cyl((-.2,0,.18),.12,.36,D,5,.01)]
 elif s=='cloud':o=[ball((-.16,0,.2),(.23,.22,.18),M),ball((.12,0,.23),(.27,.23,.2),M),ball((0,0,.38),(.21,.2,.2),M)]
 elif s=='pad':o=[cyl((0,0,.1),.38,.2,M,12),tor((0,0,.21),.26,.035,D)]
 elif s=='flower':o=[cyl((0,0,.25),.04,.5,D,8)]+[ball((.18*math.cos(i*math.tau/5),.18*math.sin(i*math.tau/5),.48),(.13,.11,.07),M) for i in range(5)]+[ball((0,0,.48),(.1,.1,.1),D)]
 elif s=='pumpkin':o=[ball((0,0,.28),(.34,.32,.26),M),cyl((0,0,.54),.05,.12,D,7,.03)]
 else:o=[ball((0,0,.2),(.32,.3,.18),M),cyl((0,0,.42),.07,.36,D,7,.01)]
 bpy.ops.object.select_all(action='DESELECT')
 for x in o:x.select_set(True)
 bpy.context.view_layer.objects.active=o[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=name;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 vs=ob.data.vertices;lo=[min(v.co[i] for v in vs) for i in range(3)];hi=[max(v.co[i] for v in vs) for i in range(3)];cx=(lo[0]+hi[0])/2;cy=(lo[1]+hi[1])/2
 for v in vs:v.co.x-=cx;v.co.y-=cy;v.co.z-=lo[2]
 ob.data.update()
 if s!='ring':
  f=1/max(ob.dimensions)
  for v in vs:v.co*=f
 ob.data.update();tris=sum(len(q.vertices)-2 for q in ob.data.polygons);dims=[round(ob.dimensions.x,4),round(ob.dimensions.z,4),round(ob.dimensions.y,4)]
 if tris>900:raise Exception(name+' triangles '+str(tris))
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_image_format='AUTO',export_materials='EXPORT')
 return {'nombre':name,'pieza':p,'tema':t,'tris':tris,'dims':dims,'mov':False,'emisivo':em}
def main():
 os.makedirs(OUT,exist_ok=True)
 for x in [('anillo_neon','aro',None,'anillo_blanco','ring',True),('caja_evento','evento',None,'madera_caja','event',False),('caja_cambio','cambio',None,'rayas_amarillas','change',False),('turbo_placa','turbo',None,'neon','turbo',True),('barrera','barrera',None,'rayas_amarillas','barrier',False),('bordillo','bordillo',None,'rayas_rojas','curb',False),('arco_salida','arco',None,'metal_cian','arch',True),('tunel_arco','tunel',None,'metal_azul','tunnel',True),('pilar','soporte',None,'metal_azul','pillar',False),('banderin','bandera',None,'lona_roja','flag',False),('farola_pista','farola',None,'metal_amarillo','lamp',True)]:add(*x)
 for t,x in zip(THEMES,[('mushroom','hongo',False),('clam','almeja',True),('cactus','cactus',False),('ice','hielo_rebote',True),('geyser','roca_geiser',True),('crystal','cristal',True),('cloud','nube_trampolin',False),('pad','neon',True),('flower','petalo',False),('pumpkin','sombrio',True)]):add('rebote_'+t,'rebote',t,x[1],x[0],x[2])
 for t in THEMES:add('deco_'+t+'_hito','deco',t,t,'deco');add('deco_'+t+'_flora','deco',t,'petalo' if t in ('bosque','jardin') else t,'flower' if t in ('bosque','jardin') else 'deco',t in ('cristal','neon','hielo'))
 data=[build(x) for x in A]
 with open(os.path.join(OUT,'kit.json'),'w',encoding='utf8') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')
 print('OK kit assets',len(data))
if __name__=='__main__':main()
