# Vida por tema: cada camino es un diorama

Esta carpeta da a cada camino su contenido único. La regla de fondo es que cada tubo de cristal es un terrario: dentro vive un mini mundo del tema, recorrido por la pista de la ballita. Desde fuera, a través del cristal, se lee como un mapa en miniatura iluminado; al seguir a una ballita o en POV, se recorre por dentro. Fuera del tubo solo quedan la estructura (abrazaderas, pilones, neón) y las siluetas de los landmarks monumentales que ya dibuja `Paths.jsx`. Lo que hoy sigue decorando el exterior (árboles, tribunas, carteles, props) debe migrar poco a poco a estos módulos.

## Archivos

- `index.js` es el registro. `getVida(themeId)` devuelve el componente del tema, o uno vacío si no existe. `VidaDeCamino` lo monta dentro de un `VidaGuard`, así que si un módulo falla se apaga solo ese módulo y el resto de la escena sigue.
- `base.jsx` reúne las utilidades compartidas. Los módulos las importan, pero nunca las modifican para un tema concreto. Si algo hace falta para varios temas, se agrega aquí.
- `ciudad.jsx` es la capa común de mini ciudad-hábitat: `index.js` la monta junto al módulo de cada tema (en su propio `VidaGuard`). Llena la pared entre carriles con manzanas, parques, grúas, rótulos de neón y vapor, y dibuja cada `switch` como pieza urbana (autopista por la pared, rampa con estela y pista de aterrizaje, o par de portales) con torre-elevador y rótulos del carril destino. Su estilo por tema vive en `CIUDAD` de `base.jsx`; un tema que quiera evitar duplicar edificios puede leer `cityStyle(id)`. La banda exterior blanca del túnel está en `../tunel.jsx`.
- `<id>.jsx` es un archivo por tema (sombrio, bosque, mar, desierto, hielo, volcan, cristal, nubes, neon, jardin). Cada uno se edita por separado y no importa a ningún otro módulo de tema, para que varios agentes puedan trabajar en paralelo sin choques.

## Contrato del componente

Cada módulo exporta por defecto `Vida({ way, world, detail, focused, time })`, que `Paths.jsx` monta dentro del grupo de su `Way`.

- `way` es el sentido del circuito (ver el contrato de `Core/world.js`). Usa `routeInfo(way)` para leerlo cómodamente.
- `world` es el mundo completo, útil para nombres de nodos y destinos.
- `detail` es un objeto `{ value }` con el LOD de 0 a 1 (el mismo uniform `uDetail` que usan los materiales del tubo). Con 0 el camino se ve de lejos, como diorama; con 1 se está dentro. Se lee en `useFrame`. Nunca debe disparar un re-render.
- `focused` vale true cuando no hay selección o cuando este camino es el de la ballita seleccionada.
- `time` es un objeto `{ value }` con el reloj compartido en segundos.

El grupo que envuelve al módulo es visible cuando `detail > 0.05` o cuando el camino está en foco. Así, sin selección, todos los dioramas se ven por el cristal, y al seguir a una ballita solo queda vivo su camino (más los cercanos). Dentro del módulo, el LOD fino lo decide cada tema: a detalle 0 basta con colores, luces cálidas y criaturas como puntos vivos; a detalle 1 va todo el detalle.

## Geometría del interior

El marco de cada tramo es el mismo que usa `Paths.jsx` para el piso y los rieles: `pos` en el eje, `T` tangente, `up` del suelo hacia el eje y `right = up × T`. Los marcos se calculan una vez y quedan en caché por tramo con `segFrames(seg)`. Esa función es una copia fiel de `buildCurveFrames` de `Paths.jsx`: si una cambia, la otra debe cambiar igual.

Sobre la pared, un ángulo de 0 es el suelo, los ángulos positivos giran hacia `right` y ±π es el techo. `offset` es la distancia desde la pared hacia el eje. `seg.radius` es el radio interior del cristal, así que nada debe pasar de ahí. Como regla, el mini mundo ocupa como mucho `FILL` (60 %) de la sección. `maxHeight(seg)` da ese límite, y el cauce de cada carril queda libre para la ballita (`laneGap(seg, angle)` devuelve la distancia angular al carril más cercano). La escala es de miniatura: casitas, árboles y criaturas diminutos frente a la ballita, cuyo radio es `BALL_R`, de 0.5.

Los tramos `air` (trampolín, cañón, caída, géiser, erupción, portal) no tienen tubo. Las utilidades los saltan. Si un tema quiere contenido ahí, debe colocarlo a mano alrededor de la curva.

## Carriles y mecanismos

La pista es un riel 3D pegado a la pared interior en cualquier orientación (suelo, paredes, techo), y la gravedad de la ballita apunta a la pared por la que rueda. Los carriles los implementa otro agente en `world.js` y `sim.js` con este contrato: `segment.lanes[]` con `{ id, angle, offset, width }` y `segment.switches[]` con `{ u, from, to, kind, duration }`, más el helper `laneFrame(segment, laneId, u)`, que devuelve `{ pos, tangent, up, side }` con `up` hacia el eje. Mientras no exista, `base.jsx` supone un único carril 0 en el suelo y ofrece su propio `laneFrame`. En cuanto `world.js` exporte `laneFrame`, se usa ese automáticamente.

Los elementos del mini mundo son los mecanismos que cambian de carril a la ballita: rampas, trampolines, turbinas, portales, imanes, bumpers, compuertas, géiseres, cintas, hélices, tirolinas, resortes y remolinos. Cada uno debe ser parte coherente del paisaje, como un tronco-rampa o una liana-tirolina en el bosque, o una erupción que catapulta al carril superior en el volcán. Para cada `switch` del tramo, el módulo coloca el mecanismo de su `kind` en `u`, con la entrada anclada al carril `from` y la salida al carril `to` (ambos con `laneFrame`), y lo anima durante `duration`. Los anclajes deben quedar claros: un aro, una placa o una boca justo sobre el riel.

## Utilidades de base.jsx

- `routeInfo(way)` devuelve el tema, `V` (los VISUALS), el radio, los tramos con `{ kind, event, speedK, length, start, mid, lanes, switches }`, las rutas con su `profile` y los tramos compartidos y de evento. Queda en caché por `way`.
- `placeAlong(seg, u, offset, angle)` devuelve `{ pos, quat, up, tangent, side, center, R }`: Y local apunta al eje y Z local a la tangente. En bucles por frame se usa `placeAlongInto` con un objeto de `makePlacement()`, para no crear objetos.
- `segPath(segs)` arma un camino continuo sobre varios tramos con `locate(s)` y `arcOf(seg, u)`.
- `useInstanced(geo, mat, items)` e `<Instanced>` sirven para instanciar. Cada item lleva `{ pos, quat, scale, color }`, y las matrices se escriben solo cuando cambian los items.
- `CanvasText(texto, estilo)`, `textMaterial(ct)` y `<Billboard>` dan carteles con textura y material en caché por texto y estilo. `faceCamera` usa el Billboard de drei.
- `<Critter>` son criaturas instanciadas que patrullan el tubo con un vaivén suave, se balancean y reaccionan a las ballitas cercanas: saltan y se apartan de su ángulo de rodado.
- `<EventStage segment render>` monta contenido alrededor de un tramo y mantiene un objeto `stage` con `phase` (`idle`, `teaser`, `climax` o `salida`), `k` e `intensity` suavizada. `render` se llama una vez, y sus hijos leen `stage` en su propio `useFrame`.
- `buildTerrainGeo(seg, opts)` genera el piso ondulado suave que rodea la pista, con rampas hacia el cauce, fundido con la pared en los bordes y con colores de vértice. Se usa con un material `vertexColors` y `side: DoubleSide`.
- `buildSkyGeo(seg, opts)` genera el casquete del "cielo" interior pegado a la pared, con un degradado de suelo a techo.
- `getBallitas()` devuelve las ballitas vivas de la simulación (`Paths` las publica en `VIDA_BUS` en cada frame).
- `Soundless` y `useSonido()` son marcadores explícitos: el juego no tiene audio.
- `<CartelesDeRuta>` es el ejemplo común: un cartel miniatura por ruta, junto al carril, con el nombre del camino y la ruta con su perfil.

## Rendimiento

Todo lo repetido se instancia. Las geometrías y los materiales se crean en `useMemo` o en caché a nivel de módulo, nunca por frame ni por render. Los `useFrame` solo escriben en buffers y uniforms ya existentes. Las formas deben ser suaves (esferas, cápsulas, tubos con suficientes segmentos, ondulaciones con smoothstep), nunca poligonales duras. Lo transparente usa `depthWrite: false` salvo que se necesite oclusión.

## Cómo agregar contenido a un tema

Edita solo `<id>.jsx`. Usa `routeInfo` para recorrer los tramos y decide el paisaje por tramo y por evento: aldea a la salida, bosque en la entrada de ruta, el hito del evento con su `EventStage` y un remate a la llegada. Pon el terreno con `buildTerrainGeo`, el cielo con `buildSkyGeo`, la decoración con `scatter` e `Instanced`, las criaturas con `Critter` y los mecanismos de cambio de carril en cada `switch`. Si necesitas una utilidad nueva, agrégala a `base.jsx` sin cambiar el comportamiento de las existentes.
