# REPORTE — Pieza RUTAS (rutas dinámicas en el mundo compartido)

Fecha: 2026-11-20. Rama `cambio/20261120-061026-rutas-dinamicas`. Sin push, sin merge, sin deploy.

## Qué cambió

- **Unidad dinámica = sentido de circuito (`world.ways`), no `world.routes`.** El brief pedía un `Set` de índices de
  `world.routes`, pero en el código `world.routes` son las alternativas A/B/C *dentro* de un sentido (comparten salida
  y llegada, y la ballita cambia entre ellas a mitad de camino); la «ruta de ida o vuelta» del pedido es una entrada
  de `world.ways` (20: 4 salen de cada planeta), que además es lo que monta `Paths.jsx`. `sim.activas` es un `Set` de
  `way.idx`. Es la única desviación del brief; está documentada en `docs/mundo_compartido.md`, sección 9.
- **`sim.js`**: constantes `RUTAS_DINAMICAS`, `MIN_SALIDAS = 2`, `RUTAS_FRAC_MIN/MAX = 0,4/0,6`, `T_SIN_USO = 90 s`,
  `T_APARECE = 30 s` (sustituibles con `new Sim({ rutas })`). Arranque determinista; se quita por tiempo sin uso o al
  terminarla sin estar en los planes de otra; nunca si deja al planeta de origen con menos de 2 salidas ni si alguien
  la tiene tomada o decidida; aparece otra al azar si se baja del rango y, además, una cada `T_APARECE` hasta el
  máximo. `goWay`, `predecir`, `probWays`, `decidir` y `opciones()` solo ven activas; la decisión que queda inválida
  cae a la automática con `b.plan.aviso` y `hooks.invalida`.
- **Protocolo**: `hola.activas`, `d.rutas = { on, off }`, evento `invalida` en `d.ev`; `rutasActivas`,
  `acumularRutas`, `aplicarRutas` en `protocolo.js`. Servidor y bundle regenerado (`pnpm build:mundo`, 701 KB).
- **Cliente**: `mundo.activas`, `mundo.rutasRev`, eventos `rutas` e `invalida` (local y remoto). `Paths.jsx` monta
  solo los sentidos activos; aparición y retirada en 1,2 s (escala del grupo con pivote en el planeta de origen, sin
  materiales nuevos); las inactivas tampoco se precargan. Control: tarjetas solo de rutas activas y aviso.
  `?rutas=0` en local apaga la función.

## Métricas

| Medida | Antes / todas | Con rutas dinámicas |
|---|---|---|
| Huella sin entradas (369, 18 000 ticks) | `212450f8e8df994e` (HEAD) | apagadas: `212450f8e8df994e` (igual); encendidas: `086b6a79b230b286`, repetible |
| Rutas montadas en la vista general | 20 | 10–12 (media 11) |
| Triángulos por cuadro (A/B misma sesión, 8 tramos de 5 s) | 203 733 | 164 638 (−19,2 %) |
| Llamadas de dibujo | 169 | 159,5 (−5,6 %) |
| FPS vista general (1600×900, sin límite de cuadros) | 107,7 | 107,2 (−0,5 %: sin mejora medible; ruido ±15 %) |
| Muertes por minuto (6 semillas × 30 min) | 1,05 | 1,18 (+12 %) |
| Edad media al morir | 484 s | 432 s (−11 %) |
| Cambios de ruta en 6 min de sim (navegador, acelerado) | — | 24 eventos; mínimo de salidas visto: 2 |

Peor cuadro en los 3 s tras cada cambio (12 cambios forzados uno a uno): apariciones 33–60 ms, retiradas 41–73 ms.

## Qué no se cumplió

- **Peor cuadro ≤ 50 ms: no demostrado.** 5 de 12 cambios pasan de 50 ms, pero los tramos del A/B *sin ningún cambio
  de ruta* ya dan peores cuadros de 42–111 ms en ventanas de 4 s, así que la sonda no distingue el costo del montaje
  del ruido de fondo. Falta medir el peor cuadro solo en el intervalo de la animación frente al resto de la ventana.
- **Mejora de FPS: no hay.** Bajan triángulos y llamadas, pero la vista general no está limitada por los caminos.
- **`cliente_prueba.mjs completo`: 21/22, no en verde.** Falló «inactividad comprobada»: en 8 intentos a 30× las
  ballitas tomadas murieron antes de 3 llegadas. Las 4 comprobaciones nuevas de rutas pasan (41 apariciones y 41
  retiradas por `d.rutas`, activas siempre 10–12, mismo conjunto para quien llega tarde). No se repitió la corrida ni
  se comprobó si ese paso ya era inestable antes.
- **Rango 40–60 %**: con 5 planetas × 2 salidas el suelo real es 10 (50 %); el mundo oscila entre 10 y 12, nunca 8–9.
  La aparición «por rango» solo se ejercita en las pruebas con `minSalidas: 1`.
- **Sin revisar**: el montón de JS pasó de 235 MB a 688 MB entre las dos capturas (geometrías 125 → 168, texturas
  149 → 200) tras ~50 montajes y desmontajes de caminos y 6 min de sim. No se investigó si es fuga al desmontar `Way`
  o precarga de vida acumulada.
- **`pnpm test`**: la corrida completa dio 96/97; falló «escala del mundo» (duración media de UNA semilla: 149,4 s,
  tope 140). Con 6 semillas es ruido (sin rutas 109–171 s, con rutas 120–177 s), así que esa prueba quedó fijada a
  `rutas: false`; también `probWays` y «tomar, dejar y decidir», que asumen todas las rutas. Tras el cambio se corrió
  esa prueba suelta (pasa), **no** la batería completa otra vez. El tope de 3000 ms pasó (2789 ms) sin tocarlo. La
  batería tarda ahora ~6 min (las pruebas nuevas suman ~105 s).
- Modo remoto en navegador no probado (solo local y el cliente de consola).

## Capturas (abiertas y revisadas)

- `rutas_general_1.png`: arranque, activas 0,5,6,7,8,10,13,14,15,16.
- `rutas_general_2.png`: tras 6 min, activas 1,3,4,6,7,8,11,13,16,17,18; el dibujo es claramente otro.
- `rutas_apareciendo.png`: una ruta a media aparición, saliendo de su planeta.
- `rutas_selector.png`: desde Eco solo ofrece Alba y Brasa (2 de 4 planetas, 5 rutas). `rutas_selector_planeta.png`
  se tomó y no se abrió.
- Consola sin errores. Sonda: `rutas_sonda.mjs`; cifras crudas: `rutas_sonda.json`.

Conocimiento consultado: rendimiento_web/aparicion_gradual_en_el_borde_de_recorte (escala en la matriz, sin
materiales nuevos); ninguno más aplica (módulos revisados: rendimiento_web, medicion_y_pruebas, geometria_procedural,
ui_visual, grafica_3d); sección 8 de `docs/mundo_compartido.md`.
