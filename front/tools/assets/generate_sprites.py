#!/usr/bin/env python3
"""Genera los sprites 2D con canal alfa para efectos y expresiones chibi en front/public/tex/.

Uso desde front/:
    python tools/assets/generate_sprites.py
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "tex"
PREVIEW_DIR = Path(__file__).resolve().parent / "preview"

SIZE = 128
SS = 4  # Supersampling 4x (512x512 -> 128x128 LANCZOS)
HI = SIZE * SS
MAX_BYTES = 200 * 1024


def grid(n: int = HI) -> tuple[np.ndarray, np.ndarray]:
    """Coordenadas normalizadas en [-1, 1] con centro en (0, 0) e Y hacia abajo."""
    c = (np.arange(n, dtype=np.float32) + 0.5) / n * 2.0 - 1.0
    x, y = np.meshgrid(c, c)
    return x, y


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def value_noise_2d(shape: tuple[int, int], cells: int, seed: int) -> np.ndarray:
    """Ruido suave bilineal en [0, 1] con caída a 0 fuera de interés."""
    rng = np.random.default_rng(seed)
    base = rng.random((cells, cells), dtype=np.float32)
    img = Image.fromarray((base * 255.0).astype(np.uint8), mode="L")
    up = img.resize(shape, resample=Image.Resampling.BICUBIC)
    return np.asarray(up, dtype=np.float32) / 255.0


def fbm_2d(n: int, octaves: int = 4, base_cells: int = 4, seed: int = 1) -> np.ndarray:
    acc = np.zeros((n, n), dtype=np.float32)
    amp = 0.5
    norm = 0.0
    for i in range(octaves):
        acc += amp * value_noise_2d((n, n), base_cells * (2 ** i), seed + i * 37)
        norm += amp
        amp *= 0.5
    return acc / norm


def radial_fade(x: np.ndarray, y: np.ndarray, inner: float = 0.65, outer: float = 0.96) -> np.ndarray:
    r = np.hypot(x, y)
    return 1.0 - smoothstep(inner, outer, r)


def premult_to_straight(rgba: np.ndarray) -> np.ndarray:
    """Convierte buffer float32 [0..1] RGBA (no premultiplicado) a uint8 RGBA redimensionado."""
    a = np.clip(rgba[..., 3:4], 0.0, 1.0)
    pm = np.concatenate([np.clip(rgba[..., :3], 0.0, 1.0) * a, a], axis=-1)
    img_hi = Image.fromarray((pm * 255.0 + 0.5).astype(np.uint8), mode="RGBA")
    img_lo = img_hi.resize((SIZE, SIZE), resample=Image.Resampling.LANCZOS)
    arr = np.asarray(img_lo, dtype=np.float32) / 255.0
    alpha = arr[..., 3:4]
    safe_a = np.where(alpha > 1e-4, alpha, 1.0)
    rgb = np.where(alpha > 1e-4, np.clip(arr[..., :3] / safe_a, 0.0, 1.0), 0.0)
    out = np.concatenate([rgb, np.clip(alpha, 0.0, 1.0)], axis=-1)
    return (out * 255.0 + 0.5).astype(np.uint8)


def save_sprite(rgba: np.ndarray, name: str) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    u8 = premult_to_straight(rgba)
    img = Image.fromarray(u8, mode="RGBA")
    img.save(path, format="PNG", optimize=True)
    size_bytes = path.stat().st_size
    if size_bytes >= MAX_BYTES:
        raise RuntimeError(f"{name} excede 200 KB: {size_bytes} bytes")
    return size_bytes


def draw_droplet(
    x: np.ndarray, y: np.ndarray, cx: float, cy: float, r: float, stretch: float = 1.35
) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve (alfa_gota, brillo_especular) para una gota de agua."""
    dx = (x - cx) / r
    dy = (y - cy) / (r * stretch)
    # Estrecha la parte superior para silueta de lágrima suave
    pinch = 1.0 + 0.32 * np.clip(-dy, -1.0, 1.0)
    d = np.hypot(dx * pinch, dy)
    alpha = 1.0 - smoothstep(0.78, 1.0, d)
    # Brillo especular arriba a la izquierda
    spec_d = np.hypot((x - (cx - r * 0.25)) / (r * 0.35), (y - (cy - r * 0.15)) / (r * 0.35))
    spec = 1.0 - smoothstep(0.3, 1.0, spec_d)
    return alpha, spec * alpha


# ---------------------------------------------------------------------------
# Sprites de efectos (FX)
# ---------------------------------------------------------------------------

def gen_fx_spray() -> np.ndarray:
    """Gotas y rocío cristalino para cascadas y géiseres."""
    x, y = grid()
    rgba = np.zeros((HI, HI, 4), dtype=np.float32)

    droplets = [
        (0.00, 0.06, 0.30, 1.35, 0.95),
        (-0.38, -0.18, 0.17, 1.25, 0.85),
        (0.36, -0.12, 0.19, 1.30, 0.88),
        (-0.26, 0.42, 0.14, 1.20, 0.78),
        (0.32, 0.38, 0.15, 1.25, 0.80),
        (0.04, -0.48, 0.13, 1.20, 0.75),
        (-0.55, 0.14, 0.10, 1.15, 0.65),
        (0.56, 0.10, 0.11, 1.15, 0.68),
        (-0.08, 0.58, 0.09, 1.10, 0.60),
    ]
    alpha_acc = np.zeros((HI, HI), dtype=np.float32)
    spec_acc = np.zeros((HI, HI), dtype=np.float32)
    for cx, cy, r, st, w in droplets:
        a, s = draw_droplet(x, y, cx, cy, r, st)
        alpha_acc = np.maximum(alpha_acc, a * w)
        spec_acc = np.maximum(spec_acc, s)

    # Halo de rocío muy suave sin borde circular perceptible
    mist = np.exp(-((x * x + y * y) / (0.34 ** 2))) * 0.22 * radial_fade(x, y, 0.65, 0.98)
    alpha = np.clip(np.maximum(alpha_acc, mist), 0.0, 1.0)

    # Color blanco-celeste claro para permitir tintado en Three.js
    base_rgb = np.array([0.86, 0.96, 1.0], dtype=np.float32)
    rgba[..., :3] = base_rgb + (1.0 - base_rgb) * spec_acc[..., None]
    rgba[..., 3] = alpha
    return rgba


def gen_fx_smoke() -> np.ndarray:
    """Nube de humo suave multicapa sin bordes duros."""
    x, y = grid()
    noise = fbm_2d(HI, octaves=4, base_cells=4, seed=11)
    warp_x = x + (noise - 0.5) * 0.26
    warp_y = y + (fbm_2d(HI, octaves=3, base_cells=3, seed=23) - 0.5) * 0.26

    lobes = [
        (0.00, 0.02, 0.42, 0.85),
        (-0.24, 0.08, 0.32, 0.72),
        (0.26, 0.04, 0.30, 0.70),
        (-0.08, -0.22, 0.30, 0.68),
        (0.16, -0.18, 0.26, 0.60),
    ]
    density = np.zeros((HI, HI), dtype=np.float32)
    for cx, cy, sig, w in lobes:
        d2 = (warp_x - cx) ** 2 + (warp_y - cy) ** 2
        density += w * np.exp(-d2 / (2.0 * sig * sig))

    density = np.clip(density * (0.72 + 0.45 * noise), 0.0, 1.0)
    alpha = np.clip(density * radial_fade(x, y, 0.42, 0.95), 0.0, 1.0) ** 1.15

    rgba = np.zeros((HI, HI, 4), dtype=np.float32)
    # Sutil sombreado vertical para dar volumen sin perder capacidad de tinte
    shade = 0.88 + 0.12 * np.clip(-y, -1.0, 1.0)
    rgba[..., 0] = shade * 0.97
    rgba[..., 1] = shade * 0.98
    rgba[..., 2] = shade * 1.00
    rgba[..., 3] = alpha
    return rgba


def gen_fx_ember() -> np.ndarray:
    """Brasa incandescente con núcleo blanco-amarillo, corona naranja y chispas."""
    x, y = grid()
    n = fbm_2d(HI, octaves=4, base_cells=5, seed=42)
    r = np.hypot(x * 1.15, y * 0.92) + (n - 0.5) * 0.16

    core = np.exp(-(r ** 2) / (0.20 ** 2))
    glow = np.exp(-(r ** 2) / (0.44 ** 2))

    # Chispitas satélites asimétricas
    sparks = np.zeros((HI, HI), dtype=np.float32)
    for sx, sy, sr in [(-0.46, -0.30, 0.065), (0.38, -0.44, 0.05), (0.48, 0.24, 0.055), (-0.24, 0.52, 0.045)]:
        sd = np.hypot(x - sx, y - sy)
        sparks += np.exp(-(sd ** 2) / (sr ** 2)) * 0.85

    intensity = np.clip(core * 1.2 + glow * 0.65 + sparks, 0.0, 1.35)
    alpha = np.clip((glow * 0.95 + core + sparks) * radial_fade(x, y, 0.52, 0.96), 0.0, 1.0)

    # Gradiente térmico: rojo oscuro -> naranja -> amarillo -> blanco
    col_r = np.clip(intensity * 1.9, 0.0, 1.0)
    col_g = np.clip((intensity - 0.22) * 1.35, 0.0, 1.0)
    col_b = np.clip((intensity - 0.68) * 2.1, 0.0, 1.0)

    rgba = np.stack([col_r, col_g, col_b, alpha], axis=-1).astype(np.float32)
    return rgba


def gen_fx_foam() -> np.ndarray:
    """Espuma aireada de burbujas blancas para cascadas y olas."""
    x, y = grid()
    rng = np.random.default_rng(109)

    foam = np.zeros((HI, HI), dtype=np.float32)
    # Base lechosa suave sin borde circular visible
    foam += np.exp(-(x * x + y * y) / (0.32 ** 2)) * 0.30

    # Cúmulo orgánico de burbujas con borde nítido y centro ligeramente traslúcido
    for _ in range(26):
        ang = rng.uniform(0.0, 2.0 * np.pi)
        rad = np.sqrt(rng.uniform(0.0, 1.0)) * 0.54
        bx = np.cos(ang) * rad
        by = np.sin(ang) * rad
        br = rng.uniform(0.09, 0.21) * (1.05 - 0.35 * rad)
        d = np.hypot(x - bx, y - by) / br
        rim = smoothstep(0.45, 0.82, d) * (1.0 - smoothstep(0.84, 1.02, d))
        fill = (1.0 - smoothstep(0.75, 1.0, d)) * 0.55
        foam = np.maximum(foam, np.clip(fill + rim * 0.75, 0.0, 1.0))

    alpha = np.clip(foam * radial_fade(x, y, 0.65, 0.98), 0.0, 1.0)
    rgba = np.ones((HI, HI, 4), dtype=np.float32)
    rgba[..., :3] = 0.96
    rgba[..., 3] = alpha
    return rgba


def gen_fx_ring() -> np.ndarray:
    """Aro de onda expansiva limpio, tintable, con estela interior."""
    x, y = grid()
    r = np.hypot(x, y)
    ang = np.arctan2(y, x)
    wobble = 0.015 * np.sin(ang * 6.0) + 0.01 * np.cos(ang * 10.0)
    rw = r + wobble

    # Borde exterior nítido en r ~ 0.78, caída suave hacia el interior
    outer_cut = 1.0 - smoothstep(0.76, 0.88, rw)
    inner_fade = smoothstep(0.40, 0.73, rw)
    crest = np.exp(-((rw - 0.73) ** 2) / (0.065 ** 2))
    alpha = np.clip((outer_cut * inner_fade * 0.85 + crest * 0.75) * radial_fade(x, y, 0.82, 0.97), 0.0, 1.0)

    rgba = np.ones((HI, HI, 4), dtype=np.float32)
    rgba[..., 3] = alpha
    return rgba


# ---------------------------------------------------------------------------
# Sprites chibi
# ---------------------------------------------------------------------------

def gen_chibi_eye() -> np.ndarray:
    """Ojo grande chibi expresivo con iris degradado, pestaña y dos brillos."""
    x, y = grid()

    # Óvalo principal del ojo (ligeramente más alto que ancho)
    ex = x / 0.66
    ey = (y - 0.04) / 0.80
    d_eye = np.hypot(ex, ey)
    eye_mask = 1.0 - smoothstep(0.95, 1.0, d_eye)

    # Iris degradado vertical: azul profundo arriba -> cian luminoso abajo
    t_vert = np.clip((ey + 0.85) / 1.70, 0.0, 1.0)
    top_col = np.array([0.08, 0.11, 0.34], dtype=np.float32)
    mid_col = np.array([0.19, 0.48, 0.94], dtype=np.float32)
    bot_col = np.array([0.56, 0.92, 0.99], dtype=np.float32)

    iris_rgb = np.where(
        t_vert[..., None] < 0.52,
        top_col + (mid_col - top_col) * (t_vert[..., None] / 0.52),
        mid_col + (bot_col - mid_col) * ((t_vert[..., None] - 0.52) / 0.48),
    )

    # Rayos radiales sutiles dentro del iris
    ang = np.arctan2(ey, ex)
    rays = 0.06 * np.sin(ang * 18.0) * smoothstep(0.25, 0.75, d_eye)
    iris_rgb = np.clip(iris_rgb + rays[..., None], 0.0, 1.0)

    # Anillo limbal oscuro en el borde del iris
    limbal = smoothstep(0.74, 0.94, d_eye) * 0.65
    iris_rgb *= (1.0 - limbal[..., None])

    # Pupila ovalada oscura
    d_pupil = np.hypot(ex / 0.44, (ey + 0.02) / 0.50)
    pupil_mask = 1.0 - smoothstep(0.84, 0.98, d_pupil)
    pupil_col = np.array([0.06, 0.05, 0.14], dtype=np.float32)
    rgb = iris_rgb * (1.0 - pupil_mask[..., None]) + pupil_col * pupil_mask[..., None]

    # Pestaña superior gruesa y curva
    lash_center_y = -0.72 + 0.52 * (ex ** 2)
    lash_dist = np.abs(y - lash_center_y)
    lash_width = 0.13 * (1.0 - 0.35 * np.clip(np.abs(ex), 0.0, 1.0))
    lash_mask = (1.0 - smoothstep(lash_width * 0.65, lash_width, lash_dist)) * (1.0 - smoothstep(0.95, 1.15, np.abs(ex)))
    lash_col = np.array([0.09, 0.07, 0.16], dtype=np.float32)

    # Brillo principal grande (arriba-izquierda, inclinado)
    hx = (x + 0.21) * 0.90 + (y + 0.25) * 0.42
    hy = -(x + 0.21) * 0.42 + (y + 0.25) * 0.90
    d_hi1 = np.hypot(hx / 0.21, hy / 0.15)
    hi1 = 1.0 - smoothstep(0.75, 0.98, d_hi1)

    # Brillo secundario pequeño (abajo-derecha)
    d_hi2 = np.hypot((x - 0.22) / 0.10, (y - 0.36) / 0.10)
    hi2 = 1.0 - smoothstep(0.70, 0.98, d_hi2)

    # Puntito extra de luz
    d_hi3 = np.hypot((x - 0.28) / 0.055, (y + 0.05) / 0.055)
    hi3 = 1.0 - smoothstep(0.65, 0.98, d_hi3)

    highlights = np.clip(hi1 + hi2 * 0.92 + hi3 * 0.8, 0.0, 1.0) * eye_mask
    rgb = rgb * (1.0 - highlights[..., None]) + highlights[..., None]

    # Combinar pestaña encima del borde superior
    alpha = np.clip(np.maximum(eye_mask, lash_mask), 0.0, 1.0)
    rgb = rgb * (1.0 - lash_mask[..., None]) + lash_col * lash_mask[..., None]

    rgba = np.concatenate([rgb, alpha[..., None]], axis=-1).astype(np.float32)
    return rgba


def star4_dist(x: np.ndarray, y: np.ndarray, scale: float = 1.0, p: float = 0.46) -> np.ndarray:
    """Distancia estilo astroide para destello de 4 puntas."""
    ax = np.abs(x / scale)
    ay = np.abs(y / scale)
    return (ax ** p + ay ** p) ** (1.0 / p)


def gen_chibi_sparkle() -> np.ndarray:
    """Destello chibi de 4 puntas estilizadas más dos destellitos satélites."""
    x, y = grid()
    d_main = star4_dist(x, y, scale=0.86, p=0.45)
    shape_main = 1.0 - smoothstep(0.86, 0.98, d_main)
    glow_main = np.exp(-(d_main ** 2) / (0.48 ** 2)) * 0.55

    # Dos destellos pequeños acompañantes
    d_s1 = star4_dist(x + 0.54, y + 0.48, scale=0.26, p=0.48)
    s1 = 1.0 - smoothstep(0.82, 0.98, d_s1)

    d_s2 = star4_dist(x - 0.56, y - 0.44, scale=0.22, p=0.48)
    s2 = 1.0 - smoothstep(0.82, 0.98, d_s2)

    alpha = np.clip(np.maximum(shape_main, np.maximum(s1 * 0.9, s2 * 0.85)) + glow_main * radial_fade(x, y, 0.6, 0.96), 0.0, 1.0)
    rgba = np.ones((HI, HI, 4), dtype=np.float32)
    rgba[..., :3] = 1.0
    rgba[..., 3] = alpha
    return rgba


def gen_chibi_blush() -> np.ndarray:
    """Rubor chibi rosado-coral suave con tres rayitas kawaii sutiles."""
    x, y = grid()
    d = np.hypot(x / 0.78, y / 0.44)
    soft_oval = np.exp(-(d ** 2) / (0.62 ** 2)) * radial_fade(x, y, 0.62, 0.96)

    # Tres rayitas diagonales suaves en el centro
    stripes = np.zeros((HI, HI), dtype=np.float32)
    for ox in (-0.28, 0.0, 0.28):
        dx = (x - ox) + y * 0.45
        line = np.exp(-(dx ** 2) / (0.045 ** 2))
        vert = np.exp(-(y ** 2) / (0.20 ** 2))
        stripes += line * vert

    alpha = np.clip(soft_oval * 0.78 + stripes * soft_oval * 0.45, 0.0, 1.0)
    base_col = np.array([1.0, 0.42, 0.56], dtype=np.float32)
    stripe_col = np.array([0.98, 0.25, 0.43], dtype=np.float32)
    t = np.clip(stripes, 0.0, 1.0)[..., None]
    rgb = base_col * (1.0 - t) + stripe_col * t
    return np.concatenate([rgb, alpha[..., None]], axis=-1).astype(np.float32)


def gen_chibi_star() -> np.ndarray:
    """Estrella chibi gordita de 5 puntas redondeadas, cálida y luminosa."""
    x, y = grid()
    # Rotar para que una punta mire hacia arriba (-Y)
    ang = np.arctan2(y, x) + np.pi / 2.0
    r = np.hypot(x, y)

    # Radio de estrella de 5 puntas con suavizado redondeado
    wave = np.cos(5.0 * ang)
    r_star = 0.58 + 0.23 * wave + 0.04 * np.cos(10.0 * ang)
    d = r / r_star

    body = 1.0 - smoothstep(0.92, 1.0, d)
    glow = np.exp(-(d ** 2) / (0.85 ** 2)) * 0.35 * radial_fade(x, y, 0.65, 0.97)
    alpha = np.clip(np.maximum(body, glow), 0.0, 1.0)

    # Gradiente cálido centro blanco-crema -> borde dorado brillante
    t = np.clip(d, 0.0, 1.0)[..., None]
    inner = np.array([1.0, 0.99, 0.86], dtype=np.float32)
    outer = np.array([1.0, 0.82, 0.26], dtype=np.float32)
    rgb = inner * (1.0 - t) + outer * t

    return np.concatenate([rgb, alpha[..., None]], axis=-1).astype(np.float32)


def build_contact_sheet(names: list[str]) -> None:
    """Crea una hoja de contacto 3x3 sobre tablero de ajedrez para verificar alfa."""
    cols = 3
    rows = (len(names) + cols - 1) // cols
    pad = 12
    cell = SIZE
    w = cols * cell + (cols + 1) * pad
    h = rows * cell + (rows + 1) * pad

    # Tablero de ajedrez oscuro para inspeccionar transparencias
    yy, xx = np.mgrid[0:h, 0:w]
    checker = ((xx // 16 + yy // 16) % 2) == 0
    bg = np.where(checker[..., None], 48, 66).astype(np.uint8)
    sheet = Image.fromarray(np.repeat(bg, 3, axis=-1), mode="RGB")

    for idx, name in enumerate(names):
        r, c = divmod(idx, cols)
        px = pad + c * (cell + pad)
        py = pad + r * (cell + pad)
        sprite = Image.open(OUT_DIR / name).convert("RGBA")
        sheet.paste(sprite, (px, py), mask=sprite)

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW_DIR / "sprites_sheet.png", format="PNG", optimize=True)


def main() -> None:
    generators = {
        "fx_spray.png": gen_fx_spray,
        "fx_smoke.png": gen_fx_smoke,
        "fx_ember.png": gen_fx_ember,
        "fx_foam.png": gen_fx_foam,
        "fx_ring.png": gen_fx_ring,
        "chibi_eye.png": gen_chibi_eye,
        "chibi_sparkle.png": gen_chibi_sparkle,
        "chibi_blush.png": gen_chibi_blush,
        "chibi_star.png": gen_chibi_star,
    }
    report: list[tuple[str, int]] = []
    for name, fn in generators.items():
        size_b = save_sprite(fn(), name)
        report.append((name, size_b))

    build_contact_sheet(list(generators.keys()))

    total_kb = sum(b for _, b in report) / 1024.0
    print(f"Generados {len(report)} sprites en {OUT_DIR} (total {total_kb:.1f} KB)")
    for name, b in report:
        print(f"  {name:20s} {b / 1024.0:6.1f} KB")


if __name__ == "__main__":
    main()
