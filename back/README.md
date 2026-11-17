# Back de ballitas

FastAPI + SQLite (`data/ballitas.db`, ignorada por git; `BALLITAS_DB` cambia la ruta). Al arrancar crea las tablas y siembra el catálogo si la BD está vacía.

## API (`/api`, sin autenticación por ahora; cuerpos ≤ 64 KB)
- `GET /catalogo` — piezas base (`piezas[tipo][id]`), `familias`, `presets`, `rasgos`, `caras`, `razones`, `temas` (con su `visual`), `dialogos`. Lleva `ETag` y `Cache-Control: max-age=300`.
- `POST /mundos` `{semilla, params}` · `GET /mundos[?semilla=]` · `GET /mundos/{id}`
- `POST /ballitas` `{mundo_id, ref, nombre, genoma, arquetipo, skin, padres[refs], generacion}` (idempotente por `mundo_id+ref`) · `PATCH /ballitas/{id}` `{estado, puntos, edad, causa}` · `GET /ballitas?mundo=&estado=&limit=&offset=` (linaje: `padres` son `ref` de la misma sim)

## Catálogo
Fuente de verdad actual: el código del front. `cd front && node tools/export-catalogo.mjs` regenera `seed/catalogo.json`; `python seed.py --force` lo vuelca a SQLite. El front (`src/Core/api.js`) lo pide al iniciar y lo mezcla en `SKIN_PARTS`; si el back no responde usa los datos locales.

## Pruebas
`python -m venv .venv && .venv/bin/pip install -r requirements.txt` (Windows: `.venv\Scripts`) y `python tests/smoke.py` (levanta uvicorn en un puerto libre con BD temporal).

## Siguiente fase (preparada, no hecha)
1. Mover `buildWorld` (~3,5 s) y la simulación (`Core/sim.js`) a un **Web Worker** del front: el worker posee la `Sim`, publica snapshots (posiciones/estado) por `postMessage` con buffers transferibles y el hilo principal solo renderiza. `Sim.hooks` (`nace`/`muere`) ya desacopla el registro en el back: se conectaría desde el worker.
2. Si conviene, **pregenerar mundos** en el back: tabla `mundos` ya guarda semilla/params; añadir una columna `geometria` (JSON/blob comprimido de `buildWorld`) y `GET /mundos/{id}/geometria` para saltarse los 3,5 s. Requiere que `world.js` sea portable (hoy usa three en el cliente) o generarlo con node en un job.
3. Mover la selección/cría (`genomeForNewborn`) al back usando `ballitas` como pool de genomas reales entre sesiones.
