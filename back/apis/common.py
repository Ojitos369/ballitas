import json

from fastapi import HTTPException, Request

MAX_BODY = 64 * 1024  # sin auth todavía: nada de cuerpos enormes


async def limite_cuerpo(request: Request):
    # Content-Length lo valida uvicorn/h11 contra el cuerpo real; sin él (chunked) se rechaza.
    n = request.headers.get("content-length")
    if n is None or not n.isdigit() or int(n) > MAX_BODY:
        raise HTTPException(413, f"cuerpo > {MAX_BODY} bytes o sin Content-Length")


def json_max(v, n, campo):
    if len(json.dumps(v, ensure_ascii=False)) > n:
        raise ValueError(f"{campo} > {n} bytes")
    return v
