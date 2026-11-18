# Manifiesto de modelos nuevos

Generados con `front/tools/blender/generar_modelos.py` (Blender 5.2, headless). Un mesh por GLB, color por vértice,
origen en la base (y=0), centrados en XZ. Alto = dimensión Y; la dimensión mayor ronda 1 unidad.
Cargar con `useModeloGeo(nombre)` de `src/Components/World3D/Modelos.jsx`. Tris/dimensiones reales en `_stats.json`.

| nombre | tris | ancho×alto×fondo | tema sugerido | textura sugerida |
|---|---|---|---|---|
| volcan_erupcion | 414 | 1.12×1.00×1.16 | volcán | roca_volcanica / lava_albedo+lava_emissive |
| geiser | 302 | 1.00×0.81×1.00 | volcán, desierto | arena_dunas |
| rampa_roca | 80 | 1.00×0.50×0.80 | volcán, desierto | roca_volcanica |
| rampa_hielo | 80 | 1.00×0.50×0.80 | hielo | hielo_agrietado |
| rampa_madera | 176 | 1.00×0.67×0.80 | bosque, jardín | musgo_bosque |
| cascada_roca | 170 | 1.06×1.00×1.10 | bosque, mar | musgo_bosque |
| isla_nube | 462 | 1.00×0.90×0.98 | nubes | nube_suave |
| puente_cristal | 332 | 1.00×0.58×0.49 | cristal, neón | adoquin_neon |
| alga_larga | 360 | 0.45×1.00×0.22 | mar | coral |
| concha_gigante | 372 | 1.00×0.87×0.98 | mar | coral |
| saguaro_grande | 342 | 0.84×1.00×0.37 | desierto | arena_dunas |
| estalagmita_hielo | 150 | 0.64×1.00×0.56 | hielo | hielo_agrietado |
| geoda | 270 | 0.97×0.62×1.00 | cristal | — |
| lapida | 104 | 0.64×1.00×0.44 | sombrío | — |
| tronco_hueco | 220 | 0.94×1.00×0.86 | bosque | musgo_bosque |
| fuente_jardin | 378 | 1.00×0.91×0.98 | jardín | — |
| hongo_gigante | 301 | 1.04×1.00×1.04 | bosque, jardín | musgo_bosque |
| luciernaga_farol | 218 | 0.48×1.00×0.36 | sombrío, neón | — |
| sombrio_farol | 188 | 0.37×1.00×0.38 | sombrío | — |
| sombrio_altar | 179 | 0.95×1.00×0.97 | sombrío | — |
| bosque_nido | 216 | 1.00×0.35×0.95 | bosque | — |
| bosque_casita | 117 | 1.00×0.96×1.00 | bosque | — |
| mar_boya | 196 | 0.75×1.00×0.76 | mar | — |
| mar_concha | 174 | 1.00×0.46×0.95 | mar | — |
| desierto_oasis | 175 | 1.00×0.63×0.95 | desierto | — |
| desierto_molino | 139 | 0.48×1.00×0.48 | desierto | — |
| hielo_iglu | 170 | 1.00×0.94×0.95 | hielo | — |
| hielo_farol | 188 | 0.37×1.00×0.38 | hielo | — |
| volcan_altar | 179 | 0.95×1.00×0.97 | volcán | — |
| volcan_farol | 188 | 0.37×1.00×0.38 | volcán | — |
| cristal_prisma | 120 | 0.80×1.00×0.57 | cristal | — |
| cristal_arco | 99 | 0.70×1.00×0.34 | cristal | — |
| nubes_globo | 172 | 0.66×1.00×0.65 | nubes | — |
| nubes_casita | 117 | 1.00×0.96×1.00 | nubes | — |
| neon_kiosco | 181 | 0.99×0.59×1.00 | neón | — |
| neon_molino | 139 | 0.48×1.00×0.48 | neón | — |
| jardin_gazebo | 99 | 0.70×1.00×0.34 | jardín | — |
| jardin_flor | 291 | 0.66×1.00×0.66 | jardín | — |

Notas: rampas suben hacia +X; cascada_roca vierte hacia +Z; tronco_hueco está en vertical (rotar 90° para tumbarlo).
Los modelos llevan su color en el vértice; las texturas son tiles opcionales para suelos/superficies, no UV del modelo.
Los 20 modelos de vida se generaron con Blender 5.3 y se reparten de dos en dos entre los diez temas.

## Texturas nuevas (`public/tex`, 512×512, tileables)

lava_albedo, lava_emissive (derivado de lava_albedo), roca_volcanica, arena_dunas, hielo_agrietado, coral, nube_suave,
musgo_bosque, adoquin_neon. Originales de Codex, recortados y con costura suavizada por `tools/blender/postprocesar_tex.py`.
Pendiente: cristal_prisma (cuota de Codex agotada).

## Kit de piezas para pistas kart

Modelos GLB texturizados, con un mesh por archivo, origen en la base y máximo de 900 triángulos. `anillo_neon` conserva banda emisiva blanca con diámetro interior de 1 unidad para teñido por instancia.

| nombre | pieza | tema | tris | dimensiones X×Y×Z | móvil | emisivo |
|---|---|---:|---:|---:|:---:|:---:|
| anillo_neon | aro | común | 800 | 1.34 × 1.34 × 0.28 | no | sí |
| caja_evento | evento | común | 468 | 0.78 × 0.85 × 0.78 | no | sí |
| caja_cambio | cambio | común | 592 | 0.72 × 0.725 × 0.75 | no | sí |
| turbo_placa | turbo | común | 416 | 1.0 × 0.18 × 0.72 | no | sí |
| barrera | barrera | común | 284 | 1.02 × 0.44 × 0.61 | no | no |
| bordillo | bordillo | común | 284 | 1.02 × 0.28 × 0.61 | no | no |
| arco_salida | arco | común | 536 | 1.06 × 0.99 × 0.265 | no | sí |
| tunel_arco | tunel | común | 792 | 1.08 × 0.675 × 0.28 | no | sí |
| pilar | soporte | común | 588 | 0.56 × 0.97 × 0.56 | no | no |
| banderin | bandera | común | 432 | 0.7153 × 1.05 × 0.4305 | no | no |
| farola_pista | farola | común | 496 | 0.5849 × 0.96 × 0.3899 | no | sí |
| rebote_sombrio | rebote | sombrio | 620 | 0.72 × 0.49 × 0.715 | no | sí |
| rebote_bosque | rebote | bosque | 792 | 0.8579 × 0.68 × 0.88 | no | sí |
| rebote_mar | rebote | mar | 556 | 0.84 × 0.5411 × 0.7959 | no | sí |
| rebote_desierto | rebote | desierto | 532 | 0.7191 × 0.75 × 0.56 | no | sí |
| rebote_hielo | rebote | hielo | 384 | 0.96 × 0.35 × 0.8721 | no | sí |
| rebote_volcan | rebote | volcan | 620 | 0.8832 × 0.46 × 0.9059 | no | sí |
| rebote_cristal | rebote | cristal | 288 | 0.8805 × 0.3381 × 0.9023 | no | sí |
| rebote_nubes | rebote | nubes | 616 | 0.8965 × 0.4146 × 0.7572 | no | sí |
| rebote_neon | rebote | neon | 552 | 0.9103 × 0.275 × 0.9103 | no | sí |
| rebote_jardin | rebote | jardin | 644 | 0.8094 × 0.48 × 0.7392 | no | sí |
| deco_sombrio_hito | deco | sombrio | 240 | 0.56 × 0.68 × 0.34 | no | sí |
| deco_sombrio_flora | deco | sombrio | 412 | 0.68 × 0.5748 × 0.64 | no | sí |
| deco_bosque_hito | deco | bosque | 364 | 0.6846 × 0.7577 × 0.5161 | no | no |
| deco_bosque_flora | deco | bosque | 300 | 0.7549 × 0.3276 × 0.7037 | no | no |
| deco_mar_hito | deco | mar | 548 | 0.76 × 0.74 × 0.7485 | no | sí |
| deco_mar_flora | deco | mar | 440 | 0.5289 × 0.6961 × 0.4695 | no | no |
| deco_desierto_hito | deco | desierto | 292 | 0.9913 × 0.6577 × 0.3171 | no | no |
| deco_desierto_flora | deco | desierto | 760 | 0.56 × 0.655 × 0.56 | no | no |
| deco_hielo_hito | deco | hielo | 140 | 0.5473 × 0.8639 × 0.5035 | no | sí |
| deco_hielo_flora | deco | hielo | 720 | 0.546 × 0.99 × 0.56 | no | no |
| deco_volcan_hito | deco | volcan | 416 | 0.6708 × 0.94 × 0.6708 | no | sí |
| deco_volcan_flora | deco | volcan | 188 | 0.6415 × 0.541 × 0.632 | no | sí |
| deco_cristal_hito | deco | cristal | 160 | 0.5812 × 0.84 × 0.5812 | no | sí |
| deco_cristal_flora | deco | cristal | 80 | 0.5625 × 0.7419 × 0.4839 | no | sí |
| deco_nubes_hito | deco | nubes | 372 | 0.6 × 0.95 × 0.6 | no | no |
| deco_nubes_flora | deco | nubes | 680 | 0.86 × 0.5494 × 0.5862 | no | no |
| deco_neon_hito | deco | neon | 468 | 0.4294 × 0.8986 × 0.4294 | no | sí |
| deco_neon_flora | deco | neon | 228 | 0.48 × 0.76 × 0.48 | no | sí |
| deco_jardin_hito | deco | jardin | 508 | 0.546 × 0.95 × 0.56 | no | no |
| deco_jardin_flora | deco | jardin | 656 | 0.6227 × 0.7 × 0.6547 | no | no |
