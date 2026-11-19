# Reporte: estructuras sin invadir otras cintas (rama cambio/caminos-estructuras)

Pruebas en 7e66be5: 66/66 en verde (el defecto 4 queda confirmado como resuelto).

## Colocación (overlap.mjs, línea PIEZAS)
- Se partía de 20 % de piezas quitadas. Semillas 1 a 3 (rama): 80 854 candidatas, 15,4 % quitadas solo con movimientos; con los arcos estrechados queda en ≈12 %.
- overlap 20: la tanda se cortó en la semilla 19 por el límite de tiempo. En 19/19 semillas, estructuras = 0. 515 362 candidatas: 54 299 movidas, 7 800 encogidas y 63 900 quitadas (12,4 %).
- Generación media en la misma tanda, con el equipo cargado: rama 7,0 s y main 8,2 s; la generación es idéntica. main: 0/20 semillas malas en las métricas viejas.
- Diagnóstico (_capturas/diag_arcos.mjs): el 98 % de los arcos que se quitan son de un carril suelto cuya U invade otro carril del mismo tramo de la trenza, a un costado o en el cruce por encima.
- Exactitud (tools/prisma_exacto.mjs, semilla 1): 143 652 consultas, 38 890 positivas, 0 diferencias entre rejilla perezosa y global, 0 muestras fuera de caja.

## Hilo principal (tareas_largas.mjs)
- Antes: 2 800 ms de congelón en la primera llamada a prismaLibre.
- Ahora, etapa «prisma» por tramo: 226–299 ms en total, repartidos en porciones de 12,4 ms como máximo; 51–56 k muestras en vez de 257 k; 0–3 preparaciones síncronas de 3,1 ms como máximo.
- La tarea de 6 973 ms al pulsar la tecla 3 existe también en main (6 874 ms): no viene de este cambio.

## Navegador
| | main | rama |
|---|---|---|
| entrada, peor cuadro (ms) | 66 / 52 / 60 | 65 / 75 / 65 |
| entrada FPS | 50,6 / 61,2 / 65,8 | 73,6 / 78,4 / 67,6 |
| entrada triángulos | 820 k / 824 k / 554 k | 273 k / 122 k / 335 k |
| estable ballita FPS | 67,3 / 72,5 | 74,8 / 74,5 |
| triángulos a los 20 s | 781 k | 208 k / 522 k |

La rama dibuja menos triángulos, así que la subida de FPS no es una mejora probada.

choques3d (escritorio, 300 muestras): anillo_ajeno 0, arco_ajeno 1, pilar_en_calzada 0.
