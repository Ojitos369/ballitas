import hashlib
import json

from fastapi import APIRouter, Request, Response

import db

router = APIRouter()


def construir():
    """{piezas: {tipo: {id: pieza}}, <sección>: {id: data}} con la forma que el front ya usa."""
    with db.db() as con:
        piezas = {}
        for r in con.execute("SELECT * FROM piezas ORDER BY rowid"):
            piezas.setdefault(r["tipo"], {})[r["id"]] = {
                "id": r["id"], "label": r["label"], "emoji": r["emoji"], "category": r["categoria"],
                "familia": r["familia"], "defaults": json.loads(r["params"])}
        out = {"piezas": piezas}
        for r in con.execute("SELECT * FROM secciones ORDER BY rowid"):
            out.setdefault(r["seccion"], {})[r["id"]] = json.loads(r["data"])
    return out


@router.get("")
def catalogo(request: Request):
    body = json.dumps(construir(), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    etag = '"' + hashlib.sha1(body).hexdigest()[:16] + '"'
    headers = {"ETag": etag, "Cache-Control": "public, max-age=300"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(body, media_type="application/json", headers=headers)
