import json
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

import db
from apis.common import json_max, limite_cuerpo

router = APIRouter()


class BallitaIn(BaseModel):
    mundo_id: int
    ref: int = Field(ge=0)                                  # id de la ballita dentro de la sim
    nombre: str = Field(min_length=1, max_length=64)
    genoma: dict[str, Any]
    arquetipo: dict[str, Any] | None = None                 # { key, hi, title }
    skin: dict[str, Any] | None = None                      # skin generada (resumen o descriptor)
    padres: list[int] = Field(default_factory=list, max_length=2)  # refs de los padres; [] = inmigrante
    generacion: int = Field(1, ge=1, le=100000)

    _g = field_validator("genoma")(lambda v: json_max(v, 8192, "genoma"))
    _a = field_validator("arquetipo")(lambda v: v if v is None else json_max(v, 1024, "arquetipo"))
    _s = field_validator("skin")(lambda v: v if v is None else json_max(v, 32768, "skin"))


class BallitaPatch(BaseModel):
    estado: Literal["viva", "muerta"] | None = None
    puntos: float | None = Field(None, ge=-1e6, le=1e6)
    edad: float | None = Field(None, ge=0, le=1e9)
    causa: str | None = Field(None, max_length=64)


def fila(r):
    d = dict(r)
    for k in ("genoma", "arquetipo", "skin", "padres"):
        d[k] = json.loads(d[k]) if d[k] else None
    return d


@router.post("", status_code=201, dependencies=[Depends(limite_cuerpo)])
def nacer(b: BallitaIn, response: Response):
    with db.db() as con:
        if not con.execute("SELECT 1 FROM mundos WHERE id=?", (b.mundo_id,)).fetchone():
            raise HTTPException(404, "mundo no existe")
        previa = con.execute("SELECT * FROM ballitas WHERE mundo_id=? AND ref=?", (b.mundo_id, b.ref)).fetchone()
        if previa:  # reintento del cliente: idempotente
            response.status_code = 200
            return fila(previa)
        cur = con.execute(
            "INSERT INTO ballitas (mundo_id, ref, nombre, genoma, arquetipo, skin, padres, generacion)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (b.mundo_id, b.ref, b.nombre, json.dumps(b.genoma), json.dumps(b.arquetipo) if b.arquetipo else None,
             json.dumps(b.skin) if b.skin else None, json.dumps(b.padres), b.generacion))
        return fila(con.execute("SELECT * FROM ballitas WHERE id=?", (cur.lastrowid,)).fetchone())


@router.patch("/{ballita_id}", dependencies=[Depends(limite_cuerpo)])
def actualizar(ballita_id: int, p: BallitaPatch):
    cambios = p.model_dump(exclude_unset=True)
    if cambios.get("estado") == "muerta":
        cambios["murio"] = "STRFTIME"  # marcador: se resuelve abajo con la hora del servidor
    with db.db() as con:
        if not con.execute("SELECT 1 FROM ballitas WHERE id=?", (ballita_id,)).fetchone():
            raise HTTPException(404, "ballita no existe")
        sets = [f"{k}=strftime('%Y-%m-%dT%H:%M:%fZ','now')" if v == "STRFTIME" else f"{k}=?" for k, v in cambios.items()]
        if sets:  # nombres de columna salen del modelo Pydantic, nunca del cliente
            con.execute(f"UPDATE ballitas SET {', '.join(sets)} WHERE id=?",
                        [v for v in cambios.values() if v != "STRFTIME"] + [ballita_id])
        return fila(con.execute("SELECT * FROM ballitas WHERE id=?", (ballita_id,)).fetchone())


@router.get("")
def historial(mundo: int | None = None, estado: Literal["viva", "muerta"] | None = None,
              limit: int = Query(200, ge=1, le=1000), offset: int = Query(0, ge=0)):
    where, args = [], []
    if mundo is not None:
        where.append("mundo_id=?"); args.append(mundo)
    if estado:
        where.append("estado=?"); args.append(estado)
    q = "SELECT * FROM ballitas" + (" WHERE " + " AND ".join(where) if where else "")
    with db.db() as con:
        return [fila(r) for r in con.execute(q + " ORDER BY id LIMIT ? OFFSET ?", args + [limit, offset])]
