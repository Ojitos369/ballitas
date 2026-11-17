"""Persistencia SQLite (stdlib, sin ORM). Archivo: back/data/ballitas.db (BALLITAS_DB lo cambia).

ponytail: SQLite basta mientras haya un solo proceso uvicorn y poca escritura. Si crece (varios
workers, muchos mundos/ballitas, consultas de linaje pesadas): pasar a PostgreSQL con
psycopg + las mismas tablas (los JSON a JSONB, `ref`/`mundo_id` a indices) y migraciones con alembic.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("BALLITAS_DB") or BASE / "data" / "ballitas.db")
SEED_PATH = BASE / "seed" / "catalogo.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS piezas (        -- piezas base de generación procedural (SKIN_PARTS)
  tipo TEXT NOT NULL, id TEXT NOT NULL, label TEXT, emoji TEXT, categoria TEXT, familia TEXT,
  params TEXT NOT NULL DEFAULT '{}',        -- defaults de la pieza (scale, tilt, colorRole...)
  PRIMARY KEY (tipo, id));
CREATE TABLE IF NOT EXISTS secciones (     -- arquetipos/familias, presets, temas, diálogos, caras...
  seccion TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (seccion, id));
CREATE TABLE IF NOT EXISTS mundos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, semilla INTEGER NOT NULL, params TEXT NOT NULL DEFAULT '{}',
  creado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS ballitas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mundo_id INTEGER NOT NULL REFERENCES mundos(id),
  ref INTEGER NOT NULL,                      -- id que la sim le dio dentro de ese mundo
  nombre TEXT NOT NULL, genoma TEXT NOT NULL, arquetipo TEXT, skin TEXT,
  padres TEXT NOT NULL DEFAULT '[]',         -- refs (de la misma sim) de los padres; [] = inmigrante
  generacion INTEGER NOT NULL DEFAULT 1,
  nacio TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), murio TEXT,
  estado TEXT NOT NULL DEFAULT 'viva', edad REAL, puntos REAL, causa TEXT,
  UNIQUE (mundo_id, ref));
CREATE INDEX IF NOT EXISTS ix_ballitas_mundo ON ballitas(mundo_id);
"""


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


@contextmanager
def db():
    con = connect()
    try:
        yield con
        con.commit()
    finally:
        con.close()


def seed(con, force=False):
    """Siembra el catálogo desde seed/catalogo.json (lo genera front/tools/export-catalogo.mjs)."""
    if not force and con.execute("SELECT 1 FROM piezas LIMIT 1").fetchone():
        return False
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    con.execute("DELETE FROM piezas")
    con.execute("DELETE FROM secciones")
    con.executemany(
        "INSERT INTO piezas VALUES (?,?,?,?,?,?,?)",
        [(p["tipo"], p["id"], p.get("label"), p.get("emoji"), p.get("categoria"), p.get("familia"),
          json.dumps(p.get("params") or {}, ensure_ascii=False)) for p in data["piezas"]])
    con.executemany(
        "INSERT INTO secciones VALUES (?,?,?)",
        [(sec, k, json.dumps(v, ensure_ascii=False)) for sec, items in data["secciones"].items()
         for k, v in items.items()])
    return True


def init():
    with db() as con:
        con.executescript(SCHEMA)
        seed(con)
