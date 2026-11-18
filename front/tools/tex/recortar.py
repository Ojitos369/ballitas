#!/usr/bin/env python3
"""Recorta atlases 4x4, cierra juntas y genera tiles y mosaicos 2x2."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHEETS = ROOT / "tools" / "tex" / "hojas"
OUTPUT = ROOT / "public" / "tex"
SIZE = 512
MIX_SIZE = 1024

ATLAS = {
    "terrenos": ("terreno", [
        ("pasto", ["bosque", "jardin"]), ("arena", ["desierto"]), ("nieve", ["hielo"]), ("lava", ["volcan"]),
        ("cristal", ["cristal"]), ("nube", ["nubes"]), ("musgo", ["bosque", "jardin"]), ("adoquin_neon", ["neon"]),
        ("coral", ["mar"]), ("tierra_oscura", ["sombrio"]), ("arenisca", ["desierto"]), ("hojarasca", ["bosque"]),
        ("hielo_agrietado", ["hielo"]), ("tierra_roja", ["volcan"]), ("magico", ["sombrio", "cristal"]), ("pradera", ["jardin", "bosque"]),
    ]),
    "fachadas": ("fachada", [
        ("estuco", ["jardin"]), ("ladrillo_rojo", ["bosque"]), ("madera_nieve", ["hielo"]), ("vidrio_azul", ["neon"]),
        ("coral", ["mar"]), ("basalto", ["volcan"]), ("cristal", ["cristal"]), ("nube", ["nubes"]),
        ("neon", ["neon"]), ("adobe", ["desierto"]), ("castillo_musgo", ["bosque"]), ("madera_verde", ["jardin"]),
        ("magica", ["sombrio"]), ("arenisca", ["desierto"]), ("hielo", ["hielo"]), ("menta", ["jardin"]),
    ]),
    "techos": ("techo", [
        ("terracota", ["desierto", "volcan"]), ("pizarra", ["bosque"]), ("nieve", ["hielo"]), ("lava", ["volcan"]),
        ("cobre", ["neon"]), ("metal_azul", ["cristal"]), ("madera", ["bosque"]), ("piedra", ["sombrio"]),
        ("ladrillo", ["jardin"]), ("adoquin", ["sombrio"]), ("arenisca", ["desierto"]), ("metal_verde", ["mar"]),
        ("cristal", ["cristal"]), ("nubes", ["nubes"]), ("musgo", ["jardin"]), ("magico", ["sombrio"]),
    ]),
    "carreras": ("carrera", [
        ("asfalto", ["bosque", "desierto", "volcan", "hielo", "cristal", "mar", "nubes", "neon", "jardin", "sombrio"]),
        ("carril_blanco", ["neon"]), ("bordillo_rojo", ["volcan"]), ("bordillo_azul", ["cristal"]),
        ("bordillo_amarillo", ["desierto"]), ("salida", ["neon"]), ("pintura_cian", ["cristal"]), ("pintura_magenta", ["neon"]),
        ("chevrones", ["bosque", "volcan"]), ("senal_naranja", ["desierto"]), ("carril_verde", ["jardin"]), ("circuito_neon", ["neon"]),
        ("pit_concreto", ["bosque"]), ("marcas_neumatico", ["bosque", "volcan"]), ("flechas", ["neon"]), ("meta", ["neon"]),
    ]),
}


def seamless(image: Image.Image, band: int = 36) -> Image.Image:
    """Desplaza juntas al centro y las funde; el borde resultante se repite sin salto."""
    image = image.convert("RGB")
    w, h = image.size
    band = max(2, min(band, w // 8, h // 8))
    shifted = Image.new("RGB", (w, h))
    shifted.paste(image.crop((w // 2, h // 2, w, h)), (0, 0))
    shifted.paste(image.crop((0, h // 2, w // 2, h)), (w // 2, 0))
    shifted.paste(image.crop((w // 2, 0, w, h // 2)), (0, h // 2))
    shifted.paste(image.crop((0, 0, w // 2, h // 2)), (w // 2, h // 2))
    pixels = shifted.load()
    cx, cy = w // 2, h // 2
    for y in range(h):
        left, right = pixels[cx - band - 1, y], pixels[cx + band, y]
        for i in range(2 * band):
            t = (i + 1) / (2 * band + 1)
            pixels[cx - band + i, y] = tuple(round(a * (1 - t) + b * t) for a, b in zip(left, right))
    for x in range(w):
        top, bottom = pixels[x, cy - band - 1], pixels[x, cy + band]
        for i in range(2 * band):
            t = (i + 1) / (2 * band + 1)
            pixels[x, cy - band + i] = tuple(round(a * (1 - t) + b * t) for a, b in zip(top, bottom))
    unshifted = Image.new("RGB", (w, h))
    unshifted.paste(shifted.crop((w // 2, h // 2, w, h)), (0, 0))
    unshifted.paste(shifted.crop((0, h // 2, w // 2, h)), (w // 2, 0))
    unshifted.paste(shifted.crop((w // 2, 0, w, h // 2)), (0, h // 2))
    unshifted.paste(shifted.crop((0, 0, w // 2, h // 2)), (w // 2, h // 2))
    return unshifted


def crop_cells(sheet: Image.Image) -> list[Image.Image]:
    w, h = sheet.size
    cells = []
    for row in range(4):
        for col in range(4):
            x0, x1 = round(col * w / 4), round((col + 1) * w / 4)
            y0, y1 = round(row * h / 4), round((row + 1) * h / 4)
            # Recorta los separadores finos que inserta el generador.
            inset = max(2, round(min(w, h) * 0.003))
            tile = sheet.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))
            tile = seamless(tile).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
            cells.append(tile)
    return cells


def mosaic(cells: list[Image.Image], theme: str, category: str) -> Image.Image:
    # Ensamble 2x2 con celdas de la misma paleta; orientaciones variadas reducen el patrón visible.
    seed = sum(theme.encode("utf-8"))
    picks = [cells[(seed + i * 5) % len(cells)] for i in range(4)]
    transforms = [lambda x: x, Image.Image.transpose, lambda x: x.transpose(Image.Transpose.FLIP_LEFT_RIGHT), lambda x: x.transpose(Image.Transpose.ROTATE_180)]
    variants = [picks[0], picks[1].transpose(Image.Transpose.FLIP_LEFT_RIGHT), picks[2].transpose(Image.Transpose.FLIP_TOP_BOTTOM), picks[3].transpose(Image.Transpose.ROTATE_180)]
    out = Image.new("RGB", (MIX_SIZE, MIX_SIZE))
    for i, tile in enumerate(variants):
        x, y = (i % 2) * SIZE, (i // 2) * SIZE
        out.paste(tile, (x, y))
    return out


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    catalog = []
    for stem, (category, entries) in ATLAS.items():
        sheet_path = SHEETS / f"{stem}.png"
        if not sheet_path.exists():
            raise FileNotFoundError(sheet_path)
        cells = crop_cells(Image.open(sheet_path).convert("RGB"))
        for index, (name, themes) in enumerate(entries):
            tile = cells[index]
            filename = f"{category}_{name}.webp"
            tile.save(OUTPUT / filename, "WEBP", quality=88, method=6)
            catalog.append({"nombre": name, "categoría": category, "temas": themes, "archivo": filename})
        themes = sorted({theme for _, ts in entries for theme in ts})
        for theme in themes:
            name = f"{category}_{theme}_mix.webp"
            mosaic(cells, theme, category).save(OUTPUT / name, "WEBP", quality=88, method=6)
            catalog.append({"nombre": f"{theme}_mix", "categoría": category, "temas": [theme], "archivo": name, "resolución": MIX_SIZE})
    (OUTPUT / "catalogo.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(catalog)} texturas indexadas en {OUTPUT}")


if __name__ == "__main__":
    main()
