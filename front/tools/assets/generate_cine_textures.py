#!/usr/bin/env python3
"""Generador de texturas sci-fi cinematográficas y paneles por tema para Ballitas.

Genera en ``front/public/tex/``:
  - panel_albedo.png, panel_normal.png, panel_emissive.png (512x512 tileables)
  - chevrones_rainbow.png (256x64 tileable en X)
  - lightbar.png (128x16 RGBA)
  - streak.png (128x16 RGBA)
  - spark.png (32x32 RGBA)
  - constellation.png (512x512 RGBA tileable)
  - <id>_panel.png para los 10 temas (512x512 tileables)

Y mosaicos 2x2 de verificación en ``front/tools/assets/preview/``.
Todos los archivos se optimizan por debajo de 350 KB.
"""

from __future__ import annotations

import math
from pathlib import Path
import numpy as np
from PIL import Image

from generate_textures import (
    OUT_DIR,
    PREVIEW_DIR,
    SIZE,
    color_ramp,
    height_to_normal,
    make_2x2_preview,
    periodic_fbm,
    periodic_value_noise,
    periodic_voronoi,
    smoothstep,
    warp_field,
)

MAX_BYTES = 345 * 1024  # < 350 KB garantizado


def save_png_under_limit(arr: np.ndarray, path: Path, mode: str = "RGB") -> int:
    """Guarda PNG optimizado y garantiza peso < 350 KB."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(arr, mode=mode)
    img.save(path, format="PNG", optimize=True, compress_level=9)
    size_bytes = path.stat().st_size
    if size_bytes > MAX_BYTES:
        q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE if mode == "RGBA" else Image.Quantize.MEDIANCUT)
        q.save(path, format="PNG", optimize=True, compress_level=9)
        size_bytes = path.stat().st_size
    if size_bytes > MAX_BYTES:
        raise RuntimeError(f"{path.name} excede {MAX_BYTES} bytes ({size_bytes})")
    return size_bytes


# ---------------------------------------------------------------------------
# Helpers geométricos periódicos
# ---------------------------------------------------------------------------

def _rect_sdf_periodic(xx: np.ndarray, yy: np.ndarray, cx: float, cy: float, hw: float, hh: float, r: float = 0.0, size: int = SIZE) -> np.ndarray:
    """SDF de rectángulo redondeado en toro [0, size)^2."""
    dx = np.abs(((xx - cx + size * 0.5) % size) - size * 0.5) - (hw - r)
    dy = np.abs(((yy - cy + size * 0.5) % size) - size * 0.5) - (hh - r)
    qx = np.maximum(dx, 0.0)
    qy = np.maximum(dy, 0.0)
    return np.hypot(qx, qy) + np.minimum(np.maximum(dx, dy), 0.0) - r


def _panel_grid_masks(size: int = SIZE) -> dict[str, np.ndarray]:
    """Máscaras base periódicas de paneles metálicos modulares 2x2 con subdivisiones."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    half = size * 0.5

    # Juntas principales cada 256 px
    dist_main_x = np.minimum(xx % half, half - (xx % half))
    dist_main_y = np.minimum(yy % half, half - (yy % half))
    dist_main = np.minimum(dist_main_x, dist_main_y)

    # Sub-junta horizontal interna en y = 128, 384 y vertical parcial
    dist_sub_y = np.abs(((yy - 128.0) % half) - 0.0)
    dist_sub_y = np.minimum(dist_sub_y, half - dist_sub_y)
    # En la mitad izquierda/derecha alternada: junta vertical interna en x=128 o x=384
    in_top_band = (yy % half) < 128.0
    dist_sub_x = np.abs((xx % half) - 128.0)
    dist_sub = np.where(in_top_band, np.minimum(dist_sub_y, dist_sub_x), dist_sub_y)

    seam_main = smoothstep(3.8, 1.1, dist_main)
    seam_sub = smoothstep(2.4, 0.8, dist_sub) * (1.0 - seam_main)
    seam_all = np.maximum(seam_main, seam_sub * 0.78)

    # Bisel suave alrededor de juntas principales y secundarias
    bevel_main = smoothstep(10.0, 3.2, dist_main) * (1.0 - seam_main)
    bevel_sub = smoothstep(6.5, 2.2, dist_sub) * (1.0 - seam_all)
    bevel = np.maximum(bevel_main, bevel_sub * 0.65)

    # Remaches en las esquinas de cada cuadrante de 256x256 y puntos medios
    lx = xx % half
    ly = yy % half
    rivet = np.zeros((size, size), dtype=np.float32)
    rivet_pts = [
        (16.0, 16.0), (half - 16.0, 16.0),
        (16.0, half - 16.0), (half - 16.0, half - 16.0),
        (114.0, 16.0), (142.0, 16.0),
        (16.0, 114.0), (half - 16.0, 114.0),
        (16.0, 142.0), (half - 16.0, 142.0),
        (128.0, half - 16.0),
    ]
    for rx, ry in rivet_pts:
        d = np.hypot(lx - rx, ly - ry)
        rivet = np.maximum(rivet, smoothstep(4.0, 1.4, d))

    # ID tonal por sub-panel para variación sutil de tono metálico
    qx = np.floor(xx / half).astype(np.int32)
    qy = np.floor(yy / half).astype(np.int32)
    sub_x = np.where(in_top_band, (lx >= 128.0).astype(np.int32), 0)
    sub_y = (ly >= 128.0).astype(np.int32)
    panel_hash = (((qx * 7 + qy * 13 + sub_x * 3 + sub_y * 5) % 11) / 10.0).astype(np.float32)

    return {
        "xx": xx,
        "yy": yy,
        "seam_main": seam_main,
        "seam_sub": seam_sub,
        "seam_all": seam_all,
        "bevel": bevel,
        "rivet": rivet,
        "panel_hash": panel_hash,
    }


# ---------------------------------------------------------------------------
# 1. Paneles sci-fi cinematográficos (albedo, normal, emissive)
# ---------------------------------------------------------------------------

def gen_cine_panels() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Genera panel_albedo, panel_normal y panel_emissive (512x512 tileables)."""
    g = _panel_grid_masks(SIZE)
    xx, yy = g["xx"], g["yy"]

    # Ventanitas de cristal en dos cuadrantes opuestos (para variedad en mosaico)
    win_centers = [(64.0, 64.0), (320.0, 320.0), (448.0, 64.0), (192.0, 320.0)]
    win_sdf = np.full((SIZE, SIZE), 1e6, dtype=np.float32)
    for cx, cy in win_centers:
        d = _rect_sdf_periodic(xx, yy, cx, cy, 34.0, 22.0, r=5.0)
        win_sdf = np.minimum(win_sdf, d)

    win_glass = smoothstep(0.5, -1.0, win_sdf)
    win_frame = smoothstep(6.0, 1.5, np.abs(win_sdf - 2.0)) * (1.0 - win_glass)
    win_edge_glow = smoothstep(3.0, 0.2, np.abs(win_sdf))

    # Barras de luz naranja empotradas (en la banda inferior de cada panel 256x256)
    bar_centers = [(128.0, 192.0), (384.0, 448.0), (384.0, 192.0), (128.0, 448.0)]
    bar_sdf = np.full((SIZE, SIZE), 1e6, dtype=np.float32)
    for cx, cy in bar_centers:
        d = _rect_sdf_periodic(xx, yy, cx, cy, 68.0, 7.5, r=3.5)
        bar_sdf = np.minimum(bar_sdf, d)

    bar_core = smoothstep(0.0, -2.5, bar_sdf)
    bar_housing = smoothstep(6.5, 1.2, np.abs(bar_sdf - 2.5)) * (1.0 - bar_core)
    bar_halo = np.exp(-np.maximum(bar_sdf, 0.0) / 7.5) * smoothstep(22.0, 0.0, bar_sdf)

    # Micro-textura de metal cepillado direccional (horizontal + vertical suave)
    brush_h = periodic_value_noise(SIZE, 128, seed=2001) * 0.5 + periodic_value_noise(SIZE, 64, seed=2002) * 0.5
    brush_macro = periodic_fbm(SIZE, 8, 3, seed=2003)

    # Heightmap unificado
    h = np.full((SIZE, SIZE), 0.66, dtype=np.float32)
    h += (g["panel_hash"] - 0.5) * 0.03
    h += (brush_h - 0.5) * 0.025 + (brush_macro - 0.5) * 0.03
    h -= g["bevel"] * 0.10
    h -= g["seam_all"] * 0.44
    h += g["rivet"] * 0.22
    h += win_frame * 0.09
    h -= win_glass * 0.18
    h += bar_housing * 0.07
    h -= bar_core * 0.14
    h = np.clip(h, 0.0, 1.0)

    # Albedo: metal claro azulado/plateado como vista_referencia.webp
    base_metal = color_ramp(
        np.clip(0.55 + (g["panel_hash"] - 0.5) * 0.22 + (brush_macro - 0.5) * 0.16 + (brush_h - 0.5) * 0.08, 0.0, 1.0),
        [
            (0.0, (124, 144, 170)),
            (0.45, (158, 178, 204)),
            (0.80, (188, 206, 228)),
            (1.0, (210, 224, 240)),
        ],
    )
    albedo = base_metal.copy()

    # Sombrear biseles y juntas
    albedo *= (1.0 - g["bevel"][..., None] * 0.26)
    seam_col = np.array([26, 36, 52], dtype=np.float32)
    albedo = albedo * (1.0 - g["seam_all"][..., None]) + seam_col * g["seam_all"][..., None]

    # Remaches más claros y definidos
    rivet_col = np.array([218, 230, 244], dtype=np.float32)
    albedo = albedo * (1.0 - g["rivet"][..., None] * 0.75) + rivet_col * (g["rivet"][..., None] * 0.75)

    # Marcos de ventana y carcasa de barras de luz en metal oscuro azulado
    dark_trim = np.array([46, 58, 76], dtype=np.float32)
    trim_mask = np.maximum(win_frame, bar_housing)
    albedo = albedo * (1.0 - trim_mask[..., None] * 0.85) + dark_trim * (trim_mask[..., None] * 0.85)

    # Cristal de ventanitas con reflejo diagonal sci-fi
    diag = np.sin((xx + yy) * (2.0 * math.pi / 128.0)) * 0.5 + 0.5
    glass_col = color_ramp(
        np.clip(0.35 + diag * 0.45 + (brush_macro - 0.5) * 0.2, 0.0, 1.0),
        [
            (0.0, (14, 34, 62)),
            (0.55, (28, 72, 118)),
            (0.85, (64, 134, 188)),
            (1.0, (130, 198, 235)),
        ],
    )
    albedo = albedo * (1.0 - win_glass[..., None]) + glass_col * win_glass[..., None]

    # Tinte cálido apagado en la barra de luz apagada (base albedo)
    bar_off_col = np.array([92, 46, 22], dtype=np.float32)
    albedo = albedo * (1.0 - bar_core[..., None]) + bar_off_col * bar_core[..., None]
    albedo_u8 = np.clip(albedo, 0, 255).astype(np.uint8)

    # Normal map
    normal_u8 = height_to_normal(h, strength=5.5)

    # Emissive: barras de luz naranja con BRILLO BAJO + sutil neón azul en marcos de ventana
    emissive = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    # Núcleo naranja suave (máx ~145, 68, 16) + halo tenue
    emissive[..., 0] += bar_core * 145.0 + bar_halo * 42.0
    emissive[..., 1] += bar_core * 68.0 + bar_halo * 16.0
    emissive[..., 2] += bar_core * 16.0 + bar_halo * 4.0
    # Sutil línea azul neón en el borde de las ventanitas (muy bajo)
    emissive[..., 0] += win_edge_glow * 12.0
    emissive[..., 1] += win_edge_glow * 52.0
    emissive[..., 2] += win_edge_glow * 88.0
    emissive_u8 = np.clip(emissive, 0, 255).astype(np.uint8)

    return albedo_u8, normal_u8, emissive_u8


# ---------------------------------------------------------------------------
# 2. Chevrones arcoíris (256x64, tileable en X)
# ---------------------------------------------------------------------------

def gen_chevrones_rainbow() -> np.ndarray:
    """256x64 tileable en X: baldosas con chevrones '>' en degradado arcoíris sobre gris oscuro."""
    W, H = 256, 64
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # 4 baldosas de 64x64 a lo largo de X
    tile_w = 64.0
    lx = (xx % tile_w) / tile_w  # [0, 1)
    ly = (yy / H) - 0.5          # [-0.5, 0.5)

    # Base de baldosa gris oscuro azulado con bisel y juntas entre baldosas
    dist_tile_x = np.minimum(xx % tile_w, tile_w - (xx % tile_w))
    dist_tile_y = np.minimum(yy, H - 1.0 - yy)
    seam = np.maximum(smoothstep(2.2, 0.6, dist_tile_x), smoothstep(2.4, 0.7, dist_tile_y))
    grain = periodic_value_noise(H, 16, seed=2101)
    grain_tile = np.tile(grain, (1, W // H))

    bg = color_ramp(
        np.clip(0.45 + (grain_tile - 0.5) * 0.25 - seam * 0.4, 0.0, 1.0),
        [
            (0.0, (16, 20, 28)),
            (0.4, (32, 38, 50)),
            (1.0, (48, 56, 72)),
        ],
    )

    # Rieles laterales finos arriba/abajo con acento ámbar tenue
    rail = smoothstep(4.5, 2.5, dist_tile_y) * (1.0 - smoothstep(2.0, 0.5, dist_tile_y))
    bg = bg * (1.0 - rail[..., None] * 0.35) + np.array([120, 75, 40], dtype=np.float32) * (rail[..., None] * 0.35)

    # 3 chevrones '>' anidados apuntando a +X
    # Coordenada de chevrón: u = lx - 0.65 * (0.5 - |ly|) -> apunta hacia +X
    # Para que la punta esté hacia +X: x_tip - k * |ly|
    u = lx + 0.52 * np.abs(ly)  # líneas constantes forman '>' apuntando a +X!
    # Verifiquemos: en ly=0, u = lx. En |ly|=0.35, u = lx + 0.182.
    # Entonces para u = const, en |ly|=0.35 lx es MENOR, y en ly=0 lx es MAYOR -> punta en +X!

    chev_mask = np.zeros((H, W), dtype=np.float32)
    chev_glow = np.zeros((H, W), dtype=np.float32)
    y_bound = smoothstep(0.39, 0.32, np.abs(ly))

    # 3 bandas de chevrón en cada baldosa
    centers_u = [0.34, 0.56, 0.78]
    half_thick = 0.068
    for cu in centers_u:
        d = np.abs(u - cu)
        m = smoothstep(half_thick + 0.025, half_thick - 0.015, d) * y_bound
        g_m = np.exp(-((d / 0.10) ** 2)) * y_bound
        chev_mask = np.maximum(chev_mask, m)
        chev_glow = np.maximum(chev_glow, g_m)

    # Degradado arcoíris a lo largo de u y ly (cian -> azul -> magenta -> naranja -> amarillo)
    rainbow_t = np.clip((u - 0.24) / 0.62, 0.0, 1.0)
    rainbow_col = color_ramp(
        rainbow_t,
        [
            (0.00, (40, 235, 255)),   # cian
            (0.28, (65, 135, 255)),   # azul eléctrico
            (0.55, (230, 70, 235)),   # magenta
            (0.80, (255, 115, 45)),   # naranja
            (1.00, (255, 225, 70)),   # amarillo dorado
        ],
    )

    out = bg + rainbow_col * (chev_glow[..., None] * 0.28)
    out = out * (1.0 - chev_mask[..., None]) + rainbow_col * chev_mask[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# 3. Sprites FX con alfa: lightbar, streak, spark
# ---------------------------------------------------------------------------

def gen_lightbar() -> np.ndarray:
    """128x16 RGBA: barra de luz horizontal con núcleo blanco y halo suave."""
    W, H = 128, 16
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # Coordenadas normalizadas centradas
    dx = np.abs(xx - (W - 1) * 0.5)
    dy = np.abs(yy - (H - 1) * 0.5)

    # Cápsula central
    qx = np.maximum(dx - 46.0, 0.0)
    qy = np.maximum(dy - 1.2, 0.0)
    dist = np.hypot(qx / 14.0, qy / 4.2)

    core = smoothstep(0.45, 0.12, dist)
    halo = np.exp(-dist * dist * 2.2)
    # Fade estricto a 0 en los bordes para evitar cortes
    edge_fade = smoothstep(0.0, 6.0, xx) * smoothstep(W - 1.0, W - 7.0, xx)
    edge_fade *= smoothstep(0.0, 2.5, yy) * smoothstep(H - 1.0, H - 3.5, yy)

    alpha = np.clip(np.maximum(core, halo * 0.85) * edge_fade, 0.0, 1.0)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 255
    rgba[..., 2] = 255
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return rgba


def gen_streak() -> np.ndarray:
    """128x16 RGBA: estela de viento azul con filamentos y degradado a alfa."""
    W, H = 128, 16
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = xx / (W - 1.0)
    v = (yy / (H - 1.0)) * 2.0 - 1.0  # [-1, 1]

    # Filamentos longitudinales suaves
    fil1 = np.sin(v * 7.0 + np.sin(u * math.pi * 3.0) * 0.7) * 0.5 + 0.5
    fil2 = np.sin(v * 13.0 - u * math.pi * 4.0) * 0.5 + 0.5
    filaments = 0.45 + 0.35 * fil1 + 0.20 * fil2

    # Perfil longitudinal: más brillante hacia x ~ 0.72, cola larga a la izquierda
    long_env = (u ** 0.75) * smoothstep(1.0, 0.78, u) * smoothstep(0.0, 0.14, u)
    # Perfil transversal gaussiano
    lat_env = np.exp(-(v * v) * 3.2) * smoothstep(1.0, 0.75, np.abs(v))

    intensity = np.clip(long_env * lat_env * filaments * 1.45, 0.0, 1.0)
    col = color_ramp(
        intensity,
        [
            (0.0, (25, 110, 220)),
            (0.45, (75, 185, 255)),
            (0.85, (165, 232, 255)),
            (1.0, (235, 250, 255)),
        ],
    )
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(intensity * 255.0, 0, 255).astype(np.uint8)
    return rgba


def gen_spark() -> np.ndarray:
    """32x32 RGBA: chispa naranja brillante con núcleo cálido y alfa."""
    S = 32
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    dx = (xx - (S - 1) * 0.5) / ((S - 1) * 0.5)
    dy = (yy - (S - 1) * 0.5) / ((S - 1) * 0.5)

    # Ligera elongación horizontal + destello en cruz muy sutil
    r = np.hypot(dx * 0.9, dy * 1.25)
    core = np.exp(-(r * r) * 14.0)
    halo = np.exp(-(r * r) * 3.8) * smoothstep(0.95, 0.35, r)
    flare = np.exp(-np.abs(dy) * 9.0) * np.exp(-np.abs(dx) * 3.2) * 0.35

    alpha = np.clip(core + halo * 0.75 + flare, 0.0, 1.0) * smoothstep(0.98, 0.65, r)
    col = color_ramp(
        np.clip(core * 0.85 + halo * 0.35, 0.0, 1.0),
        [
            (0.0, (255, 85, 10)),
            (0.45, (255, 145, 30)),
            (0.80, (255, 210, 95)),
            (1.0, (255, 250, 220)),
        ],
    )
    rgba = np.zeros((S, S, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return rgba


# ---------------------------------------------------------------------------
# 4. Constellation (512x512 RGBA tileable)
# ---------------------------------------------------------------------------

def gen_constellation() -> np.ndarray:
    """512x512 RGBA tileable: malla de puntos conectados por líneas finas azules con alfa."""
    S = SIZE
    rng = np.random.default_rng(3301)

    # Grilla 7x7 con jitter para distribución uniforme en toro
    cells = 7
    cell_sz = S / cells
    pts = []
    for cy in range(cells):
        for cx in range(cells):
            px = (cx + 0.18 + rng.random() * 0.64) * cell_sz
            py = (cy + 0.18 + rng.random() * 0.64) * cell_sz
            pts.append((px, py))
    pts_arr = np.array(pts, dtype=np.float32)
    n = len(pts_arr)

    # Conectar cada nodo con sus 3 vecinos más cercanos en el toro (dist < 135 px)
    edges: set[tuple[int, int, int, int]] = set()
    for i in range(n):
        dists = []
        xi, yi = pts_arr[i]
        for j in range(n):
            if i == j:
                continue
            xj, yj = pts_arr[j]
            # Vector mínimo en toro
            dx = ((xj - xi + S * 0.5) % S) - S * 0.5
            dy = ((yj - yi + S * 0.5) % S) - S * 0.5
            d = math.hypot(dx, dy)
            if d < 138.0:
                dists.append((d, j, dx, dy))
        dists.sort(key=lambda t: t[0])
        for _, j, _, _ in dists[:3]:
            a, b = (i, j) if i < j else (j, i)
            edges.add((a, b, 0, 0))

    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    line_field = np.zeros((S, S), dtype=np.float32)

    # Rasterizar líneas en el toro con distancia exacta a segmento
    for a, b, _, _ in edges:
        x0, y0 = pts_arr[a]
        x1, y1 = pts_arr[b]
        dx = ((x1 - x0 + S * 0.5) % S) - S * 0.5
        dy = ((y1 - y0 + S * 0.5) % S) - S * 0.5
        seg_len2 = dx * dx + dy * dy
        if seg_len2 < 1e-4:
            continue

        # Evaluar sobre las 9 copias periódicas relevantes cercanas al segmento
        for ox in (-S, 0.0, S):
            for oy in (-S, 0.0, S):
                sx0 = x0 + ox
                sy0 = y0 + oy
                sx1 = sx0 + dx
                sy1 = sy0 + dy
                # Bounding box rápido para no calcular en toda la imagen
                minx = max(0, int(min(sx0, sx1) - 6))
                maxx = min(S, int(max(sx0, sx1) + 7))
                miny = max(0, int(min(sy0, sy1) - 6))
                maxy = min(S, int(max(sy0, sy1) + 7))
                if minx >= maxx or miny >= maxy:
                    continue
                sub_x = xx[miny:maxy, minx:maxx]
                sub_y = yy[miny:maxy, minx:maxx]
                t = np.clip(((sub_x - sx0) * dx + (sub_y - sy0) * dy) / seg_len2, 0.0, 1.0)
                px = sx0 + t * dx
                py = sy0 + t * dy
                d = np.hypot(sub_x - px, sub_y - py)
                val = smoothstep(1.8, 0.35, d) * 0.65 + np.exp(-(d * d) / 5.0) * 0.25
                line_field[miny:maxy, minx:maxx] = np.maximum(line_field[miny:maxy, minx:maxx], val)

    # Rasterizar nodos en el toro
    node_core = np.zeros((S, S), dtype=np.float32)
    node_halo = np.zeros((S, S), dtype=np.float32)
    for idx, (nx_p, ny_p) in enumerate(pts_arr):
        rad = 2.6 + (idx % 3) * 0.7
        dx = ((xx - nx_p + S * 0.5) % S) - S * 0.5
        dy = ((yy - ny_p + S * 0.5) % S) - S * 0.5
        d = np.hypot(dx, dy)
        node_core = np.maximum(node_core, smoothstep(rad + 0.8, rad * 0.35, d))
        node_halo = np.maximum(node_halo, np.exp(-(d * d) / (rad * rad * 4.5)) * 0.65)

    alpha = np.clip(np.maximum(line_field * 0.55, np.maximum(node_core, node_halo)), 0.0, 1.0)
    col = np.zeros((S, S, 3), dtype=np.float32)
    # Líneas y halo en azul-cian
    col[..., 0] = 55.0 + node_core * 155.0
    col[..., 1] = 175.0 + node_core * 75.0
    col[..., 2] = 255.0

    rgba = np.zeros((S, S, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return rgba


# ---------------------------------------------------------------------------
# 5. Paneles por tema (<id>_panel.png, 512x512 tileables)
# ---------------------------------------------------------------------------

def _apply_panel_relief(
    base_rgb: np.ndarray,
    g: dict[str, np.ndarray],
    seam_rgb: tuple[int, int, int],
    rivet_rgb: tuple[int, int, int],
    bevel_dark: float = 0.28,
) -> np.ndarray:
    """Compone juntas, biseles, variación tonal y remaches sobre un material base."""
    out = base_rgb.astype(np.float32).copy()
    out *= (0.94 + g["panel_hash"][..., None] * 0.12)
    out *= (1.0 - g["bevel"][..., None] * bevel_dark)
    seam_arr = np.array(seam_rgb, dtype=np.float32)
    riv_arr = np.array(rivet_rgb, dtype=np.float32)
    out = out * (1.0 - g["seam_all"][..., None]) + seam_arr * g["seam_all"][..., None]
    out = out * (1.0 - g["rivet"][..., None] * 0.78) + riv_arr * (g["rivet"][..., None] * 0.78)
    return np.clip(out, 0, 255).astype(np.uint8)


def gen_theme_panels() -> dict[str, np.ndarray]:
    """Genera los 10 <id>_panel.png (512x512 tileables) propios de cada ambiente."""
    g = _panel_grid_masks(SIZE)
    xx, yy = g["xx"], g["yy"]
    wx = periodic_fbm(SIZE, 4, 3, seed=4001) * 2.0 - 1.0
    wy = periodic_fbm(SIZE, 4, 3, seed=4002) * 2.0 - 1.0

    panels: dict[str, np.ndarray] = {}

    # 1. sombrio: acero obsidiana oscuro con vetas violeta-índigo
    n_som = warp_field(periodic_fbm(SIZE, 6, 4, seed=4101), wx, wy, 18.0)
    base_som = color_ramp(n_som, [(0.0, (20, 14, 34)), (0.5, (38, 28, 62)), (1.0, (66, 50, 96))])
    panels["sombrio"] = _apply_panel_relief(base_som, g, (10, 6, 18), (118, 92, 165))

    # 2. bosque: madera cálida con vetas + musgo y lianas verdes en las juntas
    grain_wood = periodic_fbm(SIZE, 8, 4, seed=4201)
    rings = np.sin((yy / SIZE * 14.0 + grain_wood * 4.5) * 2.0 * math.pi) * 0.5 + 0.5
    wood = color_ramp(np.clip(0.45 * grain_wood + 0.55 * rings, 0.0, 1.0), [
        (0.0, (62, 38, 20)), (0.5, (104, 66, 36)), (1.0, (138, 92, 52)),
    ])
    moss_noise = warp_field(periodic_fbm(SIZE, 6, 4, seed=4202), wx, wy, 20.0)
    vine_mask = np.clip(g["bevel"] * 1.15 + smoothstep(0.66, 0.84, moss_noise) * 0.6, 0.0, 1.0)
    moss_col = color_ramp(moss_noise, [(0.0, (32, 74, 28)), (0.6, (56, 118, 42)), (1.0, (98, 162, 58))])
    wood_moss = wood * (1.0 - vine_mask[..., None] * 0.8) + moss_col * (vine_mask[..., None] * 0.8)
    panels["bosque"] = _apply_panel_relief(wood_moss, g, (24, 36, 18), (178, 142, 76))

    # 3. mar: paneles aguamarina/nácar con coral rosado y burbujas perladas
    n_mar = warp_field(periodic_fbm(SIZE, 5, 4, seed=4301), wx, wy, 22.0)
    aqua = color_ramp(n_mar, [(0.0, (18, 78, 108)), (0.5, (38, 128, 156)), (1.0, (92, 184, 204))])
    f1_m, _, _, cr_m = periodic_voronoi(SIZE, 10, seed=4302)
    bubbles = smoothstep(0.24, 0.10, f1_m) * (cr_m > 0.62)
    coral = smoothstep(0.64, 0.82, warp_field(periodic_fbm(SIZE, 8, 3, seed=4303), wx, wy, 14.0))
    aqua = aqua * (1.0 - coral[..., None] * 0.65) + np.array([225, 108, 118], dtype=np.float32) * (coral[..., None] * 0.65)
    aqua = aqua * (1.0 - bubbles[..., None] * 0.75) + np.array([200, 245, 255], dtype=np.float32) * (bubbles[..., None] * 0.75)
    panels["mar"] = _apply_panel_relief(aqua, g, (10, 42, 64), (195, 242, 248))

    # 4. desierto: arenisca tallada ocre/terracota con latón envejecido
    sand_str = periodic_fbm(SIZE, 6, 4, seed=4401)
    strata = np.sin((yy / SIZE * 10.0 + sand_str * 2.2) * 2.0 * math.pi) * 0.5 + 0.5
    sandstone = color_ramp(np.clip(0.55 * sand_str + 0.45 * strata, 0.0, 1.0), [
        (0.0, (132, 82, 46)), (0.5, (184, 126, 72)), (1.0, (224, 174, 112)),
    ])
    panels["desierto"] = _apply_panel_relief(sandstone, g, (78, 46, 24), (218, 176, 86))

    # 5. hielo: hielo azul cristalino con fracturas internas y escarcha en juntas
    f1_h, f2_h, _, cr_h = periodic_voronoi(SIZE, 7, seed=4501)
    ice_base = color_ramp(np.clip(0.45 + cr_h * 0.35 + periodic_fbm(SIZE, 8, 3, seed=4502) * 0.2, 0.0, 1.0), [
        (0.0, (68, 138, 198)), (0.5, (124, 194, 238)), (1.0, (198, 236, 255)),
    ])
    frost_crack = smoothstep(0.05, 0.01, f2_h - f1_h)
    ice_base = ice_base * (1.0 - frost_crack[..., None] * 0.55) + np.array([235, 248, 255], dtype=np.float32) * (frost_crack[..., None] * 0.55)
    panels["hielo"] = _apply_panel_relief(ice_base, g, (38, 86, 138), (225, 246, 255), bevel_dark=0.14)

    # 6. volcan: basalto oscuro con grietas de lava incandescente
    f1_v, f2_v, _, _ = periodic_voronoi(SIZE, 6, seed=4601)
    basalt_n = periodic_fbm(SIZE, 10, 4, seed=4602)
    basalt = color_ramp(basalt_n, [(0.0, (22, 18, 20)), (0.6, (44, 36, 38)), (1.0, (72, 58, 56))])
    lava_crack = smoothstep(0.065, 0.012, warp_field(f2_v - f1_v, wx, wy, 18.0))
    lava_mask = np.clip(np.maximum(lava_crack, g["seam_all"] * 0.72), 0.0, 1.0)
    lava_col = color_ramp(lava_mask, [(0.0, (160, 32, 8)), (0.5, (235, 92, 16)), (1.0, (255, 205, 72))])
    volc = basalt * (1.0 - lava_mask[..., None]) + lava_col * lava_mask[..., None]
    panels["volcan"] = _apply_panel_relief(volc, g, (245, 96, 18), (112, 92, 86))

    # 7. cristal: cuarzo facetado violeta-cian con aristas luminosas
    f1_c, f2_c, _, cr_c = periodic_voronoi(SIZE, 8, seed=4701)
    edge_c = smoothstep(0.06, 0.01, f2_c - f1_c)
    crys = color_ramp(np.clip(cr_c * 0.75 + (1.0 - f1_c) * 0.25, 0.0, 1.0), [
        (0.0, (56, 42, 128)), (0.45, (112, 84, 198)), (0.8, (96, 184, 232)), (1.0, (198, 232, 255)),
    ])
    crys = crys * (1.0 - edge_c[..., None] * 0.5) + np.array([220, 245, 255], dtype=np.float32) * (edge_c[..., None] * 0.5)
    panels["cristal"] = _apply_panel_relief(crys, g, (38, 32, 84), (218, 236, 255), bevel_dark=0.18)

    # 8. nubes: mármol celestial blanco-azulado con filigrana dorada suave
    cloud_n = warp_field(periodic_fbm(SIZE, 4, 4, seed=4801), wx, wy, 26.0)
    nubes = color_ramp(cloud_n, [(0.0, (176, 202, 232)), (0.5, (218, 232, 248)), (1.0, (246, 250, 255))])
    panels["nubes"] = _apply_panel_relief(nubes, g, (124, 152, 192), (232, 202, 134), bevel_dark=0.12)

    # 9. neon: fibra de carbono oscura con juntas neón cian y magenta
    weave = ((np.floor(xx / 4.0) + np.floor(yy / 4.0)) % 2.0) * 0.14
    carbon = color_ramp(np.clip(0.35 + weave + periodic_fbm(SIZE, 8, 2, seed=4901) * 0.25, 0.0, 1.0), [
        (0.0, (14, 16, 26)), (0.5, (26, 30, 46)), (1.0, (44, 52, 76)),
    ])
    neon_line = np.where((xx % 256.0) < 128.0, 1.0, 0.0)
    seam_cyan = np.array([32, 225, 255], dtype=np.float32)
    seam_mag = np.array([255, 58, 210], dtype=np.float32)
    seam_neon = seam_cyan * neon_line[..., None] + seam_mag * (1.0 - neon_line[..., None])
    neon_out = carbon * (1.0 - g["bevel"][..., None] * 0.3)
    neon_out = neon_out * (1.0 - g["seam_all"][..., None]) + seam_neon * g["seam_all"][..., None]
    neon_out = neon_out * (1.0 - g["rivet"][..., None] * 0.85) + seam_cyan * (g["rivet"][..., None] * 0.85)
    panels["neon"] = np.clip(neon_out, 0, 255).astype(np.uint8)

    # 10. jardin: piedra clara botánica con enredaderas verdes y flores pastel
    stone_n = periodic_fbm(SIZE, 8, 4, seed=5001)
    stone = color_ramp(stone_n, [(0.0, (154, 162, 146)), (0.5, (194, 200, 182)), (1.0, (226, 228, 212))])
    ivy_n = warp_field(periodic_fbm(SIZE, 6, 3, seed=5002), wx, wy, 18.0)
    ivy_mask = np.clip(g["bevel"] * 0.95 + smoothstep(0.68, 0.86, ivy_n) * 0.55, 0.0, 1.0)
    ivy_col = color_ramp(ivy_n, [(0.0, (48, 108, 44)), (0.6, (84, 158, 64)), (1.0, (132, 196, 86))])
    jard = stone * (1.0 - ivy_mask[..., None] * 0.78) + ivy_col * (ivy_mask[..., None] * 0.78)
    # Pequeñas flores pastel dispersas
    f1_j, _, _, cr_j = periodic_voronoi(SIZE, 12, seed=5003)
    flower = smoothstep(0.18, 0.06, f1_j) * (cr_j > 0.78) * (ivy_mask > 0.25)
    jard = jard * (1.0 - flower[..., None]) + np.array([250, 168, 205], dtype=np.float32) * flower[..., None]
    panels["jardin"] = _apply_panel_relief(jard, g, (54, 88, 46), (218, 198, 148), bevel_dark=0.16)

    return panels


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    report: list[tuple[str, int]] = []

    # 1. Paneles sci-fi principales
    p_alb, p_nrm, p_emi = gen_cine_panels()
    for fname, arr in (
        ("panel_albedo.png", p_alb),
        ("panel_normal.png", p_nrm),
        ("panel_emissive.png", p_emi),
    ):
        p = OUT_DIR / fname
        report.append((fname, save_png_under_limit(arr, p, mode="RGB")))

    # 2. Chevrones arcoíris (tileable en X)
    chev_p = OUT_DIR / "chevrones_rainbow.png"
    report.append((chev_p.name, save_png_under_limit(gen_chevrones_rainbow(), chev_p, mode="RGB")))

    # 3. Sprites FX RGBA
    for fname, fn in (
        ("lightbar.png", gen_lightbar),
        ("streak.png", gen_streak),
        ("spark.png", gen_spark),
        ("constellation.png", gen_constellation),
    ):
        p = OUT_DIR / fname
        report.append((fname, save_png_under_limit(fn(), p, mode="RGBA")))

    # 4. Paneles por tema (<id>_panel.png)
    for theme_id, arr in gen_theme_panels().items():
        fname = f"{theme_id}_panel.png"
        p = OUT_DIR / fname
        report.append((fname, save_png_under_limit(arr, p, mode="RGB")))

    # 5. Previews 2x2 de verificación de tiling
    preview_targets = [
        ("panel_albedo.png", True, True),
        ("panel_normal.png", True, True),
        ("panel_emissive.png", True, True),
        ("chevrones_rainbow.png", True, False),
        ("constellation.png", True, True),
        ("bosque_panel.png", True, True),
        ("mar_panel.png", True, True),
        ("volcan_panel.png", True, True),
        ("hielo_panel.png", True, True),
        ("neon_panel.png", True, True),
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
