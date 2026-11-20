# PIEZA OPT — rendimiento de la vista general

Pedido: «que trate de optimizar, en especial en la vista general, los caminos estan bien.»
Los caminos no se tocaron (Paths.jsx intacto).

Conocimiento consultado: rendimiento_web/precarga_por_etapas_con_presupuesto, rendimiento_web/aparicion_gradual_en_el_borde_de_recorte, rendimiento_web/revelado_urgente_frente_a_calentado_de_fondo, medicion_y_pruebas/README.

## Sonda
`front/_capturas/opt_vista.mjs`: vista libre sin ballita, cámara en el encuadre inicial con una órbita fija de
0,0035 rad por cuadro alrededor del objetivo de OrbitControls; Edge real, `--disable-frame-rate-limit --disable-gpu-vsync`
(FPS sin tope), escritorio 1400×900 y móvil 412×915 con deviceScaleFactor 2. Modos `base` (tandas + reparto de draw
calls por capa + coste por capa), `exp` (apagar capas) y `ab` (alterna `window.__opt.off` por tramos de 5 s en la
misma sesión). POV: `front/_capturas/opt_pov.mjs` (ab_aparece.mjs con el interruptor `__opt`).

## Línea base (4a4533a, escritorio)
| tanda | FPS | p5 | calls | tris | geos | texs | heap |
|---|---|---|---|---|---|---|---|
| 1 | 58,8 | 42,8 | 276 | 203 k | 104 | 163 | 298 MB |
| 2 | 66,1 | 57,6 | 273 | 203 k | 104 | 155 | 219 MB |

(La columna de ms de CPU de la sonda salió inválida —mayor que el cuadro— porque la marca del rAF no es el inicio
real del trabajo; no se usa.)

## Qué cuesta (apagar capas 4 s, misma sesión)
| experimento | escritorio FPS | móvil FPS | calls |
|---|---|---|---|
| referencia (tras calentar, ≈ «sin etiquetas Html») | 94-96 | 107 | 273 |
| DPR 0,5 | 99 | 88 | 276 |
| sin planetas (Nodes) | 121,5 | 133,7 | 73 |
| sin caminos (Way) | 95,6 | 106,6 | 253 |
| sin fondo (cielo, galaxias, estrellas) | 96,2 | 108,5 | 262 |
| sin etiquetas Html | 94,1 | 106,7 | 273 |
| sin todo | 168 | 180 | 20 |

Conclusión: la vista general está limitada por CPU (bajar el DPR no cambia nada), y el coste está en los planetas:
~45 draw calls por planeta (de 275 en total). Caminos, fondo y etiquetas Html no pesan. Por capa: cada planeta ≈ 35
mallas MeshStandard (casco y portal de cada terminal, icono de cada destino, monumento) + 9 halos Basic.

## Cambio probado: fusión lejana por material en los planetas (Nodes.jsx)
En el modo lejano de cada planeta (fuera de LOD_NEAR, sin foco y sin hover), el casco y el portal de cada terminal, el
icono y el halo de cada destino y las mallas opacas o aditivas del monumento se hornean en una malla por material,
relativas a la raíz del planeta, y las originales se ocultan (siguen recibiendo hover porque el raycast de three no
mira `visible`). Se rehornea al entrar en modo lejano y, cada ~30 cuadros, si cambió el conjunto (un GLB que llega
tarde). Interruptor A/B: `window.__opt.off = true` vuelve al comportamiento anterior. Contador: `window.__opt.hornea`.

### A/B en la misma sesión (versión ebe6729 + monumento, tramos de 5 s alternos, 6 por modo)
| | FPS on | FPS off | dif | p5 on/off | calls on/off | tris on/off |
|---|---|---|---|---|---|---|
| escritorio 1400×900 | 66,8 | 75,1 | **−11 %** | 55,6 / 63,1 | 200 / 274 (**−27 %**) | 208 k / 201 k |
| móvil 412×915 ×2 | 85,3 | 90,1 | **−5,4 %** | 73,3 / 77,5 | 195 / 270 (−28 %) | 192 k / 192 k |

Resultado: las draw calls bajan un 27-28 %, pero los FPS empeoran. **No cumple las metas y no debe integrarse así.**
Hipótesis principal (sin verificar): rehorneos continuos. La marca de «ocultada por la fusión» vivía en
`userData`, que React reemplaza al re-renderizar (`userData={{ lejos: 1 }}` en línea), así que la comprobación de
vigencia fallaba y cada planeta volvía a fusionar y subir geometrías cada ~30 cuadros (el número de geometrías sube de
195 a 208 durante la corrida, lo que encaja). El arreglo (marca en un WeakSet y contador `__opt.hornea`) está comiteado
y compilado, pero **sin medir**: la A/B (`_capturas/opt/ab3`) se quedó esperando el candado del navegador, que otra pieza
(sep7/geo3) tuvo ocupado de 21:19 a más de las 21:46, y la detuve para entregar a tiempo.

## Pendiente
1. Medir el arreglo: `vite build`, `vite preview --port 4303 --strictPort` y
   `node _capturas/opt_vista.mjs "http://localhost:4303/?stats=1" desk ab _capturas/opt/ab3 <playwright-core/index.mjs> <candado> 30 2`
   (y `movil`). Mirar `hornea` en cada fila: debe quedarse fijo (unos 5, uno por planeta) en los tramos «on».
   Si con el arreglo los FPS no suben ≥ 15 % / 25 %, revertir ebe6729 y los commits siguientes de Nodes.jsx.
2. POV sin regresión: `_capturas/opt_pov.mjs` (A/B con `__opt` siguiendo una ballita); no se llegó a correr.
3. Capturas antes y después: no se tomaron; las de A/B (`opt/ab2/*_ab_on.jpg` / `_off.jpg`) existen pero no las revisé.
4. Pruebas: 81/82 en verde; falló solo `sim.test.js:446` (tope de 3000 ms: 3862 ms con el equipo cargado por la otra
   sonda y la prueba a prioridad baja). Repetirla con el equipo libre.
5. Otras ideas, según el perfil: la vista general está limitada por CPU por objeto, así que lo que más rinde es quitar
   objetos dibujados por planeta. Una alternativa más barata que hornear en cada transición: hornear una sola vez al
   montar (la geometría local no cambia de lejos) y alternar visibilidad, o usar InstancedMesh para iconos y halos de
   los destinos (2 materiales por planeta).
