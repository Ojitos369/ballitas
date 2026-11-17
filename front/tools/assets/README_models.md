# Generador de modelos 3D (GLB) de Ballitas

Este directorio contiene el script procedural en Blender y el validador en Three.js que producen los 13 modelos 3D estilizados usados por las pistas y nodos en `public/models/`, junto con la hoja de contacto `preview/models_sheet.png`.

## Cómo regenerar y validar

Desde la carpeta `front/`, ejecuta Blender en modo sin interfaz gráfica:

```bash
blender -b -P tools/assets/generate_models.py
```

El script genera los 13 archivos `.glb` en `public/models/`, los reimporta para verificar que cada uno contenga una sola malla por debajo de 4000 triángulos y renderiza la hoja de contacto en `tools/assets/preview/models_sheet.png`. Para validar adicionalmente la carga directa con `GLTFLoader` de Three.js:

```bash
pnpm exec node tools/assets/validate_models.mjs
```

## Contrato de geometría y materiales

Todos los modelos se exportan en formato binario glTF 2.0 (`GLB`) con el eje `+Y` arriba, sombreado suave, bordes biselados o subdivisión aplicada y un único material neutro blanco (`Principled BSDF`) modulado por colores de vértice sutiles para que el código pueda teñirlos por instancia con `InstancedMesh`.

Los doce modelos verticales (`tree`, `pine`, `mushroom`, `crystal`, `rock`, `flower`, `coral`, `ice_spire`, `cactus`, `lamp`, `pylon` y `pod`) tienen su base apoyada en `y = 0`, altura exacta de `1.0` unidad y centro en `x = 0, z = 0`. El modelo `clamp` (abrazadera metálica de tubo con ocho pernos radiales) está centrado en el origen `(0, 0, 0)` con su eje alineado en `Z`, diámetro exterior de `1.0` unidad en el plano `XY` y ancho de `0.15` unidades en `Z`.

## Créditos y licencias

Todos los modelos de este conjunto fueron modelados de forma 100 % procedural con `bpy` y `bmesh` dentro de este repositorio, sin incorporar mallas ni recursos externos de terceros.
