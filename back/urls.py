from fastapi import Request, FastAPI, APIRouter
from fastapi.responses import HTMLResponse
from apis.urls import apis
from core.conf.settings import MEDIA_DIR

urls_router = APIRouter()
urls_router.include_router(apis, prefix="/api")


# ---------   INDEX   ---------
@urls_router.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    with open(f"{MEDIA_DIR}/dist/index.html", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


# ---------   404   ---------
def add_404_handler(app: FastAPI):
    @app.exception_handler(404)
    async def custom_404_handler(request: Request, exc):
        with open(f"{MEDIA_DIR}/pages/p404.html", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=404)
