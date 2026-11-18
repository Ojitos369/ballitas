from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
src=root/'tools'/'tex'/'hojas'; out=root/'public'/'tex'/'kit'; out.mkdir(parents=True,exist_ok=True)
sets={
'kit_pistas':['asfalto','bosque','mar','desierto','hielo','volcan','cristal','nubes','neon','jardin','rayas_rojas','rayas_amarillas','metal_cian','metal_coral','vidrio_violeta','vidrio_dorado'],
'kit_mecanica':['madera_caja','madera_teal','metal_azul','metal_amarillo','goma','goma_naranja','ceramica','concha','lona_roja','lona_violeta','resorte','cactus','hongo','almeja','hielo_rebote','roca_geiser'],
'kit_biomas':['sombrio','bosque','mar','desierto','hielo','volcan','cristal','nubes','neon','jardin','petalo','hongo','nube_trampolin','gel','almeja','hoja_luminosa']}
for stem,names in sets.items():
 im=Image.open(src/f'{stem}.png').convert('RGB'); w,h=im.size
 if abs(w-h)>2 or w<512 or h<512: raise ValueError((stem,im.size))
 for i,name in enumerate(names):
  row,col=divmod(i,4); x0=round(col*w/4)+2; x1=round((col+1)*w/4)-2; y0=round(row*h/4)+2; y1=round((row+1)*h/4)-2
  tile=im.crop((x0,y0,x1,y1)).resize((256,256),Image.Resampling.LANCZOS)
  tile.save(out/f'{name}.webp','WEBP',quality=78,method=6)
print('48 tiles',out)
