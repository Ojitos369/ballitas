#!/usr/bin/env python3
"""Generador procedural de texturas tileables y sprites para Ballitas.

Genera todas las texturas en ``front/public/tex/`` y mosaicos 2x2 de
verificación de continuidad en ``front/tools/assets/preview/``.
Usa ruido periódico 2D (fBm, domain warping), Voronoi periódico en toro 2D
y patrones geométricos periódicos para garantizar 0 costuras y coherencia
exacta entre albedo, normal (tangent-space OpenGL +Y) y emissive.
"""

from __future__ import annotations

import math
from pathlib import Path
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "tex"
PREVIEW_DIR = Path(__file__).resolve().parent / "preview"

SIZE = 512
MAX_BYTES = 400 * 1024


# ---------------------------------------------------------------------------
# Utilidades matemáticas y ruido periódico
# ---------------------------------------------------------------------------

def _fade(t: np.ndarray) -> np.ndarray:
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def periodic_value_noise(size: int, freq: int, seed: int) -> np.ndarray:
    """Ruido de valor 2D estrictamente periódico con interpolación quíntica."""
    rng = np.random.default_rng(seed)
    grid = rng.random((freq, freq), dtype=np.float32)

    coords = np.linspace(0.0, float(freq), size, endpoint=False, dtype=np.float32)
    xi = np.floor(coords).astype(np.int32)
    xf = coords - xi
    u = _fade(xf)

    x0 = xi % freq
    x1 = (xi + 1) % freq

    g00 = grid[np.ix_(x0, x0)]
    g10 = grid[np.ix_(x0, x1)]
    g01 = grid[np.ix_(x1, x0)]
    g11 = grid[np.ix_(x1, x1)]

    u_row = u[:, None]
    u_col = u[None, :]

    nx0 = g00 * (1.0 - u_col) + g10 * u_col
    nx1 = g01 * (1.0 - u_col) + g11 * u_col
    return (nx0 * (1.0 - u_row) + nx1 * u_row).astype(np.float32)


def periodic_fbm(
    size: int,
    base_freq: int,
    octaves: int = 5,
    lacunarity: int = 2,
    gain: float = 0.5,
    seed: int = 1,
) -> np.ndarray:
    """fBm periódico normalizado en [0, 1]."""
    acc = np.zeros((size, size), dtype=np.float32)
    amp = 1.0
    norm = 0.0
    freq = base_freq
    for i in range(octaves):
        acc += amp * periodic_value_noise(size, freq, seed + i * 97)
        norm += amp
        amp *= gain
        freq *= lacunarity
    return acc / max(norm, 1e-6)


def warp_field(
    field: np.ndarray,
    dx: np.ndarray,
    dy: np.ndarray,
    strength: float,
) -> np.ndarray:
    """Deforma un campo 2D periódicamente usando desplazamientos (dx, dy) en [-1, 1]."""
    size = field.shape[0]
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    sx = (xx + dx * strength) % size
    sy = (yy + dy * strength) % size

    x0 = np.floor(sx).astype(np.int32) % size
    y0 = np.floor(sy).astype(np.int32) % size
    x1 = (x0 + 1) % size
    y1 = (y0 + 1) % size
    fx = sx - np.floor(sx)
    fy = sy - np.floor(sy)

    v00 = field[y0, x0]
    v10 = field[y0, x1]
    v01 = field[y1, x0]
    v11 = field[y1, x1]
    return (
        (v00 * (1.0 - fx) + v10 * fx) * (1.0 - fy)
        + (v01 * (1.0 - fx) + v11 * fx) * fy
    ).astype(np.float32)


def periodic_voronoi(
    size: int,
    cells: int,
    seed: int,
    jitter: float = 0.85,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Voronoi 2D periódico exacto.

    Devuelve (F1, F2, cell_id, cell_rand) normalizados al tamaño de celda.
    """
    rng = np.random.default_rng(seed)
    pts_x = (np.arange(cells, dtype=np.float32)[None, :] + 0.5 + (rng.random((cells, cells), dtype=np.float32) - 0.5) * jitter)
    pts_y = (np.arange(cells, dtype=np.float32)[:, None] + 0.5 + (rng.random((cells, cells), dtype=np.float32) - 0.5) * jitter)
    cell_vals = rng.random((cells, cells), dtype=np.float32)

    u = (np.arange(size, dtype=np.float32) + 0.5) * (cells / size)
    gx, gy = np.meshgrid(u, u)
    ix = np.floor(gx).astype(np.int32)
    iy = np.floor(gy).astype(np.int32)

    f1 = np.full((size, size), 1e9, dtype=np.float32)
    f2 = np.full((size, size), 1e9, dtype=np.float32)
    cid = np.zeros((size, size), dtype=np.int32)
    crand = np.zeros((size, size), dtype=np.float32)

    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx = (ix + dx) % cells
            ny = (iy + dy) % cells
            px = pts_x[ny, nx] + (ix + dx - nx)
            py = pts_y[ny, nx] + (iy + dy - ny)
            d = np.hypot(gx - px, gy - py)

            mask1 = d < f1
            f2 = np.where(mask1, f1, np.minimum(f2, d))
            f1 = np.where(mask1, d, f1)
            cid = np.where(mask1, ny * cells + nx, cid)
            crand = np.where(mask1, cell_vals[ny, nx], crand)

    return f1, f2, cid, crand


def height_to_normal(height: np.ndarray, strength: float = 4.0) -> np.ndarray:
    """Convierte heightmap [0, 1] periódico en normal map tangent-space OpenGL (+Y arriba)."""
    dh_dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    # En imagen PNG la fila 0 está arriba (+Y), por eso row-1 menos row+1
    dh_dy = (np.roll(height, 1, axis=0) - np.roll(height, -1, axis=0)) * 0.5

    nx = -dh_dx * strength
    ny = -dh_dy * strength
    nz = np.ones_like(height, dtype=np.float32)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)

    rgb = np.stack(
        [
            (nx * inv_len * 0.5 + 0.5),
            (ny * inv_len * 0.5 + 0.5),
            (nz * inv_len * 0.5 + 0.5),
        ],
        axis=-1,
    )
    return np.clip(rgb * 255.0 + 0.5, 0, 255).astype(np.uint8)


def color_ramp(t: np.ndarray, stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    """Interpola linealmente un campo [0, 1] por paradas RGB."""
    t = np.clip(t, 0.0, 1.0)
    out = np.zeros((*t.shape, 3), dtype=np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if i == 0:
            mask = t <= p1
        elif i == len(stops) - 2:
            mask = t >= p0
        else:
            mask = (t >= p0) & (t <= p1)
        alpha = np.clip((t - p0) / max(p1 - p0, 1e-6), 0.0, 1.0)
        for ch in range(3):
            val = c0[ch] * (1.0 - alpha) + c1[ch] * alpha
            out[..., ch] = np.where(mask, val, out[..., ch])
    return np.clip(out, 0, 255)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    denom = edge1 - edge0
    if abs(denom) < 1e-6:
        return (x >= edge1).astype(np.float32)
    t = np.clip((x - edge0) / denom, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def save_png_optimized(arr: np.ndarray, path: Path, mode: str = "RGB") -> int:
    """Guarda PNG optimizado y cuantiza a paleta solo si supera MAX_BYTES."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(arr, mode=mode)
    img.save(path, format="PNG", optimize=True, compress_level=9)
    size_bytes = path.stat().st_size
    if size_bytes > MAX_BYTES and mode == "RGB":
        q = img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(path, format="PNG", optimize=True, compress_level=9)
        size_bytes = path.stat().st_size
    if size_bytes > MAX_BYTES:
        raise RuntimeError(f"{path.name} excede {MAX_BYTES} bytes ({size_bytes})")
    return size_bytes


# ---------------------------------------------------------------------------
# Generadores de los 10 temas
# ---------------------------------------------------------------------------

def gen_sombrio() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 4, 4, seed=101) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 4, 4, seed=102) * 2.0 - 1.0
    macro = warp_field(periodic_fbm(SIZE, 4, 5, seed=103), wx, wy, 36.0)
    ridges = 1.0 - np.abs(warp_field(periodic_fbm(SIZE, 6, 4, seed=104), wx, wy, 24.0) * 2.0 - 1.0)
    micro = periodic_fbm(SIZE, 32, 3, seed=105)

    h = np.clip(0.55 * macro + 0.32 * (ridges ** 2.0) + 0.13 * micro, 0.0, 1.0)
    albedo = color_ramp(
        h,
        [
            (0.0, (14, 8, 28)),
            (0.35, (32, 16, 56)),
            (0.68, (60, 32, 98)),
            (1.0, (98, 56, 145)),
        ],
    ).astype(np.uint8)

    vein = smoothstep(0.76, 0.96, ridges) * smoothstep(0.45, 0.85, macro)
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(vein * 70, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(vein * 24, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(vein * 115, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=5.0)
    return albedo, normal, emissive


def gen_bosque() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 4, 4, seed=201) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 4, 4, seed=202) * 2.0 - 1.0
    moss = warp_field(periodic_fbm(SIZE, 6, 5, seed=203), wx, wy, 28.0)

    # Vetas orgánicas de corteza/raíces
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    bark_base = 0.5 + 0.5 * np.sin((xx / SIZE) * 2.0 * math.pi * 6.0 + wx * 4.5 + wy * 2.5)
    bark = warp_field(bark_base, wx, wy, 18.0)
    micro = periodic_fbm(SIZE, 32, 3, seed=204)

    moss_mask = smoothstep(0.32, 0.68, moss)
    h = np.clip(0.45 * moss + 0.4 * bark * (1.0 - 0.5 * moss_mask) + 0.15 * micro, 0.0, 1.0)

    albedo_bark = color_ramp(bark, [(0.0, (34, 26, 16)), (0.5, (58, 44, 26)), (1.0, (78, 62, 36))])
    albedo_moss = color_ramp(
        0.7 * moss + 0.3 * micro,
        [(0.0, (24, 52, 22)), (0.45, (44, 86, 34)), (0.8, (76, 122, 46)), (1.0, (108, 152, 62))],
    )
    albedo = np.clip(albedo_bark * (1.0 - moss_mask[..., None]) + albedo_moss * moss_mask[..., None], 0, 255).astype(np.uint8)

    # Esporas bioluminiscentes diminutas muy dispersas
    f1, _, _, cr = periodic_voronoi(SIZE, 14, seed=205)
    spores = smoothstep(0.14, 0.02, f1) * (cr > 0.88).astype(np.float32) * moss_mask
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(spores * 40, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(spores * 95, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(spores * 28, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=5.5)
    return albedo, normal, emissive


def gen_mar() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 4, 4, seed=301) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 4, 4, seed=302) * 2.0 - 1.0

    f1a, f2a, _, _ = periodic_voronoi(SIZE, 8, seed=303)
    f1b, f2b, _, _ = periodic_voronoi(SIZE, 14, seed=304)
    caustic_a = np.exp(-11.0 * warp_field(f2a - f1a, wx, wy, 14.0))
    caustic_b = np.exp(-13.0 * warp_field(f2b - f1b, wy, wx, 10.0))
    caustic = np.clip(0.65 * caustic_a + 0.45 * caustic_b, 0.0, 1.0)

    depth = periodic_fbm(SIZE, 3, 4, seed=305)
    h = np.clip(0.45 * depth + 0.55 * caustic, 0.0, 1.0)

    albedo = color_ramp(
        h,
        [
            (0.0, (8, 36, 76)),
            (0.42, (16, 74, 128)),
            (0.74, (44, 152, 206)),
            (1.0, (140, 232, 252)),
        ],
    ).astype(np.uint8)

    glow = smoothstep(0.62, 0.98, caustic)
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(glow * 18, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(glow * 55, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(glow * 72, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=3.5)
    return albedo, normal, emissive


def gen_desierto() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 3, 4, seed=401) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 3, 4, seed=402) * 2.0 - 1.0

    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    # Coeficientes enteros (6 y 2) para periodicidad exacta en X e Y
    phase = (6.0 * (xx / SIZE) + 2.0 * (yy / SIZE)) * 2.0 * math.pi
    dune_raw = 0.5 + 0.5 * np.sin(phase + wx * 2.2)
    # Cresta asimétrica de duna
    dune = warp_field(dune_raw ** 0.75, wx, wy, 16.0)
    grain = periodic_fbm(SIZE, 48, 3, seed=403)
    macro = periodic_fbm(SIZE, 4, 3, seed=404)

    h = np.clip(0.68 * dune + 0.17 * macro + 0.15 * grain, 0.0, 1.0)
    albedo = color_ramp(
        h,
        [
            (0.0, (132, 78, 34)),
            (0.38, (186, 124, 58)),
            (0.75, (218, 166, 94)),
            (1.0, (238, 198, 132)),
        ],
    ).astype(np.uint8)

    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    normal = height_to_normal(h, strength=4.5)
    return albedo, normal, emissive


def gen_hielo() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 5, 4, seed=501) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 5, 4, seed=502) * 2.0 - 1.0

    f1, f2, _, cr = periodic_voronoi(SIZE, 9, seed=503)
    edge = warp_field(f2 - f1, wx, wy, 10.0)
    crack = smoothstep(0.09, 0.01, edge)

    f1b, f2b, _, _ = periodic_voronoi(SIZE, 20, seed=504)
    micro_crack = smoothstep(0.06, 0.005, warp_field(f2b - f1b, wy, wx, 5.0)) * 0.5

    ice_body = periodic_fbm(SIZE, 6, 4, seed=505)
    h = np.clip(0.55 * ice_body + 0.18 * cr - 0.35 * crack - 0.15 * micro_crack + 0.25, 0.0, 1.0)

    albedo = color_ramp(
        h,
        [
            (0.0, (36, 98, 132)),
            (0.38, (88, 174, 208)),
            (0.72, (152, 222, 242)),
            (1.0, (226, 248, 255)),
        ],
    ).astype(np.uint8)
    # Resalte blanco frío en bordes de fractura
    rim = smoothstep(0.04, 0.11, edge) * (1.0 - smoothstep(0.11, 0.18, edge))
    albedo = np.clip(albedo.astype(np.float32) + rim[..., None] * 35.0, 0, 255).astype(np.uint8)

    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(crack * 14, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(crack * 46, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(crack * 62, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=5.0)
    return albedo, normal, emissive


def gen_volcan() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 4, 4, seed=601) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 4, 4, seed=602) * 2.0 - 1.0

    f1, f2, _, _ = periodic_voronoi(SIZE, 7, seed=603)
    edge = warp_field(f2 - f1, wx, wy, 14.0)
    crack_wide = smoothstep(0.13, 0.015, edge)
    crack_core = smoothstep(0.055, 0.005, edge)

    rock_macro = periodic_fbm(SIZE, 8, 4, seed=604)
    rock_pores = periodic_fbm(SIZE, 40, 3, seed=605)
    rock_h = np.clip(0.65 * rock_macro + 0.35 * rock_pores, 0.0, 1.0)

    h = np.clip(rock_h * (1.0 - 0.65 * crack_wide), 0.0, 1.0)
    albedo_rock = color_ramp(
        rock_h,
        [(0.0, (16, 14, 16)), (0.55, (34, 28, 28)), (1.0, (56, 46, 44))],
    )
    albedo_lava = color_ramp(
        crack_core,
        [(0.0, (140, 24, 8)), (0.55, (230, 74, 16)), (1.0, (255, 168, 48))],
    )
    albedo = np.clip(
        albedo_rock * (1.0 - crack_wide[..., None]) + albedo_lava * crack_wide[..., None],
        0,
        255,
    ).astype(np.uint8)

    # Emissive = grietas rojas/naranjas, roca completamente negra
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(crack_wide * 175 + crack_core * 65, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(crack_wide * 32 + crack_core * 72, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(crack_core * 14, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=6.5)
    return albedo, normal, emissive


def gen_cristal() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    f1, f2, cid, cr = periodic_voronoi(SIZE, 9, seed=701, jitter=0.95)
    rng = np.random.default_rng(702)
    # Normal inclinada constante por faceta para reflejos prismáticos reales
    tilt_x = rng.uniform(-1.0, 1.0, 81).astype(np.float32)[cid]
    tilt_y = rng.uniform(-1.0, 1.0, 81).astype(np.float32)[cid]

    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
    facet_plane = (xx * tilt_x + yy * tilt_y) * 0.25
    bevel = smoothstep(0.0, 0.06, f2 - f1)

    hue_idx = cr
    albedo = color_ramp(
        hue_idx,
        [
            (0.0, (92, 186, 232)),
            (0.35, (146, 152, 238)),
            (0.70, (212, 162, 234)),
            (1.0, (162, 238, 224)),
        ],
    )
    albedo = np.clip(albedo * (0.82 + 0.18 * bevel[..., None]) + (1.0 - bevel[..., None]) * 42.0, 0, 255).astype(np.uint8)

    # Normal facetada directa
    nx = tilt_x * 0.45 * bevel
    ny = tilt_y * 0.45 * bevel
    nz = np.ones_like(nx)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.clip(
        np.stack([nx * inv_len * 0.5 + 0.5, ny * inv_len * 0.5 + 0.5, nz * inv_len * 0.5 + 0.5], axis=-1) * 255.0,
        0,
        255,
    ).astype(np.uint8)
    _ = facet_plane

    edge_glow = (1.0 - bevel) * smoothstep(0.65, 1.0, cr)
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(edge_glow * 36, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(edge_glow * 48, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(edge_glow * 64, 0, 255).astype(np.uint8)
    return albedo, normal, emissive


def gen_nubes() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 3, 4, seed=801) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 3, 4, seed=802) * 2.0 - 1.0
    c1 = warp_field(periodic_fbm(SIZE, 3, 5, seed=803), wx, wy, 26.0)
    c2 = periodic_fbm(SIZE, 6, 4, seed=804)
    h = np.clip(0.65 * c1 + 0.35 * c2, 0.0, 1.0)

    albedo = color_ramp(
        h,
        [
            (0.0, (176, 204, 232)),
            (0.45, (214, 230, 246)),
            (0.8, (238, 245, 252)),
            (1.0, (250, 252, 255)),
        ],
    ).astype(np.uint8)

    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    crest = smoothstep(0.75, 1.0, h)
    emissive[..., 0] = np.clip(crest * 12, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(crest * 16, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(crest * 22, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=2.2)
    return albedo, normal, emissive


def gen_neon() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    base_noise = periodic_fbm(SIZE, 16, 3, seed=901)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)

    # Cuadrícula principal (8x8 celdas de 64px) + sub-pistas de circuito
    cell = 64.0
    gx = np.abs(((xx + 2.0) % cell) - 2.0)
    gy = np.abs(((yy + 2.0) % cell) - 2.0)
    grid_line = smoothstep(3.2, 1.0, np.minimum(gx, gy))

    # Sub-trazos de circuito dentro de cada celda
    sub = 32.0
    sx = np.abs(((xx + 1.5) % sub) - 1.5)
    sy = np.abs(((yy + 1.5) % sub) - 1.5)
    ix = (xx // sub).astype(np.int32)
    iy = (yy // sub).astype(np.int32)
    rng = np.random.default_rng(902)
    cell_mode = rng.integers(0, 4, size=(SIZE // 32, SIZE // 32))
    mode = cell_mode[iy % (SIZE // 32), ix % (SIZE // 32)]
    trace_h = smoothstep(2.4, 0.8, sy) * (mode == 1).astype(np.float32)
    trace_v = smoothstep(2.4, 0.8, sx) * (mode == 2).astype(np.float32)

    # Nodos/vías circulares en intersecciones
    cx = (xx % cell) - cell * 0.5
    cy = (yy % cell) - cell * 0.5
    dist_c = np.hypot(cx, cy)
    via = smoothstep(6.0, 3.8, dist_c) * (1.0 - smoothstep(2.2, 0.8, dist_c))

    cyan_mask = np.clip(grid_line, 0.0, 1.0)
    mag_mask = np.clip(trace_h + trace_v + via, 0.0, 1.0)
    circuit_h = np.clip(0.15 * base_noise + 0.75 * np.maximum(cyan_mask, mag_mask), 0.0, 1.0)

    albedo = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    albedo[..., 0] = 10 + base_noise * 14
    albedo[..., 1] = 12 + base_noise * 16
    albedo[..., 2] = 24 + base_noise * 24
    # Tinte de circuitos en albedo
    albedo[..., 0] += cyan_mask * 30 + mag_mask * 195
    albedo[..., 1] += cyan_mask * 195 + mag_mask * 32
    albedo[..., 2] += cyan_mask * 220 + mag_mask * 160
    albedo = np.clip(albedo, 0, 255).astype(np.uint8)

    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    emissive[..., 0] = cyan_mask * 18 + mag_mask * 165
    emissive[..., 1] = cyan_mask * 155 + mag_mask * 20
    emissive[..., 2] = cyan_mask * 175 + mag_mask * 135
    emissive = np.clip(emissive, 0, 255).astype(np.uint8)

    normal = height_to_normal(circuit_h, strength=4.0)
    return albedo, normal, emissive


def gen_jardin() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    wx = periodic_fbm(SIZE, 5, 4, seed=1001) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 5, 4, seed=1002) * 2.0 - 1.0

    foliage = warp_field(periodic_fbm(SIZE, 8, 4, seed=1003), wx, wy, 18.0)
    f1, f2, _, cr = periodic_voronoi(SIZE, 11, seed=1004, jitter=0.9)
    # f1/f2 vale 1.0 en los bordes de Voronoi: garantiza 0 cortes rectos entre celdas
    ratio = warp_field(f1 / np.maximum(f2, 1e-4), wx, wy, 4.0)
    has_flower = (cr > 0.38).astype(np.float32)
    petal_zone = smoothstep(0.58, 0.24, ratio) * has_flower
    petal_center = smoothstep(0.16, 0.05, ratio) * has_flower

    albedo_leaf = color_ramp(
        foliage,
        [(0.0, (32, 76, 36)), (0.5, (58, 118, 52)), (1.0, (92, 152, 72))],
    )
    albedo_petal = color_ramp(
        np.clip(cr * 0.7 + (f2 - f1) * 0.6, 0.0, 1.0),
        [(0.0, (218, 96, 146)), (0.5, (242, 148, 184)), (1.0, (254, 208, 224))],
    )
    albedo = albedo_leaf * (1.0 - petal_zone[..., None]) + albedo_petal * petal_zone[..., None]
    # Centro dorado suave de flores
    albedo[..., 0] = albedo[..., 0] * (1.0 - petal_center) + 245 * petal_center
    albedo[..., 1] = albedo[..., 1] * (1.0 - petal_center) + 205 * petal_center
    albedo[..., 2] = albedo[..., 2] * (1.0 - petal_center) + 92 * petal_center
    albedo = np.clip(albedo, 0, 255).astype(np.uint8)

    h = np.clip(0.45 * foliage + 0.42 * petal_zone + 0.13 * petal_center, 0.0, 1.0)
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    emissive[..., 0] = np.clip(petal_center * 48, 0, 255).astype(np.uint8)
    emissive[..., 1] = np.clip(petal_center * 36, 0, 255).astype(np.uint8)
    emissive[..., 2] = np.clip(petal_center * 14, 0, 255).astype(np.uint8)

    normal = height_to_normal(h, strength=4.2)
    return albedo, normal, emissive


# ---------------------------------------------------------------------------
# Sprites, Edificios, Casco metálico y Asfalto
# ---------------------------------------------------------------------------

def gen_flow() -> np.ndarray:
    """256x64 RGBA: 4 chevrones '>' blancos sobre alfa apuntando a +x, tileable en x."""
    w, h = 256, 64
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # Coordenada local dentro de cada periodo de 64 px
    lx = (xx % 64.0) - 32.0
    ly = np.abs(yy - (h - 1) * 0.5)

    # Forma de chevrón '>' apuntando hacia +x
    # El vértice está en lx = +12 en el centro (ly=0), y se abre hacia -x al subir ly
    tip_x = 12.0 - ly * 0.72
    dist = np.abs(lx - tip_x)
    # Limitar altura del chevrón para margen limpio arriba/abajo
    v_mask = smoothstep(26.0, 22.0, ly)
    chevron = smoothstep(6.2, 2.8, dist) * v_mask

    # Estela suave detrás del chevrón
    trail = smoothstep(14.0, 2.0, np.maximum(tip_x - lx, 0.0)) * (lx <= tip_x).astype(np.float32) * v_mask * 0.35
    alpha = np.clip(np.maximum(chevron, trail), 0.0, 1.0)

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 255
    rgba[..., 2] = 255
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return rgba


def gen_sparkle() -> np.ndarray:
    """64x64 RGBA: destello estelar de 4 puntas suave con alfa."""
    s = 64
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    cx = (xx - (s - 1) * 0.5) / (s * 0.5)
    cy = (yy - (s - 1) * 0.5) / (s * 0.5)
    r = np.hypot(cx, cy)

    core = np.exp(-10.0 * r * r)
    ray_h = np.exp(-26.0 * cy * cy) * np.exp(-3.2 * np.abs(cx))
    ray_v = np.exp(-26.0 * cx * cx) * np.exp(-3.2 * np.abs(cy))
    falloff = smoothstep(1.0, 0.65, r)
    alpha = np.clip((core + 0.85 * np.maximum(ray_h, ray_v)) * falloff, 0.0, 1.0)

    rgba = np.zeros((s, s, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 255
    rgba[..., 2] = 255
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return rgba


def gen_building() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Fachada de ciudad 512x512 con ventanas, marcos y ventanas encendidas dispersas."""
    cols, rows = 8, 8
    cw, rh = SIZE // cols, SIZE // rows
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    lx = xx % cw
    ly = yy % rh
    ix = (xx // cw).astype(np.int32)
    iy = (yy // rh).astype(np.int32)

    # Ventana centrada en cada módulo
    margin_x, margin_y = 11.0, 9.0
    in_win = (lx >= margin_x) & (lx < cw - margin_x) & (ly >= margin_y) & (ly < rh - margin_y)
    # Pequeño parteluz vertical en el centro de cada ventana
    mullion = in_win & (np.abs(lx - cw * 0.5) < 1.6)
    glass = in_win & (~mullion)

    concrete_noise = periodic_fbm(SIZE, 16, 4, seed=1101)
    h = np.full((SIZE, SIZE), 0.72, dtype=np.float32) + (concrete_noise - 0.5) * 0.12
    # Líneas de entrepiso y junta vertical
    seam_h = smoothstep(3.0, 0.5, np.minimum(ly, rh - ly))
    seam_v = smoothstep(2.2, 0.5, np.minimum(lx, cw - lx))
    h -= 0.14 * np.maximum(seam_h, seam_v)
    h = np.where(glass, 0.18, h)
    h = np.where(mullion, 0.52, h)

    albedo = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    # Hormigón/metal de fachada
    albedo[..., 0] = 56 + concrete_noise * 24 - seam_h * 16
    albedo[..., 1] = 62 + concrete_noise * 24 - seam_h * 16
    albedo[..., 2] = 74 + concrete_noise * 28 - seam_h * 14

    # Cristales apagados con gradiente sutil de reflejo
    grad_y = (ly - margin_y) / max(rh - 2 * margin_y, 1.0)
    glass_r = 22 + grad_y * 16
    glass_g = 34 + grad_y * 22
    glass_b = 50 + grad_y * 28

    rng = np.random.default_rng(1102)
    lit_prob = rng.random((rows, cols), dtype=np.float32)
    lit_warm = (lit_prob > 0.68) & (lit_prob <= 0.88)
    lit_blue = lit_prob > 0.88
    lit_intensity = rng.uniform(0.65, 1.0, (rows, cols)).astype(np.float32)

    is_warm = lit_warm[iy, ix] & glass
    is_blue = lit_blue[iy, ix] & glass
    bright = lit_intensity[iy, ix] * (0.8 + 0.2 * (1.0 - grad_y))

    albedo[..., 0] = np.where(glass, glass_r, albedo[..., 0])
    albedo[..., 1] = np.where(glass, glass_g, albedo[..., 1])
    albedo[..., 2] = np.where(glass, glass_b, albedo[..., 2])

    albedo[..., 0] = np.where(is_warm, 245 * bright, albedo[..., 0])
    albedo[..., 1] = np.where(is_warm, 185 * bright, albedo[..., 1])
    albedo[..., 2] = np.where(is_warm, 98 * bright, albedo[..., 2])

    albedo[..., 0] = np.where(is_blue, 118 * bright, albedo[..., 0])
    albedo[..., 1] = np.where(is_blue, 198 * bright, albedo[..., 1])
    albedo[..., 2] = np.where(is_blue, 248 * bright, albedo[..., 2])

    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    emissive[..., 0] = np.where(is_warm, 205 * bright, np.where(is_blue, 65 * bright, 0.0))
    emissive[..., 1] = np.where(is_warm, 145 * bright, np.where(is_blue, 145 * bright, 0.0))
    emissive[..., 2] = np.where(is_warm, 62 * bright, np.where(is_blue, 205 * bright, 0.0))

    normal = height_to_normal(np.clip(h, 0.0, 1.0), strength=5.0)
    return (
        np.clip(albedo, 0, 255).astype(np.uint8),
        normal,
        np.clip(emissive, 0, 255).astype(np.uint8),
    )


def gen_hull_normal() -> np.ndarray:
    """Casco metálico 512x512 con paneles biselados y remaches."""
    panels = 4
    pw = SIZE // panels
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    lx = xx % pw
    ly = yy % pw

    # Juntas de paneles principales y sub-junta central
    edge_x = np.minimum(lx, pw - lx)
    edge_y = np.minimum(ly, pw - ly)
    seam = smoothstep(3.5, 0.8, np.minimum(edge_x, edge_y))
    sub_seam = smoothstep(2.2, 0.6, np.abs(lx - pw * 0.5)) * 0.6

    # Remaches en las 4 esquinas de cada panel (offset 12px desde la junta)
    rivet_offsets = [12.0, pw - 12.0]
    rivet = np.zeros((SIZE, SIZE), dtype=np.float32)
    for rx in rivet_offsets:
        for ry in rivet_offsets:
            d = np.hypot(lx - rx, ly - ry)
            rivet = np.maximum(rivet, smoothstep(4.2, 1.6, d))

    brushed = periodic_fbm(SIZE, 32, 3, seed=1201) * 0.04
    h = np.clip(0.6 - 0.35 * np.maximum(seam, sub_seam) + 0.28 * rivet + brushed, 0.0, 1.0)
    return height_to_normal(h, strength=6.0)


def gen_asphalt() -> tuple[np.ndarray, np.ndarray]:
    """Asfalto 512x512 con grano mineral multi-escala y grietas."""
    wx = periodic_fbm(SIZE, 6, 3, seed=1301) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 6, 3, seed=1302) * 2.0 - 1.0

    macro = periodic_fbm(SIZE, 6, 4, seed=1303)
    grain_med = periodic_fbm(SIZE, 32, 3, seed=1304)
    grain_fine = periodic_value_noise(SIZE, 128, seed=1305)

    f1, f2, _, _ = periodic_voronoi(SIZE, 6, seed=1306)
    crack = smoothstep(0.045, 0.006, warp_field(f2 - f1, wx, wy, 14.0))

    h = np.clip(0.28 * macro + 0.37 * grain_med + 0.35 * grain_fine - 0.45 * crack, 0.0, 1.0)
    albedo = color_ramp(
        h,
        [
            (0.0, (20, 22, 26)),
            (0.35, (38, 41, 46)),
            (0.75, (54, 58, 64)),
            (1.0, (74, 78, 86)),
        ],
    ).astype(np.uint8)
    normal = height_to_normal(h, strength=5.0)
    return albedo, normal


# ---------------------------------------------------------------------------
# Verificación de tiling (mosaico 2x2)
# ---------------------------------------------------------------------------

def make_2x2_preview(path: Path, tile_x: bool = True, tile_y: bool = True) -> None:
    """Genera mosaico 2x2 (o 2x1 si solo tilea en x) en PREVIEW_DIR."""
    img = Image.open(path)
    w, h = img.size
    nx = 2 if tile_x else 1
    ny = 2 if tile_y else 1
    canvas = Image.new(img.mode, (w * nx, h * ny))
    for iy in range(ny):
        for ix in range(nx):
            canvas.paste(img, (ix * w, iy * h))
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(PREVIEW_DIR / f"tile2x2_{path.name}", format="PNG", optimize=True)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    themes = {
        "sombrio": gen_sombrio,
        "bosque": gen_bosque,
        "mar": gen_mar,
        "desierto": gen_desierto,
        "hielo": gen_hielo,
        "volcan": gen_volcan,
        "cristal": gen_cristal,
        "nubes": gen_nubes,
        "neon": gen_neon,
        "jardin": gen_jardin,
    }

    report: list[tuple[str, int]] = []
    for name, fn in themes.items():
        albedo, normal, emissive = fn()
        for suffix, arr in (("albedo", albedo), ("normal", normal), ("emissive", emissive)):
            out_path = OUT_DIR / f"{name}_{suffix}.png"
            b = save_png_optimized(arr, out_path, mode="RGB")
            report.append((out_path.name, b))

    # Sprites
    flow_path = OUT_DIR / "flow.png"
    report.append((flow_path.name, save_png_optimized(gen_flow(), flow_path, mode="RGBA")))

    sparkle_path = OUT_DIR / "sparkle.png"
    report.append((sparkle_path.name, save_png_optimized(gen_sparkle(), sparkle_path, mode="RGBA")))

    # Edificios
    b_alb, b_nrm, b_emi = gen_building()
    for fname, arr in (
        ("building_albedo.png", b_alb),
        ("building_normal.png", b_nrm),
        ("building_emissive.png", b_emi),
    ):
        p = OUT_DIR / fname
        report.append((fname, save_png_optimized(arr, p, mode="RGB")))

    # Casco metálico
    hull_path = OUT_DIR / "hull_normal.png"
    report.append((hull_path.name, save_png_optimized(gen_hull_normal(), hull_path, mode="RGB")))

    # Asfalto
    a_alb, a_nrm = gen_asphalt()
    for fname, arr in (("asphalt.png", a_alb), ("asphalt_normal.png", a_nrm)):
        p = OUT_DIR / fname
        report.append((fname, save_png_optimized(arr, p, mode="RGB")))

    # Previews 2x2 de verificación de costuras
    preview_targets = [
        ("sombrio_albedo.png", True, True),
        ("bosque_albedo.png", True, True),
        ("mar_albedo.png", True, True),
        ("desierto_albedo.png", True, True),
        ("hielo_albedo.png", True, True),
        ("volcan_albedo.png", True, True),
        ("volcan_emissive.png", True, True),
        ("cristal_normal.png", True, True),
        ("nubes_albedo.png", True, True),
        ("neon_albedo.png", True, True),
        ("neon_emissive.png", True, True),
        ("jardin_albedo.png", True, True),
        ("building_albedo.png", True, True),
        ("building_emissive.png", True, True),
        ("hull_normal.png", True, True),
        ("asphalt.png", True, True),
        ("flow.png", True, False),
    ]
    for fname, tx, ty in preview_targets:
        make_2x2_preview(OUT_DIR / fname, tile_x=tx, tile_y=ty)

    total_kb = sum(b for _, b in report) / 1024.0
    max_b = max(b for _, b in report)
    print(f"Generados {len(report)} archivos en {OUT_DIR} (total {total_kb:.1f} KB, máx {max_b / 1024.0:.1f} KB)")
    for fname, b in report:
        print(f"  {fname:24s} {b / 1024.0:6.1f} KB")


if __name__ == "__main__":
    main()
