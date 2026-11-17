# Generador de sprites de efectos y expresiones chibi

Este documento describe el script `generate_sprites.py`, encargado de producir los sprites con canal alfa usados por los efectos de obstáculos y las expresiones chibi de las ballitas en `public/tex/`.

## Cómo regenerar los sprites

Desde la carpeta `front/`, ejecuta el generador con Python 3 (requiere `numpy` y `Pillow`):

```bash
python tools/assets/generate_sprites.py
```

El script genera nueve archivos PNG de 128x128 píxeles en `public/tex/` y actualiza la hoja de contacto `tools/assets/preview/sprites_sheet.png` sobre un fondo de tablero para inspeccionar las transparencias. Cada archivo se renderiza primero a 512x512 con alfa premultiplicado y se reduce mediante filtro Lanczos para evitar halos oscuros y dientes de sierra, validando que su peso sea inferior a 200 KB.

## Qué se genera

Para los efectos de partículas y eventos de ruta se crean cinco texturas: `fx_spray.png` (cúmulo de gotas cristalinas con brillo especular para cascadas y géiseres), `fx_smoke.png` (nube de humo suave multicapa tintable), `fx_ember.png` (brasa incandescente con gradiente térmico y chispas asimétricas), `fx_foam.png` (espuma aireada de burbujas blancas) y `fx_ring.png` (aro de onda expansiva tintable).

Para el rostro y las reacciones de las ballitas se generan cuatro sprites chibi: `chibi_eye.png` (ojo grande expresivo con pestaña curva, iris con degradado azul-cian y doble brillo especular), `chibi_sparkle.png` (destello de cuatro puntas estilizadas con dos satélites), `chibi_blush.png` (rubor rosado-coral suave con tres trazos diagonales) y `chibi_star.png` (estrella redondeada en tonos crema y dorado).
