"""Relevo WebSocket hacia el servidor del mundo compartido (Node, back/mundo/servidor.mjs).

El navegador abre wss://<host>/api/ws; aquí se abre ws://127.0.0.1:8379 y se copian las tramas de texto en ambos
sentidos. Así el túnel y el puerto publicado no cambian (docs/mundo_compartido.md, 1.3). El relevo no interpreta
los mensajes: la validación (tamaño, ritmo, forma) la hace el servidor Node.

Variables: MUNDO_WS_URL (ws://127.0.0.1:8379), MUNDO_WS_MAX (300 conexiones a la vez).
"""
import asyncio
import os

import websockets
from fastapi import APIRouter, WebSocket

MUNDO_WS_URL = os.environ.get("MUNDO_WS_URL", "ws://127.0.0.1:8379")
MUNDO_WS_MAX = int(os.environ.get("MUNDO_WS_MAX", "300"))
MAX_TRAMA = 4096  # el protocolo admite 512 B por mensaje; más que esto ni se reenvía

router = APIRouter()
_abiertas = 0


@router.websocket("/ws")
async def relevo(ws: WebSocket):
    global _abiertas
    await ws.accept()
    if _abiertas >= MUNDO_WS_MAX:
        await ws.close(code=1013, reason="lleno")
        return
    _abiertas += 1
    mundo = None
    codigo = 1011
    try:
        try:
            # sin compresión ni latidos propios en el salto local; el latido lo lleva el protocolo (ping cada 25 s)
            mundo = await websockets.connect(MUNDO_WS_URL, compression=None, ping_interval=None,
                                             open_timeout=5, max_size=2 ** 20)
        except Exception:
            await ws.close(code=1013, reason="mundo no disponible")
            return

        async def subir():  # navegador -> mundo
            while True:
                m = await ws.receive()
                if m["type"] == "websocket.disconnect":
                    return 1000
                texto = m.get("text")
                if texto is None or len(texto) > MAX_TRAMA:
                    return 1009
                await mundo.send(texto)

        async def bajar():  # mundo -> navegador
            try:
                async for m in mundo:
                    if isinstance(m, str):
                        await ws.send_text(m)
            except websockets.ConnectionClosed:
                pass
            return mundo.close_code or 1012  # el mundo cerró (p. ej. 1008 por ritmo) o se reinició

        tareas = [asyncio.create_task(subir()), asyncio.create_task(bajar())]
        hechas, pendientes = await asyncio.wait(tareas, return_when=asyncio.FIRST_COMPLETED)
        for t in pendientes:
            t.cancel()
        await asyncio.gather(*pendientes, return_exceptions=True)
        for t in hechas:
            if not t.cancelled() and t.exception() is None:
                codigo = t.result()
    finally:
        _abiertas -= 1
        if mundo is not None:
            try:
                await mundo.close()
            except Exception:
                pass
        try:
            await ws.close(code=codigo if 1000 <= codigo <= 4999 and codigo not in (1005, 1006) else 1011)
        except Exception:
            pass  # el navegador ya se había ido
