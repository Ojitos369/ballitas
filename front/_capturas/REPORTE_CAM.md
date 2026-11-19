# REPORTE CAM — cámara en planeta y salida móvil

Conocimiento consultado: grafica_3d/mds/camara_de_seguimiento_sin_oclusion.md, ui_visual/mds/vista_limpia_con_jerarquia_de_foco.md

## Cambios y commits

- `3f1dbfd`: corregí la curva de disolución por trama del foco. `smoothstep` recibía sus límites en orden inverso, operación indefinida en GLSL; ahora se calcula una caída creciente de opacidad hacia el borde del cono. La ruta de CPU no añade raycasts ni recorridos de escena.
- `39f04a8`: si se sale de un planeta sin zoom previo guardado, inicializo el zoom objetivo y suavizado a `0.15` (espalda). Un zoom existente se conserva.
- Hash funcional final: `39f04a8`.

## Métricas

| Medición | Antes | Después |
|---|---:|---:|
| Primera salida móvil, ballita en cuadro | 52,9 % (104/197 cuadros, sonda `pov_unico`) | 100 % (166/166 cuadros) |
| Entrada móvil, ballita en cuadro | 100 % (109 cuadros) | 100 % en la sonda final (558 cuadros totales; salida incluida) |
| Salidas móviles siguientes | 100 % (108 cuadros) | 100 % (la primera salida tras arranque) |
| Planeta, bloques casi lisos en capturas de escritorio | — | 25,8–55,6 % en 5 capturas |
| Planeta, bloques casi lisos en capturas móviles | — | 22,4–42,4 % en 5 capturas |
| Oclusión real por raycast edificio→ballita durante 20 s en cada mundo | sin medición | sin medición; no se afirma cumplimiento de ≥95 % |
| Coste incremental del cambio de disolución | — | no medido directamente; no añade trabajo por cuadro en CPU |

Las sondas de planeta solo alcanzaron Alba, Cima y Delta en 300 s por formato; faltan Brasa y Eco y ventanas continuas de 20 s. La tentativa a 8× terminó sin capturas porque agotó la población. Por eso la meta de cinco planetas y la métrica raycast quedan **sin verificar**. El indicador de bloques lisos sí permaneció por debajo de 60 % en cada captura válida.

La métrica de salida usa la proyección 3D de `selected.pos` en cada cuadro, incluyendo profundidad. El informe previo registraba 43,1 % (103/181); la reproducción actual dio 52,9 % (104 cuadros) en el primer intento, con fallas principalmente durante los primeros cuadros de profundidad, y 100 % al repetir con el nuevo zoom inicial. El muestreo final guardó 166 cuadros de la primera salida.

## Capturas abiertas y juicio visual (una línea por imagen)

- Antes, [desk_entrada_planeta.jpg](pov2/desk_entrada_planeta.jpg): el volumen gris del destino ocupa gran parte del encuadre y apenas deja asomar a la ballita.
- Después, [desk_01_Alba_at_600.jpg](cam_after/desk_01_Alba_at_600.jpg): ballita y plaza central despejadas; el edificio queda al costado.
- Después, [desk_03_Cima_at_600.jpg](cam_after/desk_03_Cima_at_600.jpg): ballita visible frente al árbol y el destino verde; no domina el encuadre una superficie gris.
- Después, [desk_04_Delta_toPort_600.jpg](cam_after/desk_04_Delta_toPort_600.jpg): ballita centrada sobre la calzada, puerto legible al lado.
- Después, [movil_01_Alba_at_600.jpg](cam_after/movil_01_Alba_at_600.jpg): ballita y destino completos en formato vertical.
- Después, [movil_03_Cima_toPort_600.jpg](cam_after/movil_03_Cima_toPort_600.jpg): salida legible en móvil con ballita dentro del cuadro.
- Antes, [movil_espalda_00_salida_0.25s_travel.jpg](cam_pov2/movil_espalda_00_salida_0.25s_travel.jpg): el cuerpo se ve en esta captura puntual, aunque el seguimiento por cuadro pierde profundidad/encuadre durante la primera salida.
- Después, [movil_espalda_00_salida_0.25s_travel.jpg](cam_pov_fixed/movil_espalda_00_salida_0.25s_travel.jpg): ballita entera sobre el camino a los 0,25 s; escena no lisa.
- Después, [movil_espalda_01_salida_1.2s_travel.jpg](cam_pov_fixed/movil_espalda_01_salida_1.2s_travel.jpg): ballita centrada y carretera legible a los 1,2 s.
- Después, [movil_espalda_02_salida_2s_travel.jpg](cam_pov_fixed/movil_espalda_02_salida_2s_travel.jpg): cuerpo completo en ruta a los 2 s, sin pantalla cian uniforme.

## Validación

- `pnpm test` después de `git merge main`: 80/80 pasan (373,1 s).
- `npx vite build`: correcto tras ambos cambios (advertencia existente de bundle >500 kB).
- Integración pedida: `git merge main` → `Already up to date`.
- Las sondas reportaron dos respuestas HTTP 500 de `/api/catalogo` o `/api/mundos`, también consignadas en el informe POV anterior; la escena 3D y las capturas sí se generaron.

