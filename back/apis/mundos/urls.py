import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

import db
from apis.common import json_max, limite_cuerpo

router = APIRouter()


class MundoIn(BaseModel):
    semilla: int = Field(ge=0, le=2**32 - 1)
    params: dict[str, Any] = Field(default_factory=dict)  # parámetros de buildWorld, tamaño de población...

    _p = field_validator("params")(lambda v: json_max(v, 8192, "params"))


def fila(r):
    return {"id": r["id"], "semilla": r["semilla"], "params": json.loads(r["params"]), "creado": r["creado"]}


@router.post("", status_code=201, dependencies=[Depends(limite_cuerpo)])
def crear(m: MundoIn):
    with db.db() as con:
        cur = con.execute("INSERT INTO mundos (semilla, params) VALUES (?,?)",
                          (m.semilla, json.dumps(m.params, ensure_ascii=False)))
        return fila(con.execute("SELECT * FROM mundos WHERE id=?", (cur.lastrowid,)).fetchone())


@router.get("")
def listar(semilla: int | None = None, limit: int = Query(50, ge=1, le=200)):
    with db.db() as con:
        q, a = "SELECT * FROM mundos", []
        if semilla is not None:
            q, a = q + " WHERE semilla=?", [semilla]
        return [fila(r) for r in con.execute(q + " ORDER BY id DESC LIMIT ?", a + [limit])]


@router.get("/{mundo_id}")
def uno(mundo_id: int):
    with db.db() as con:
        r = con.execute("SELECT * FROM mundos WHERE id=?", (mundo_id,)).fetchone()
    if not r:
        raise HTTPException(404, "mundo no existe")
    return fila(r)
