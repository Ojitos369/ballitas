"""
Postproceso de los tiles generados con Codex: recorte cuadrado, 512 px, costura suavizada (seamless) y
lava_emissive derivado de lava_albedo. Uso desde front/:  python3 tools/blender/postprocesar_tex.py
Requiere Pillow. Idempotente solo si se regeneran antes los originales con codex_imagen.py.
"""
import os
from PIL import Image, ImageChops, ImageOps

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "tex")
NOMBRES = ["lava_albedo", "roca_volcanica", "arena_dunas", "hielo_agrietado", "coral", "nube_suave", "musgo_bosque", "adoquin_neon"]
N = 512


def mascara():
    """1 en el centro, 0 en los bordes (producto de rampas triangulares suavizadas)."""
    m = Image.new("L", (N, N))
    px = m.load()
    f = [min(i, N - 1 - i) / (N / 2) for i in range(N)]
    f = [min(1.0, v * 2.0) for v in f]  # meseta central, rampa en el 25% exterior
    for y in range(N):
        for x in range(N):
            px[x, y] = int(255 * f[x] * f[y])
    return m


def main():
    m = mascara()
    for n in NOMBRES:
        p = os.path.join(TEX, n + ".png")
        im = Image.open(p).convert("RGB")
        im = ImageOps.fit(im, (N, N), Image.LANCZOS)
        desplazada = ImageChops.offset(im, N // 2, N // 2)
        im = Image.composite(im, desplazada, m)
        im.save(p, optimize=True)
        print(n, os.path.getsize(p) // 1024, "KB")
    a = Image.open(os.path.join(TEX, "lava_albedo.png")).convert("RGB")
    lum = a.convert("L").point(lambda v: 0 if v < 90 else min(255, (v - 90) * 3))
    em = ImageChops.multiply(a, Image.merge("RGB", (lum, lum, lum)))
    em = ImageChops.add(em, em)
    em.save(os.path.join(TEX, "lava_emissive.png"), optimize=True)


main()
