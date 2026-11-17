"""Siembra el catálogo en SQLite. `python seed.py` (solo si está vacío) · `python seed.py --force` (reemplaza)."""
import sys

import db

if __name__ == "__main__":
    with db.db() as con:
        con.executescript(db.SCHEMA)
        print("sembrado" if db.seed(con, force="--force" in sys.argv) else "ya había catálogo (usa --force)")
