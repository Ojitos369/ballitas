# Manifiesto del kit urbano por bioma (`public/models/ciudad/`)

Generados con `front/tools/blender/generar_ciudad.py` (Blender 5.3, headless).
Convención: un solo mesh por GLB, color por vértice (`COLOR_1`/`COLOR_0`), UVs limpias en fachadas,
origen en la base (`y=0`), centrados en XZ, altura ~1.0, formas suaves y `<= 800` triángulos.

| modelo | tris | ancho×alto×fondo | bytes |
|---|---|---|---|
| bosque_casa | 140 | 1.000×1.000×0.935 | 9468 |
| bosque_comercio | 184 | 0.926×1.000×1.020 | 11884 |
| bosque_estacion | 276 | 0.980×1.000×0.940 | 18164 |
| bosque_parque | 566 | 1.020×1.000×0.994 | 24560 |
| bosque_rascacielos | 140 | 0.940×1.000×0.940 | 9516 |
| bosque_torre | 158 | 0.840×1.000×0.840 | 9392 |
| cristal_casa | 86 | 0.920×1.000×0.860 | 6844 |
| cristal_comercio | 264 | 0.926×1.000×1.020 | 15804 |
| cristal_estacion | 276 | 0.980×1.000×0.940 | 18168 |
| cristal_parque | 566 | 1.020×1.000×0.994 | 24564 |
| cristal_rascacielos | 154 | 0.940×1.000×0.940 | 9912 |
| cristal_torre | 78 | 0.840×1.000×0.840 | 6356 |
| desierto_casa | 176 | 1.020×1.000×0.953 | 11040 |
| desierto_comercio | 264 | 0.926×1.000×1.020 | 15808 |
| desierto_estacion | 276 | 0.980×1.000×0.940 | 18168 |
| desierto_parque | 566 | 1.020×1.000×0.994 | 24568 |
| desierto_rascacielos | 220 | 0.949×1.000×0.949 | 13436 |
| desierto_torre | 106 | 0.840×1.000×0.840 | 8820 |
| hielo_casa | 146 | 0.920×1.000×0.860 | 9092 |
| hielo_comercio | 264 | 0.926×1.000×1.020 | 15796 |
| hielo_estacion | 276 | 0.980×1.000×0.940 | 18160 |
| hielo_parque | 566 | 1.020×1.000×0.994 | 24384 |
| hielo_rascacielos | 154 | 0.940×1.000×0.940 | 9904 |
| hielo_torre | 134 | 0.840×1.000×0.840 | 8012 |
| jardin_casa | 140 | 1.000×1.000×0.935 | 8764 |
| jardin_comercio | 184 | 0.926×1.000×1.020 | 11884 |
| jardin_estacion | 276 | 0.980×1.000×0.940 | 18164 |
| jardin_parque | 566 | 1.020×1.000×0.994 | 24384 |
| jardin_rascacielos | 140 | 0.940×1.000×0.940 | 9516 |
| jardin_torre | 158 | 0.840×1.000×0.840 | 9392 |
| mar_casa | 306 | 1.000×1.000×0.954 | 14284 |
| mar_comercio | 270 | 0.926×1.000×1.020 | 14816 |
| mar_estacion | 276 | 0.980×1.000×0.940 | 18156 |
| mar_parque | 566 | 1.020×1.000×0.994 | 24376 |
| mar_rascacielos | 270 | 0.940×1.000×0.940 | 14120 |
| mar_torre | 318 | 0.840×1.000×0.840 | 14832 |
| neon_casa | 176 | 1.020×1.000×0.953 | 11028 |
| neon_comercio | 264 | 0.926×1.000×1.020 | 15796 |
| neon_estacion | 276 | 0.980×1.000×0.940 | 18156 |
| neon_parque | 566 | 1.020×1.000×0.994 | 24556 |
| neon_rascacielos | 240 | 0.940×1.000×0.940 | 15132 |
| neon_torre | 176 | 0.840×1.000×0.840 | 11032 |
| nubes_casa | 306 | 1.000×1.000×0.954 | 14288 |
| nubes_comercio | 270 | 0.926×1.000×1.020 | 14820 |
| nubes_estacion | 276 | 0.980×1.000×0.940 | 18160 |
| nubes_parque | 566 | 1.020×1.000×0.994 | 24384 |
| nubes_rascacielos | 270 | 0.940×1.000×0.940 | 14124 |
| nubes_torre | 318 | 0.840×1.000×0.840 | 14840 |
| sombrio_casa | 146 | 0.920×1.000×0.860 | 9800 |
| sombrio_comercio | 264 | 0.926×1.000×1.020 | 15804 |
| sombrio_estacion | 276 | 0.980×1.000×0.940 | 18168 |
| sombrio_parque | 566 | 1.020×1.000×0.994 | 24564 |
| sombrio_rascacielos | 154 | 0.940×1.000×0.940 | 9912 |
| sombrio_torre | 134 | 0.840×1.000×0.840 | 8016 |
| volcan_casa | 176 | 1.020×1.000×0.953 | 11036 |
| volcan_comercio | 264 | 0.926×1.000×1.020 | 15800 |
| volcan_estacion | 276 | 0.980×1.000×0.940 | 18164 |
| volcan_parque | 566 | 1.020×1.000×0.994 | 24560 |
| volcan_rascacielos | 220 | 0.949×1.000×0.949 | 13432 |
| volcan_torre | 106 | 0.840×1.000×0.840 | 8816 |
