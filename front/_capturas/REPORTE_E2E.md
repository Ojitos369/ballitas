# REPORTE E2E — Montaje final y prueba de punta a punta del mundo compartido con control

Fecha: 2026-11-19. Rama `cambio/20261120-integracion-mundo` (P1 + P2 + P3 sobre main). Sin push, sin merge y sin despliegue.

Conocimiento consultado: ninguno aplica (pendiente); sección 8 de docs/mundo_compartido.md

## Resultado en una línea

El mundo compartido funciona de punta a punta con dos espectadores: mismas ballitas en las mismas posiciones, formar y
fila, entrada al morir otra, decisiones cumplidas, dejar y tomar, pérdida por inactividad y reconexión. `pnpm test`
91/91 y build en verde. Consola sin errores en ambos clientes. Nada desplegado.

## Qué cambió (paso 1, cableado)

| Archivo | Cambio |
|---|---|
| `front/src/Pages/Main/index.jsx` | Monta `<Control mundo={sim} selected={selected} onSelect={selectCtrl} />` (callback estable) y deja `window.__mundo` para las sondas |
| `front/src/Core/mundo/index.js` | URL del WebSocket `/api/ws` (antes `/ws`); `?mundo=local` además de `?local=1` |
| `front/vite.config.js` | Proxy de `/api` con `ws: true` en `server` y `preview`; destino configurable con `VITE_BACK` |
| `front/src/Core/mundo/remoto.js` | Reescrito. Ver «Defectos encontrados» |
| `front/src/Core/mundo/interpola.js` | Búfer de 8 instantáneas (antes solo 2) y estado discreto antes de decidir si se interpola |
| `front/src/Core/mundo/local.js` | Fachada cuyo prototipo es la `Sim`; control completo en local (`formar`, `tomar`, `dejar`, `decidir`, `opciones`, eventos, `mia`, `auto`) |
| `front/src/Core/mundo/opciones.js` | Tarjetas de la sección 3.5 con la forma que consume `Control`, compartidas por local y remoto |
| `front/src/Core/dialogos.js` | `sim.rngDialogos ?? sim.rng` (el render ya no avanza la `rng` de la sim) |
| `front/src/Components/Control/index.jsx` | El aviso distingue «entró al mundo» de «Ahora controlas a …» (el evento `entra` llega en ambos casos) |
| `back/mundo/servidor.mjs` + `servidor.bundle.mjs` | Ganchos de prueba con `MUNDO_PRUEBA=1` (`/prueba/matar?b=<id>`, `/prueba/velocidad?x=<n>`); paquete regenerado (696 KB) |
| `front/_capturas/e2e_sonda.mjs` | Sonda de dos espectadores y A/B de FPS |

`world.js` no se tocó. `back/media/dist` tampoco (lo genera `migrate_view.py` al desplegar).

## Defectos encontrados al integrar (ya corregidos)

1. **El mundo remoto se movía a saltos de 10 Hz.** El interpolador guardaba solo dos instantáneas y dibuja 150 ms en
   el pasado: el instante de dibujo quedaba siempre antes de la más antigua y se fijaba en ella. Ahora hay búfer y se
   interpola entre las dos que rodean el instante.
2. **Los parciales de `d.b` borraban campos.** Cada cambio lento ponía `dest`, `way`, `route`, `ctrl`, `dec` y `auto` en
   nulo si no venían en el parcial. Ahora solo se tocan los campos presentes.
3. **`opciones()` devolvía otra forma** (`world.destinos` crudo) y el selector de tarjetas no podía dibujar nada.
4. **El adaptador local se llamaba a sí mismo**: `Object.assign(sim, { tomar, dejar, decidir })` pisaba los métodos de
   la sim y `sim.tomar?.()` recursaba; además `formar` pasaba los argumentos en otro orden.
5. **Eventos `entra` y `libre`**: el remoto emitía `libre` con otra carga al morir cualquier ballita; ahora salen de
   `d.ev` con `{ b, de | motivo, nombre, mia }`.
6. **Tarjetas de carril** (heredado de P3): `route.way` es el objeto del sentido, no su índice; el texto «Calculado
   sobre …» salía vacío.
7. `walk` (camino de vértices) se perdía al interpolar; época nueva reconstruía el mundo (ahora se conserva si la
   semilla es la misma, así la escena no queda apuntando a un mundo viejo).

## Cambios al contrato

- **Reconexión**: esperas de 1 s y luego 2 s durante el primer medio minuto (después 4, 8 y 15 s). El contrato decía
  1, 2, 4, 8 y 15 s; con eso no se garantiza «< 3 s tras volver» porque un reinicio tarda 4–6 s.
- `mundo.tDibujo` (segundos de sim que se están dibujando) y `mundo.rngDialogos`: campos nuevos del adaptador.
- `visitedRoutes` no viaja en `Lenta`: en remoto «recorrida n veces» de la tarjeta de ruta siempre dice 0.
- Con `worldGen` distinto ya conectado, el cliente recarga la página; en el primer intento cae al mundo local.

## Paso 2 — prueba de punta a punta

Montaje local sin docker: uvicorn (`back/main.py`, puerto 8390, venv temporal) + `node back/mundo/servidor.bundle.mjs`
(puerto 8391, `MUNDO_PRUEBA=1`) + `vite preview` del build de producción (puerto 4390, proxy de `/api` con WebSocket a
8390). Navegador: Edge real con ventana, dos contextos con ids distintos en `localStorage`. Antes de abrir navegador,
`cliente_prueba.mjs hola` por el preview: 10/10.

| Prueba | Resultado | ¿Cumple? |
|---|---|---|
| a) mismas ballitas y posiciones | Mismos 10 ids y nombres. Diferencia de posición a igual reloj del servidor: **media 0,0099 u**, p99 0,102 u, máx 4,94 u (2 694 comparaciones, 10 ballitas, 5 s) | Sí (meta ≤ 1 u de media) |
| b) formar y fila | Nombre sugerido «Zuralla» editado a «Luna E2E»; B la ve en la fila como ajena. Tras `/prueba/matar`, entra en **3,05 s** (1,4 s de muerte + 1,5 s de nacimiento), controlada por A, fila en 0. Repetido en la segunda corrida: 3,04 s | Sí |
| c) planeta, ruta y carril | Elegidos con el selector (hover muestra lo que se gana y se pierde). B ve las mismas decisiones. La ballita 35 las consumió (`plan.manual = [destino, ruta, carril]`, razón «lo decidió quien me controla»), **llegó al planeta decidido, recorrió solo la ruta decidida y salió por el carril decidido** | Sí, al cuarto intento (ver abajo) |
| d) dejar y tomar | A pulsa «Dejar de controlar»; B la selecciona y pulsa «Tomar control»; A recibe `ocupada` y su barra dice «Controlada por otro espectador» | Sí |
| e) inactividad | Con el servidor a 30×, B pierde el control a los **311 s de sim** con motivo `inactivo` y aviso «Perdiste el control tras 3 rutas sin decidir.» (un primer intento acabó antes por muerte de la ballita) | Sí |
| f) reconexión | Node reiniciado (arranque 4,6 s, época nueva): A recuperado en **180 ms** y B en **259 ms** desde que el servidor respondió; ambos con las mismas 10 ballitas del mundo nuevo | Sí (meta < 3 s) |
| g) consola | **0 errores** en A y en B en las tres corridas, incluido el reinicio | Sí |
| g) FPS frente a main | Tres rondas alternadas (general main / rama): 30,3 / 53,8 · 63,4 / 89,4 · 105,7 / 112,5. POV: 42,3 / 36,0 · 32,8 / 57,0 · 64,8 / 71,0. Medianas: **general 63,4 → 89,4**, **POV 42,3 → 57,0** | Sin empeoramiento medible; ver reserva |

Reservas:

- **Paso c**: hicieron falta cuatro intentos. El primero falló por un error de la sonda (serializaba un objeto
  circular). En el segundo y el tercero la ballita murió antes de terminar el viaje decidido: una recién nacida empieza
  con 60 de energía y una ruta cuesta 30–45; la sonda elegía a propósito una ruta que no era la automática. No es un
  fallo del control, pero sí algo que el usuario va a notar: elegir mal mata a la ballita (la tarjeta lo avisa con
  «Llegarías con ~11 ⚡»).
- **FPS**: el equipo fue soltando carga durante la medición (main pasó de 30 a 106 FPS entre rondas), así que el
  ruido supera con mucho el 5 % pedido. La rama ganó en 5 de 6 comparaciones y perdió una (POV, ronda 1: −15 %). Las
  dos páginas no dibujan lo mismo (mundos y ballitas distintos). Lo que sí se sostiene: el cliente remoto no simula,
  solo interpola. Repetir con el equipo en reposo si se quiere la cifra fina.
- **Tocar en 412×915**: las capturas móviles se tomaron redimensionando la ventana de A (sin emulación táctil).
- El front se sirvió con `vite preview`, no desde `back/media/dist`. El relevo por uvicorn sí se ejercitó en todas las
  pruebas.
- No se probó `?local=1` en navegador tras reescribir `local.js`; lo cubren las pruebas de Node, no una captura.

## Capturas (`front/_capturas/e2e/`)

Abiertas y revisadas 17 de las 37 (al menos una por paso, en escritorio y en 412×915); las demás son la otra
variante de tamaño o de espectador del mismo instante y no se abrieron.

- `00_inicio_A` / `00_inicio_B`: vista general con el panel «Forma tu ballita» arriba a la derecha y «mundo compartido · 👀 2».
- `01_formar_editado_A`: campo con «Luna E2E» escrito sobre el nombre sugerido.
- `02_en_fila_A` / `02_en_fila_B` (escritorio y móvil): fila 1/30 con «#1 Luna E2E · Siguiente»; en B aparece como ajena.
- `03_entro_de_la_fila_A`: aviso «¡Luna E2E entró al mundo! Ya tienes el control.», detalle de la ballita y barra inferior con tres botones en «Automático».
- `04_selector_planeta_hover_A` (escritorio y móvil): cuatro tarjetas de planeta con esfera, insignia «Auto» y «⚠ Riesgo»; a la derecha «Qué se gana», «Qué se pierde» y «Llegarías con ~69 ⚡ y ~47 ⭐».
- `04_selector_ruta_hover_A`: tres rutas con su trazado, duración, obstáculos y balance.
- `04_selector_carril_hover_A`: cinco carriles con el corte de la calzada, primer evento, recompensa y probabilidad de fallar.
- `05_decisiones_fijadas_A` (escritorio y móvil; en móvil la barra cabe en una fila sobre los puntos): barra con «Cima», «Ruta B» y «Carril 4 de 5» resaltados y su × para volver a automático.
- `06_tras_cumplir_A`: la ballita controlada («Boluti») ya en Eco, el planeta decidido, camino del Picnic; los tres botones vuelven a «Automático» (las decisiones son de un solo uso).
- `08_B_puede_tomar` (móvil), `09_B_controla`: B con la ballita seleccionada y el botón «Tomar control» bajo su ficha, y luego con la barra de decisiones. `07_A_dejo_el_control` no se abrió.
- `10_A_no_puede_tomar`: barra de A «Pirati G2 · Controlada por otro espectador».
- `11_B_pierde_por_inactividad`: aviso «Perdiste el control tras 3 rutas sin decidir.» y botón «Tomar control» de nuevo.
- `12_reconectando_A`: insignia «Reconectando…» y «reconectando…» en la cabecera; el mundo sigue dibujado.
- `13_recuperado_A` / `13_recuperado_B`: mundo nuevo (gen 1), 10 ballitas, sin insignia.
- `fps_main_pov`, `fps_e2e_pov`: POV en carretera, ambos dibujan pista y paisaje.

Detalle visto en `09_B_controla`: al tomar una ballita el aviso decía «entró al mundo»; ya está corregido a «Ahora
controlas a …» (no se volvió a capturar).

Datos crudos: `e2e/corrida1_completa.log`, `corrida2_bc.log`, `corrida3_c.log`, `resultado_e2e_c.json`,
`resultado_fps.json`. El JSON de la primera corrida se sobrescribió con la segunda; sus cifras están en el log.

## Paso 3 — pruebas y build

- `cd front && pnpm test`: **91 de 91** (372 s, con la sonda de navegador corriendo a la vez). El tope de 3000 ms no se tocó.
- `npx vite build`: correcto (12–20 s). `pnpm build:mundo`: `servidor.bundle.mjs` 696 KB, 21 módulos.

## Paso 4 — desplegar (NO hecho)

En el equipo de desarrollo, tras integrar a main:

```
cd front && npx vite build
cd .. && python migrate_view.py        # copia a back/media/dist y regenera back/mundo/servidor.bundle.mjs
git add back/media/dist back/mundo/servidor.bundle.mjs && git commit && git push
```

En el servidor, dentro de `back/`:

```
git pull
docker compose build                   # UNA vez: la imagen cambió (binario de Node y websockets en requirements.txt)
docker compose up -d                   # recrea ballitas-py; supervisord arranca runserver y mundo
docker exec ballitas-py supervisorctl status          # runserver y mundo en RUNNING
docker exec ballitas-py python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8379/salud').read()[:200])"
```

En despliegues siguientes basta `git pull`: uvicorn recarga con `--reload` y Node con `--watch`. Si `mundo` no
reinicia: `docker exec ballitas-py supervisorctl restart mundo`. Comprobar al final que
`wss://ballitas.ojitos3695.com/api/ws` responde `hola` (`node back/mundo/cliente_prueba.mjs hola wss://…/api/ws`).

Pendientes de infraestructura:

- **Origin**: el relevo acepta cualquier origen. Falta rechazar en `mundo_ws.py` los que no sean el dominio propio.
- **Límite por IP**: solo hay topes globales (300 en el relevo, 500 en Node) y 5 mensajes/s por conexión. Detrás del
  túnel la IP real llega en `CF-Connecting-IP`.
- **`MUNDO_PRUEBA`** no debe ponerse en `supervisord.conf` (no está). Los ganchos solo escuchan en 127.0.0.1.
- El primer arranque en el servidor calcula las elecciones del mundo (11 s aquí; 17 s midió P1) y las guarda en
  `back/data/picks_10_369.json`; mientras tanto los clientes caen al mundo local a los 5 s y no vuelven al remoto
  hasta recargar.
- Cada reinicio del servidor es un mundo nuevo (decisión tomada): la fila y los controles se pierden.
- Carga del relevo de FastAPI medida por P1: 17,9 % de un núcleo con 50 clientes.

## Qué no se cumplió

- FPS «no peor que main en más de 5 %»: no se puede afirmar ni negar con este ruido (ver reserva).
- Paso c al primer intento: no; cumplido al cuarto.
- Sin captura de `?local=1` ni prueba con el front servido desde `back/media/dist`.

Hash final: ver `git log -1` de la rama (el commit que añade este informe).
