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

Notas: rampas suben hacia +X; cascada_roca vierte hacia +Z; tronco_hueco está en vertical (rotar 90° para tumbarlo).
Los modelos llevan su color en el vértice; las texturas son tiles opcionales para suelos/superficies, no UV del modelo.

## Texturas nuevas (`public/tex`, 512×512, tileables)

lava_albedo, lava_emissive (derivado de lava_albedo), roca_volcanica, arena_dunas, hielo_agrietado, coral, nube_suave,
musgo_bosque, adoquin_neon. Originales de Codex, recortados y con costura suavizada por `tools/blender/postprocesar_tex.py`.
Pendiente: cristal_prisma (cuota de Codex agotada).
