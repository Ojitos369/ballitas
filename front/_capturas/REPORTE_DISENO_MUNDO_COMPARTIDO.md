# REPORTE — Pieza DISEÑO: mundo compartido con control de ballitas

Fecha: 2026-11-19. Rama `cambio/20261119-210923-diseno-mundo-compartido`.

## Qué se entregó

- `docs/mundo_compartido.md`: arquitectura recomendada, contrato del protocolo y del adaptador, reglas del control,
  cambios de `sim.js` con firmas, plan de tres piezas paralelas, decisiones abiertas y «Conocimiento propuesto».
- `front/tools/mundo_compartido_proto.mjs`: prototipo (subclase `SimMundo` con fila, control y decisiones;
  codificadores de instantánea; mediciones). `docs/mundo_compartido_medidas.json`: salida cruda.
- No se tocó código de producción (`front/src`, `back`) ni el despliegue.

## Recomendación

Servidor autoritativo: `sim.js` en Node a 30 Hz, instantánea a 10 Hz por WebSocket, clientes que interpolan sobre la
pista. Node en el mismo contenedor (supervisord), FastAPI reenvía `/ws`; túnel y puerto 8378 sin cambios.

## Medidas (Node 24.19, semilla 369, 10 min simulados)

| Medida | Valor |
|---|---|
| Tick de la sim | 0,126 ms de media, p99 0,270 ms (0,38 % de un núcleo a 30 Hz) |
| Instantánea de 10 ballitas | 1 640 B JSON, 731 B deflate (16 KB/s y 7,1 KB/s a 10 Hz) |
| Bienvenida completa | 40 214 B JSON, 16 026 B deflate |
| `buildWorld` | 8,5–10,1 s en frío, 2,7 s con elecciones |
| Error de interpolación a 10 Hz | lineal 0,28 u (p99 2,81) frente a paramétrica 0,016 u (p99 0,188) |
| Determinismo | misma semilla y entradas: misma huella, también entre procesos; otra entrada o semilla: diverge |
| Equivalencia | `SimMundo` sin entradas = `Sim` actual (huella `b11c0191785ad5e6` en ambas, 18 000 ticks) |
| Decisiones | 5 de 5 viajes cumplieron planeta, ruta y carril |
| Inactividad | 3 de 3 casos liberados en la tercera llegada (197–339 s) |
| Muertes | una cada ~100 s (6 en 10 min: muestra corta) |

## Qué no se cumplió o queda sin medir

- No se abrió ningún socket: las cifras de red son bytes de carga útil; el relevo de FastAPI y el paso por el túnel
  no se probaron.
- Memoria del servidor: solo una cota superior (488 MB residentes en un proceso con varios mundos a la vez).
- El determinismo se comprobó en Node en esta máquina, no entre navegadores (la arquitectura elegida no lo necesita).
- No hubo prueba de navegador ni capturas: la pieza no cambia nada visible.
- Pruebas: ver la sección siguiente.

## Pruebas

`pnpm test` (sin cambios en `front/src`): primera corrida con 1 fallo en `sim.test.js:446` (tope de 3000 ms; el equipo estaba cargado, la corrida duró 404 s); corrida repetida: 82 pruebas, 82 pasan, 0 fallan (381 s). El brief hablaba de 76 pruebas; el repo tiene hoy 82. No se corrió `vite build`: la pieza no toca el front.

## Decisiones abiertas para el usuario

Sección 7 del documento: espera en la fila (~100 s por puesto), una ballita por espectador, elegir ruta fija también
el planeta, genoma de la formada por algoritmo genético, reinicio del servidor = mundo nuevo.

Conocimiento consultado: ninguno aplica (pendiente). Propuesta de nota en la sección 8 del documento.
