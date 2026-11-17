# Generador de texturas de Ballitas

Este directorio contiene el script procedural que produce las texturas y sprites usados por el juego en `public/tex/`, junto con sus mosaicos de verificación en `preview/`.

## Cómo regenerar los archivos

Desde la carpeta `front/`, ejecuta el generador con Python 3 (requiere `numpy` y `Pillow`):

```bash
python tools/assets/generate_textures.py
```

El script sobrescribe los 38 archivos PNG en `public/tex/` y actualiza los mosaicos `2x2` (y `2x1` para `flow.png`) en `tools/assets/preview/`. Cada archivo se optimiza en PNG de 8 bits y se valida que su peso sea inferior a 400 KB.

## Qué se genera

Los diez temas de circuito (`sombrio`, `bosque`, `mar`, `desierto`, `hielo`, `volcan`, `cristal`, `nubes`, `neon`, `jardin`) reciben mapas de `albedo`, `normal` en espacio tangente (convención OpenGL `+Y` arriba, derivados del mismo campo de altura) y `emissive` de bajo brillo para evitar saturar el postprocesado. Para los efectos de flujo y partículas se generan `flow.png` (256x64 RGBA, tileable en X) y `sparkle.png` (64x64 RGBA). Finalmente, los planetas-ciudad y las carreteras usan el juego completo de fachada (`building_albedo`, `building_normal`, `building_emissive`), el mapa normal del casco metálico (`hull_normal`) y las texturas de asfalto (`asphalt`, `asphalt_normal`).

## Garantía de continuidad

Todas las funciones de ruido (fBm, *domain warping*, Voronoi en toro 2D y patrones geométricos) son estrictamente periódicas en el dominio `[0, 512)`, por lo que los bordes opuestos encajan sin costuras visibles ni discontinuidades de gradiente en los mapas normales.
