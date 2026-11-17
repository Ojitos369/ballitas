"""Humo del back: levanta uvicorn en un puerto libre con una BD temporal y llama a cada endpoint.
Uso: cd back && .venv/Scripts/python tests/smoke.py   (Linux: .venv/bin/python)"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

BACK = Path(__file__).resolve().parent.parent
s = socket.socket(); s.bind(("127.0.0.1", 0)); PORT = s.getsockname()[1]; s.close()
URL = f"http://127.0.0.1:{PORT}/api"
tmp = tempfile.mkdtemp()
env = {**os.environ, "BALLITAS_DB": os.path.join(tmp, "t.db")}
srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--port", str(PORT)], cwd=BACK, env=env,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(URL + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, {k.title(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.title(): v for k, v in e.headers.items()}, e.read()


try:
    for _ in range(50):
        try:
            call("GET", "/base/hh"); break
        except Exception:
            time.sleep(0.2)
    st, h, b = call("GET", "/catalogo")
    cat = json.loads(b)
    assert st == 200 and h["Etag"] and "max-age" in h["Cache-Control"], (st, h)
    assert "hat" in cat["piezas"] and "wizard" in cat["piezas"]["hat"] and "temas" in cat and "dialogos" in cat
    assert call("GET", "/catalogo", headers={"If-None-Match": h["Etag"]})[0] == 304

    st, _, b = call("POST", "/mundos", {"semilla": 369, "params": {"pop": 30}})
    mundo = json.loads(b); assert st == 201 and mundo["semilla"] == 369
    assert call("POST", "/mundos", {"semilla": -1})[0] == 422
    assert call("GET", f"/mundos/{mundo['id']}")[0] == 200 and call("GET", "/mundos/9999")[0] == 404
    assert len(json.loads(call("GET", "/mundos")[2])) >= 1

    nace = {"mundo_id": mundo["id"], "ref": 1, "nombre": "Pelusa", "genoma": {"hue": 0.3, "traits": {"animo": 0.9}},
            "arquetipo": {"key": "animo", "hi": True}, "skin": {"id": "x"}, "padres": [], "generacion": 1}
    st, _, b = call("POST", "/ballitas", nace); bl = json.loads(b)
    assert st == 201 and bl["estado"] == "viva" and bl["genoma"]["hue"] == 0.3
    assert call("POST", "/ballitas", nace)[0] == 200  # idempotente
    hijo = {**nace, "ref": 2, "nombre": "Moti G2", "padres": [1, 1], "generacion": 2}
    assert call("POST", "/ballitas", hijo)[0] == 201
    assert call("POST", "/ballitas", {**nace, "mundo_id": 999, "ref": 3})[0] == 404
    assert call("POST", "/ballitas", {**nace, "ref": 4, "nombre": ""})[0] == 422
    assert call("POST", "/ballitas", {**nace, "ref": 5, "genoma": {"x": "a" * 9000}})[0] == 422
    assert call("POST", "/ballitas", raw=json.dumps({"x": "a" * 70000}).encode())[0] == 413

    st, _, b = call("PATCH", f"/ballitas/{bl['id']}", {"estado": "muerta", "puntos": 12.5, "edad": 40, "causa": "energia"})
    m = json.loads(b); assert st == 200 and m["estado"] == "muerta" and m["murio"] and m["puntos"] == 12.5
    assert call("PATCH", f"/ballitas/{bl['id']}", {"estado": "otra"})[0] == 422
    assert call("PATCH", "/ballitas/9999", {"puntos": 1})[0] == 404

    lista = json.loads(call("GET", f"/ballitas?mundo={mundo['id']}")[2])
    assert [x["ref"] for x in lista] == [1, 2] and lista[1]["padres"] == [1, 1]
    assert len(json.loads(call("GET", f"/ballitas?mundo={mundo['id']}&estado=muerta")[2])) == 1
    print("SMOKE OK")
finally:
    srv.terminate(); srv.wait()


