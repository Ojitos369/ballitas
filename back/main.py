import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from urls import urls_router, add_404_handler
from core.conf.settings import MEDIA_DIR, allow_origin_regex, allow_credentials, allow_methods, allow_headers

import db

db.init()  # crea tablas y siembra el catálogo si la BD está vacía
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=allow_credentials,
    allow_methods=allow_methods,
    allow_headers=allow_headers,
)

app.include_router(urls_router, prefix="")

# Build del front (python migrate_view.py lo copia a media/dist). Las texturas y modelos se piden
# como /tex/... y /models/... (BASE_URL "/"), por eso se montan también en la raíz.
DIST_DIR = os.path.join(MEDIA_DIR, "dist")
app.mount("/media", StaticFiles(directory=MEDIA_DIR, check_dir=False), name="media")
app.mount("/tex", StaticFiles(directory=os.path.join(DIST_DIR, "tex"), check_dir=False), name="tex")
app.mount("/models", StaticFiles(directory=os.path.join(DIST_DIR, "models"), check_dir=False), name="models")

add_404_handler(app)

# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
