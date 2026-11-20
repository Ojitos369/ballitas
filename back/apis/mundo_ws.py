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
# Orígenes aceptados (coma); los de desarrollo local se aceptan con cualquier puerto.
MUNDO_ORIGENES = {o.strip() for o in os.environ.get("MUNDO_ORIGENES", "https://ballitas.ojitos3695.com").split(",") if o.strip()}
MUNDO_WS_POR_IP = int(os.environ.get("MUNDO_WS_POR_IP", "8"))

router = APIRouter()
_abiertas = 0
_por_ip: dict[str, int] = {}


def _origen_valido(origen: str | None) -> bool:
    if not origen:
        return False
    if origen in MUNDO_ORIGENES:
        return True
    return origen.startswith(("http://localhost:", "http://127.0.0.1:")) or origen in ("http://localhost", "http://127.0.0.1")


def _ip(ws: WebSocket) -> str:
    # detrás del túnel de Cloudflare la IP real llega en CF-Connecting-IP; en local, la del socket
    return ws.headers.get("cf-connecting-ip") or (ws.client.host if ws.client else "?")


@router.websocket("/ws")
async def relevo(ws: WebSocket):
    global _abiertas
    if not _origen_valido(ws.headers.get("origin")):
        await ws.close(code=1008)  # antes de aceptar: el handshake se rechaza
        return
    ip = _ip(ws)
    await ws.accept()
    if _abiertas >= MUNDO_WS_MAX or _por_ip.get(ip, 0) >= MUNDO_WS_POR_IP:
        await ws.close(code=1013, reason="lleno")
        return
    _abiertas += 1
    _por_ip[ip] = _por_ip.get(ip, 0) + 1
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
        _por_ip[ip] -= 1
        if _por_ip[ip] <= 0:
            del _por_ip[ip]
        if mundo is not None:
            try:
                await mundo.close()
            except Exception:
                pass
        try:
            await ws.close(code=codigo if 1000 <= codigo <= 4999 and codigo not in (1005, 1006) else 1011)
        except Exception:
            pass  # el navegador ya se había ido
