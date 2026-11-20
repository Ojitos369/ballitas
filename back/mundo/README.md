# back/mundo — servidor del mundo compartido

Diseño y contrato: `docs/mundo_compartido.md`. Un proceso Node corre `front/src/Core/sim.js` a 30 ticks/s y difunde por
WebSocket una instantánea a 10 Hz (`i`) y los cambios lentos (`d`). FastAPI reenvía `/api/ws` hacia aquí
(`back/apis/mundo_ws.py`); el puerto 8379 solo escucha en `127.0.0.1`.

| Archivo | Para qué |
|---|---|
| `servidor.mjs` | El servidor (fuente). En desarrollo: `cd front && pnpm mundo` |
| `servidor.bundle.mjs` | Generado: servidor + sim + three + ws en un archivo. Es lo que corre supervisord (`[program:mundo]`) |
| `empaquetar.mjs` | Genera el paquete: `cd front && pnpm build:mundo` (también lo llama `migrate_view.py`) |
| `cliente_prueba.mjs` | Cliente de consola: `hola`, `basico`, `completo` (servidor propio a 30x) y `carga` |
| `medir.mjs` | Medidas sin red: ms por tick, bytes de instantánea y de bienvenida |
| `huella.mjs` | Huella del estado sin entradas (la sim con control debe dar la misma que antes) |

Variables de entorno del servidor: `MUNDO_PUERTO` (8379), `MUNDO_HOST` (127.0.0.1), `MUNDO_SEMILLA` (369),
`MUNDO_SEMILLA_RNG` (al azar en cada arranque), `MUNDO_DATOS` (`back/data`: guarda `picks_<WORLD_GEN>_<semilla>.json`),
`MUNDO_API` (`http://127.0.0.1:8000/api`; vacío = no registra mundo ni ballitas), `MUNDO_GRACIA_S` (60),
`MUNDO_VELOCIDAD` (1; solo pruebas), `MUNDO_MAX_CONEXIONES` (500). Del relevo: `MUNDO_WS_URL`, `MUNDO_WS_MAX`.

Estado del proceso: `GET http://127.0.0.1:8379/salud` (tick, difusión, CPU, memoria, conexiones).

Probar en local sin Docker:

```
cd back && uvicorn main:app --port 8000          # relevo /api/ws
cd front && pnpm mundo                           # servidor Node en 8379
node back/mundo/cliente_prueba.mjs basico ws://127.0.0.1:8000/api/ws
node back/mundo/cliente_prueba.mjs completo      # reglas con el tiempo acelerado
```

Tras cambiar `sim.js`, `world.js`, `protocolo.js` o `servidor.mjs` hay que regenerar y comitear `servidor.bundle.mjs`.
