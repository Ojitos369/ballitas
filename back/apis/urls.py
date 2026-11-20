from fastapi import APIRouter
from .base.urls import router as base_router

from .catalogo.urls import router as catalogo_router
from .ballitas.urls import router as ballitas_router
from .mundos.urls import router as mundos_router
from .mundo_ws import router as mundo_ws_router

apis = APIRouter()
apis.include_router(base_router, prefix="/base")
apis.include_router(catalogo_router, prefix="/catalogo")
apis.include_router(ballitas_router, prefix="/ballitas")
apis.include_router(mundos_router, prefix="/mundos")
apis.include_router(mundo_ws_router)  # WebSocket /api/ws: relevo al servidor del mundo compartido (Node)
