# REPORTE_SEP — separación de caminos

## Sesión 2 (2026-11-19)

**Resultado: la meta NO se cumplió.** La rama queda en el estado del anillo (WIP de la sesión 1, comiteado) con main mezclado. El intento de esta sesión (fila paralela sin giro) está guardado en el commit `f831007` y revertido en `1ec3d53` porque empeoraba pruebas y tiempos.

### Qué se hizo
1. `76977a5` wip: anillo + fila (rizo, embudo) + medidor `tools/separacion.mjs`. `pnpm test` con ese estado: 2 fallos, el tope de tiempo de `sim.test.js:446` (carga) y `layout.test.js` semilla 7 (carriles del anillo a 7.05 u en `w15 sacacorchos/r2 L0@0.93 vs L1@0.92`).
2. `f831007` experimento: se quitó el giro `theta = … + u·TAU`. Carriles lado a lado a lo largo de `T × up` (ángulo 0 de `wallFrame`), normal compartida (`rollAt` = 0), hueco `rowGap(n) = min(26, 2·BRAID_A/(n−1))` con `BRAID_A = 36` y envolvente igual al de antes (`ENV_PAD`).
3. `1ec3d53` revierte el experimento. Después, `git merge main` sin conflictos.

### Mediciones (`node tools/separacion.mjs`, metas 28.2 u de altura y 11.7 u de aire)
Antes = anillo WIP, 3 semillas (369-371), medición del orquestador. Después = experimento de fila, 10 semillas (369-378). Las cifras no son comparables una a una por el número de semillas; entre paréntesis, la fila con 3 semillas (con `BRAID_A = 35`).

| Clase | Anillo WIP (3 semillas) | Fila sin giro (10 semillas) |
|---|---|---|
| tramo:libre gálibo | 72 876 (minH 19.3) | 3 540 (minH 12.8) (3 semillas: 305) |
| tramo:libre lateral | 114 (minD 4.8) | 934 920 (minD 4.2) (3 semillas: 319 010) |
| ruta:libre gálibo / lateral | 19 (13.7) / 29 (6.5) | 72 (9.8) / 148 (2.1) |
| rutas:libre | 0 pares | 2 pares, lateral 28 (minD 7.7) |
| ways:libre | 0 pares | 1 par, lateral 11 (minD 7.6) |
| ways:union gálibo / lateral | 506 (15.4) / 466 (3.8) | 1 827 (14.9) / 1 803 (0.0) |
| rutas:union gálibo | 739 (17.3) | 8 487 (13.4) |
| tramo:union | minH −0.6, minD 0.0 | minH −0.9, minD 0.0 |

Tiempo de generación (misma máquina, cargada): main 4.3 / 5.8 / 4.5 s (semillas 369-371); fila 14.6 / 21.7 (mundo fallido) / 7.1 s. Límite pedido: 1.3 × main. No se midió el anillo en la misma tanda (el orquestador dio 3.8-6.6 s).

### Por qué no sirve la fila tal como quedó
- Quita casi todos los cruces por encima dentro del tramo (gálibo 72 876 → 305 en las mismas 3 semillas), que es lo que se ve en la captura del usuario.
- Pero 5 carriles con aire ≥ 11.7 u necesitan un semiancho de ~52 u (hoy 28 u). Con `BRAID_A = 52` y también con `SIZE_K = 3.9`, `SPREAD_K = 1.9` el reparto falla (mundos `[FALLÓ]`, 20-35 s por mundo). No se encontró en esta sesión qué restricción lo impide (sospecha: abanico de rutas junto a los hubs y zona de puertos).
- Limitada al envolvente actual, la fila de 4 y 5 carriles queda con 6-12 u de aire (de ahí el lateral de tramo), se pellizca en las aperturas de salida/llegada y se dobla sobre sí misma en espiral y sacacorchos; `layout.test.js` falla en las semillas 369, 7 y 11 (huelgo) y 369 (cintas visibles).
- Sin `braidCap` la fila no se estrecha en curvas cerradas dentro de su plano; con él, los carriles se acercan a menos de `RIBBON_CLEAR`.

### No hecho
- Paso 1 (meta en 10 semillas), paso 2 (ampliar el mapa con éxito), paso 3 (≤ 1.3 × main) y paso 4 (prueba nueva en `layout.test.js`, build y capturas en navegador). No se abrió navegador.
- La nota `separacion_visible_en_marco_local.md` no se pudo leer en esta sesión (permiso de lectura denegado fuera del worktree).

### Propuesta para continuar
1. Partir de `f831007` (`git cherry-pick` o `git revert 1ec3d53`).
2. Resolver primero el reparto con envolvente ancho (medir qué criterio de `placeWay`/`routeSlack` rechaza con `BRAID_A = 52`) o decidir con el usuario bajar a 3 carriles por camino (caben con 26 u de hueco en el envolvente actual).
3. Fila en espiral y sacacorchos como copias trasladadas a lo largo del eje de la hélice (como rizo y embudo), con `PITCH` acorde al ancho nuevo.
4. Aperturas: dirección de la fila con transporte paralelo y sin curvas en su plano más cerradas que el semiancho.

Conocimiento consultado: separacion_visible_en_marco_local (no se pudo releer en esta sesión: permiso denegado).

### Estado final de la rama
`pnpm test` tras revertir y mezclar main: 77 pruebas, 76 pasan, 1 falla (`layout.test.js` semilla 7, carriles del anillo a 7.05 u en un sacacorchos). No se hizo build ni navegador.
