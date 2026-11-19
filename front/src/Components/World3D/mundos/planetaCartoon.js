import * as THREE from 'three'
import { NODE_R, GRID_LEN, FINISH_LEN, mulberry32 } from '../../../Core/world.js'
import { FOCO } from './foco.js'

export const PLANET_TYPES = [
  'gaseoso_bandas',
  'tierra_continentes',
  'luna_crateres',
  'lava',
  'hielo',
  'toxico',
  'oceano_espiral',
  'desierto_dunas',
]

// Dirección del sol principal en Scene.jsx (SOL_DIR)
export const SCENE_SUN_DIR = new THREE.Vector3(0.4, 0.8, 0.3).normalize()

// Afinidad de tipos procedurales por bioma para asegurar variedad visual y coherencia temática
const BIOME_TYPE_POOL = {
  nubes: ['gaseoso_bandas', 'oceano_espiral', 'hielo'],
  mar: ['oceano_espiral', 'tierra_continentes', 'hielo'],
  bosque: ['tierra_continentes', 'oceano_espiral', 'desierto_dunas'],
  jardin: ['tierra_continentes', 'gaseoso_bandas', 'toxico'],
  sombrio: ['luna_crateres', 'toxico', 'gaseoso_bandas'],
  volcan: ['lava', 'luna_crateres', 'desierto_dunas'],
  hielo: ['hielo', 'oceano_espiral', 'luna_crateres'],
  desierto: ['desierto_dunas', 'luna_crateres', 'gaseoso_bandas'],
  cristal: ['hielo', 'gaseoso_bandas', 'toxico'],
  neon: ['toxico', 'gaseoso_bandas', 'lava'],
}

// Paletas cartoon de 5 colores por cada uno de los 8 tipos (múltiples variantes por tipo)
const TYPE_PALETTES = {
  gaseoso_bandas: [
    ['#6e281b', '#d66634', '#f2ae63', '#fff0cf', '#c93824'], // Júpiter cálido
    ['#183873', '#2b6dc9', '#61b8fa', '#c9f0ff', '#7c4dff'], // Gigante azul
    ['#361a5c', '#6e39ad', '#b86ef5', '#ffd4f8', '#ff54a4'], // Tormenta violeta
    ['#1d4a3f', '#3c8f70', '#8fd694', '#f7f0b2', '#e88235'], // Bandas jade/ámbar
  ],
  tierra_continentes: [
    ['#0e3b7a', '#1f85d4', '#46bd59', '#cfb869', '#f7fbff'], // Tierra clásica
    ['#0d4a5e', '#20a4b5', '#52c44d', '#e6c153', '#f0f8ff'], // Archipiélago turquesa
    ['#1c2a6b', '#3b6cd4', '#d66840', '#f0b64a', '#fff5e6'], // Continentes ocre
    ['#4a1470', '#a73fd1', '#2fd1a0', '#ffd23f', '#fff0fb'], // Mar violeta, tierra menta
    ['#0a5a3e', '#17b08a', '#e8e04a', '#e07a2e', '#ffffff'], // Mar esmeralda, tierra solar
    ['#7a1740', '#e0457a', '#7ed957', '#f7e27a', '#fff7e0'], // Mar rosa, tierra lima
    ['#0b1f5c', '#2a4fd8', '#a4e04a', '#c46b3a', '#eaf4ff'], // Cobalto con praderas
  ],
  luna_crateres: [
    ['#3a4159', '#687391', '#9ea8c4', '#dae2f5', '#212638'], // Luna gris azulada
    ['#4a2833', '#7d4956', '#ba777c', '#edb5aa', '#29141b'], // Luna rosada
    ['#4a3926', '#7d6443', '#b59769', '#e6cca3', '#2c2115'], // Asteroide ocre
  ],
  lava: [
    ['#1b1218', '#38242b', '#5e3839', '#ff4d17', '#ffe24a'], // Basalto y magma
    ['#121426', '#272b4a', '#444b78', '#ff2a78', '#ffbe55'], // Plasma volcánico
  ],
  hielo: [
    ['#164478', '#3382c9', '#7ad2ff', '#e3f8ff', '#ffffff'], // Glaciar cian
    ['#29296b', '#5862c2', '#9cc0ff', '#e8f4ff', '#94fff4'], // Escarcha cristal
  ],
  toxico: [
    ['#172913', '#2d571e', '#5cbd28', '#b8ff29', '#f5ff85'], // Ácido verde
    ['#26123b', '#3f235e', '#44ad36', '#9eff2e', '#dbff7d'], // Mutágeno neón
  ],
  oceano_espiral: [
    ['#0b2859', '#1759a8', '#2caae8', '#9be8ff', '#ffffff'], // Ciclón oceánico
    ['#0a3047', '#106b7a', '#26c9b8', '#8dfce1', '#e6fff9'], // Arrecife bioluminiscente
  ],
  desierto_dunas: [
    ['#6b2f18', '#ad5223', '#e08936', '#ffd06b', '#fff0b5'], // Dunas doradas
    ['#4f1a19', '#8f3227', '#cf5b35', '#f29855', '#ffd49c'], // Cañón rojo
  ],
}

// ───────────────────────── Caché de módulo: geometría y shaders ─────────────────────────

let _unitSphereGeo = null
export function getPlanetUnitSphereGeo() {
  if (!_unitSphereGeo) {
    _unitSphereGeo = new THREE.SphereGeometry(1, 72, 54)
  }
  return _unitSphereGeo
}

let _unitSphereLowGeo = null
export function getPlanetUnitSphereLowGeo() {
  if (!_unitSphereLowGeo) {
    _unitSphereLowGeo = new THREE.SphereGeometry(1, 36, 26)
  }
  return _unitSphereLowGeo
}

let _ringGeo = null
export function getPlanetRingGeo() {
  if (!_ringGeo) {
    _ringGeo = new THREE.RingGeometry(1.34, 1.96, 80, 1).rotateX(-Math.PI / 2)
  }
  return _ringGeo
}

const outlineMatCache = new Map()
export function getPlanetOutlineMaterial(colorHex = '#080a14') {
  let mat = outlineMatCache.get(colorHex)
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.BackSide,
      depthWrite: true,
    })
    outlineMatCache.set(colorHex, mat)
  }
  return mat
}

const GLSL_NOISE_3D = /* glsl */ `
  // Hash y ruido 3D continuo sin costuras sobre la esfera
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z) * 2.0 - 1.0;
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.03 + vec3(13.1, 7.7, 5.3);
      a *= 0.5;
    }
    return v;
  }
`

const PLANET_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vLocalDir = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const PLANET_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  uniform float uPlanetType;
  uniform vec3 uCol0;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  uniform vec3 uCol3;
  uniform vec3 uCol4;
  uniform vec3 uAtmoColor;
  uniform vec3 uOutlineColor;
  uniform float uNoiseScale;
  uniform float uBandFreq;
  uniform vec3 uSeedVec;
  uniform vec3 uStormPos;
  uniform float uSeaBias;
  uniform float uDistBoost;
  uniform float uNear;    // 0 mapa/camino … 1 ballita seguida caminando en este planeta
  uniform float uRadius;  // radio visual: el detalle cercano se mide en unidades de mundo
  uniform vec3 uFocoPos;  // ballita seguida (compartido con los demás materiales del planeta)

  varying vec3 vLocalDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${GLSL_NOISE_3D}

  // Campo celular 3D para cráteres y burbujas (x: dist al centro, y: radio celda, z: 2da dist)
  vec3 voronoi3(vec3 p) {
    vec3 n = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
    for (int k = -1; k <= 1; k++) {
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec3 g = vec3(float(i), float(j), float(k));
          vec3 o = hash33(n + g);
          vec3 r = g + (0.18 + 0.64 * o) - f;
          float d = dot(r, r);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = o.x;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
    }
    return vec3(sqrt(d1), id, sqrt(d2));
  }

  void main() {
    vec3 pDir = normalize(vLocalDir);
    vec3 p = pDir * uNoiseScale + uSeedVec;
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec3 baseCol = uCol1;
    float emissiveBoost = 0.0;
    float specBoost = 0.0;
    float bumpNdotL = 0.0;

    int pType = int(uPlanetType + 0.5);

    if (pType == 0) {
      // 0: gaseoso_bandas — bandas onduladas + tormenta en espiral
      float n1 = fbm(p * 0.9);
      float n2 = fbm(p * 2.1 + vec3(n1 * 1.4));
      float lat = pDir.y;
      float bandCoord = lat * uBandFreq + n1 * 1.35 + n2 * 0.45 + sin(lat * 5.0 + uSeedVec.x) * 0.22;
      float b = sin(bandCoord * 3.14159) * 0.5 + 0.5;
      float t0 = smoothstep(0.22, 0.30, b);
      float t1 = smoothstep(0.48, 0.56, b);
      float t2 = smoothstep(0.76, 0.84, b);
      baseCol = mix(uCol0, uCol1, t0);
      baseCol = mix(baseCol, uCol2, t1);
      baseCol = mix(baseCol, uCol3, t2);

      // Ojo de tormenta espiral
      vec3 upRef = abs(uStormPos.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 sU = normalize(cross(upRef, uStormPos));
      vec3 sV = cross(uStormPos, sU);
      float sDist = distance(pDir, uStormPos);
      float sAng = atan(dot(pDir, sV) + 1e-5, dot(pDir, sU) + 1e-5);
      float swirl = sin(sAng * 2.0 + sDist * 18.0 - uTime * 0.25 + n2 * 2.5) * 0.5 + 0.5;
      float stormRing = (1.0 - smoothstep(0.16, 0.36, sDist)) * smoothstep(0.35, 0.65, swirl);
      float stormCore = 1.0 - smoothstep(0.06, 0.16, sDist);
      baseCol = mix(baseCol, uCol3, stormRing * 0.75);
      baseCol = mix(baseCol, uCol4, stormCore * 0.92);
    } else if (pType == 1) {
      // 1: tierra_continentes — océanos, costas, continentes, montañas y casquetes polares
      float h = fbm(p * 0.95) + 0.36 * fbm(p * 2.3) + uSeaBias;
      float shallow = smoothstep(-0.14, -0.04, h);
      float land = smoothstep(-0.02, 0.04, h);
      float mountain = smoothstep(0.26, 0.34, h);
      float polar = smoothstep(0.76, 0.83, abs(pDir.y) + h * 0.14);
      baseCol = mix(uCol0, uCol1, shallow);
      baseCol = mix(baseCol, uCol2, land);
      baseCol = mix(baseCol, uCol3, mountain);
      baseCol = mix(baseCol, uCol4, polar);
      specBoost = (1.0 - land) * 0.35;
    } else if (pType == 2) {
      // 2: luna_crateres — superficie rocosa + cráteres 3D con aro iluminado y fondo oscuro
      float baseN = fbm(p * 1.15);
      baseCol = mix(uCol1, uCol2, smoothstep(-0.2, 0.3, baseN));
      vec3 c1 = voronoi3(pDir * (uNoiseScale * 1.25) + uSeedVec);
      vec3 c2 = voronoi3(pDir * (uNoiseScale * 2.4) + uSeedVec * 1.7);
      float r1 = 0.22 + c1.y * 0.18;
      float bowl1 = 1.0 - smoothstep(r1 * 0.65, r1, c1.x);
      float rim1 = exp(-pow((c1.x - r1) / max(0.04, r1 * 0.2), 2.0));
      float r2 = 0.18 + c2.y * 0.14;
      float bowl2 = 1.0 - smoothstep(r2 * 0.6, r2, c2.x);
      float rim2 = exp(-pow((c2.x - r2) / max(0.035, r2 * 0.22), 2.0));
      float bowl = max(bowl1, bowl2 * 0.7);
      float rim = clamp(rim1 + rim2 * 0.6, 0.0, 1.0);
      baseCol = mix(baseCol, uCol4, bowl * 0.82);
      baseCol = mix(baseCol, uCol3, rim * 0.78);
      bumpNdotL = (rim - bowl * 0.7) * 0.22;
    } else if (pType == 3) {
      // 3: lava — placas basálticas oscuras con grietas y ríos de magma brillante
      float n = fbm(p * 1.1);
      vec3 v = voronoi3(p * 1.25 + vec3(n * 0.45));
      float edge = v.z - v.x;
      float crack = 1.0 - smoothstep(0.04, 0.16, edge);
      float fissure = 1.0 - smoothstep(0.04, 0.14, abs(fbm(p * 1.65 + vec3(0.0, uTime * 0.02, 0.0))));
      float magma = clamp(max(crack, fissure * 0.85), 0.0, 1.0);
      float core = smoothstep(0.55, 0.92, magma);
      float rockStep = smoothstep(-0.15, 0.25, n);
      baseCol = mix(uCol0, mix(uCol1, uCol2, smoothstep(0.25, 0.65, n)), rockStep);
      baseCol = mix(baseCol, uCol3, smoothstep(0.15, 0.55, magma));
      baseCol = mix(baseCol, uCol4, core);
      emissiveBoost = magma * 0.95;
    } else if (pType == 4) {
      // 4: hielo — placas glaciares facetadas, grietas profundas y nieve polar
      vec3 v = voronoi3(p * 1.35);
      float edge = v.z - v.x;
      float crack = 1.0 - smoothstep(0.03, 0.12, edge);
      float n = fbm(p * 1.3);
      float sheet = smoothstep(-0.18, 0.22, n);
      float snow = smoothstep(0.28, 0.52, n + abs(pDir.y) * 0.35);
      baseCol = mix(uCol1, uCol2, sheet);
      baseCol = mix(baseCol, uCol3, snow);
      baseCol = mix(baseCol, uCol0, crack * 0.85);
      baseCol = mix(baseCol, uCol4, smoothstep(0.55, 0.72, n) * 0.65);
      specBoost = 0.65 * (1.0 - crack);
    } else if (pType == 5) {
      // 5: toxico — remolinos de lodo ácido y burbujas fosforescentes
      vec3 q = vec3(fbm(p), fbm(p + vec3(5.2, 1.3, 2.8)), fbm(p + vec3(1.7, 9.2, 4.1)));
      float w = fbm(p * 1.15 + q * 1.35 + vec3(0.0, uTime * 0.03, 0.0));
      vec3 bub = voronoi3(p * 1.85 + vec3(w * 0.35));
      float rB = 0.18 + bub.y * 0.16;
      float inBub = 1.0 - smoothstep(rB * 0.65, rB, bub.x);
      float acidVein = smoothstep(0.12, 0.45, w);
      baseCol = mix(uCol0, uCol1, smoothstep(-0.35, 0.05, w));
      baseCol = mix(baseCol, uCol2, acidVein);
      baseCol = mix(baseCol, uCol3, max(inBub * 0.85, smoothstep(0.42, 0.65, w)));
      baseCol = mix(baseCol, uCol4, inBub * smoothstep(0.3, 0.8, bub.y));
      emissiveBoost = clamp(inBub * 0.65 + smoothstep(0.35, 0.7, w) * 0.4, 0.0, 0.85);
      specBoost = 0.4;
    } else if (pType == 6) {
      // 6: oceano_espiral — océanos con corrientes y grandes espirales ciclónicas
      float n = fbm(p * 1.1);
      vec3 upRef = abs(uStormPos.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 sU = normalize(cross(upRef, uStormPos));
      vec3 sV = cross(uStormPos, sU);
      float d1 = distance(pDir, uStormPos);
      float d2 = distance(pDir, -uStormPos);
      float ang1 = atan(dot(pDir, sV) + 1e-5, dot(pDir, sU) + 1e-5);
      float arm1 = sin(ang1 * 3.0 + d1 * 13.5 - uTime * 0.2 + n * 2.6) * 0.5 + 0.5;
      float mask1 = 1.0 - smoothstep(0.25, 0.95, d1);
      float arm2 = sin(-ang1 * 2.0 + d2 * 11.0 + uTime * 0.15 + n * 2.2) * 0.5 + 0.5;
      float mask2 = 1.0 - smoothstep(0.2, 0.8, d2);
      float spiral = max(arm1 * mask1, arm2 * mask2);
      baseCol = mix(uCol0, uCol1, smoothstep(-0.25, 0.25, n));
      baseCol = mix(baseCol, uCol2, smoothstep(0.25, 0.55, spiral + n * 0.25));
      baseCol = mix(baseCol, uCol3, smoothstep(0.55, 0.75, spiral));
      baseCol = mix(baseCol, uCol4, smoothstep(0.78, 0.92, spiral));
      specBoost = 0.45;
    } else {
      // 7: desierto_dunas — dunas esculpidas por el viento y mesetas estratificadas
      float n = fbm(p * 0.9);
      float dunePhase = (p.x * 2.6 + p.z * 1.8) + n * 3.8;
      float dune = sin(dunePhase) * 0.5 + 0.5;
      float ridge = smoothstep(0.42, 0.62, dune);
      float mesa = smoothstep(0.28, 0.36, n);
      baseCol = mix(uCol0, uCol1, smoothstep(0.15, 0.45, dune));
      baseCol = mix(baseCol, uCol2, ridge);
      baseCol = mix(baseCol, uCol3, smoothstep(0.68, 0.88, dune));
      baseCol = mix(baseCol, uCol4, mesa * 0.85);
      bumpNdotL = (dune - 0.5) * 0.2;
    }

    // De cerca (ballita en el planeta): materialidad a escala de ballita. Manchas de ~9 u, grano de ~2 u y
    // poro fino, saturación contenida (el color del bioma deja de ser un plano chillón) y relieve de luz.
    float nearGrain = 0.0;
    if (uNear > 0.001) {
      vec3 wp = pDir * uRadius;
      float g1 = fbm(wp * 0.075 + uSeedVec * 0.37);
      float g2 = noise3(wp * 0.42 + uSeedVec.zxy);
      float g3 = noise3(wp * 1.9 + uSeedVec.yzx);
      float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));
      // contraste del bioma comprimido hacia su tono medio (las manchas de color gigantes dejan de gritar)
      vec3 medio = mix(uCol1, uCol2, 0.5);
      vec3 det = mix(baseCol, medio, 0.35);
      float dl = dot(det, vec3(0.299, 0.587, 0.114));
      det = mix(det, vec3(dl), 0.4);
      det = mix(det, det * vec3(1.07, 1.0, 0.88), clamp(g1 * 0.9 + 0.45, 0.0, 1.0));
      det *= 0.8 + 0.3 * g1 + 0.16 * g2 + 0.08 * g3;
      baseCol = mix(baseCol, det, uNear);
      nearGrain = g2 * 0.09 + g3 * 0.05;
      bumpNdotL += nearGrain * uNear;
      emissiveBoost *= 1.0 - 0.6 * uNear;
    }

    // Sombreado toon de 3 bandas usando la dirección de luz de la escena
    float ndotl = dot(N, L) + bumpNdotL;
    float bShadow = smoothstep(-0.10, -0.02, ndotl);
    float bLit = smoothstep(0.42, 0.50, ndotl);
    float toonBand = mix(0.42, mix(0.88, 1.15, bLit), bShadow);
    vec3 shadowTint = mix(vec3(0.66, 0.70, 0.95), vec3(1.0), bShadow);
    vec3 litCol = baseCol * toonBand * shadowTint;

    // Brillo especular cartoon acotado (en hielo y océanos)
    if (specBoost > 0.01) {
      vec3 H = normalize(L + V);
      float spec = smoothstep(0.92, 0.955, dot(N, H));
      litCol += vec3(1.0) * spec * specBoost * bShadow;
    }

    // Zonas emisivas (lava, ácido) mantienen su luz propia en sombra
    vec3 col = mix(litCol, baseCol * 1.25, emissiveBoost);

    // Lejos del mapa: piso de brillo propio y borde más marcado para leer esferas de color
    col = max(col, baseCol * 0.62 * uDistBoost);

    // Brillo de borde (Fresnel) del color de la atmósfera
    float ndotv = clamp(dot(N, V), 0.0, 1.0);
    float rim = smoothstep(0.44 - 0.14 * uDistBoost, 0.84, 1.0 - ndotv);
    float rimSun = 0.52 + 0.48 * clamp(ndotl * 0.5 + 0.5, 0.0, 1.0);
    rimSun = mix(rimSun, 1.0, uDistBoost);
    // De cerca la cámara mira el suelo rasante: el Fresnel y la tinta de borde pintaban franjas lisas
    // (blanca y negra) a media pantalla; se apagan y en su lugar hay perspectiva aérea suave.
    col = mix(col, uAtmoColor * 1.18, rim * rimSun * (0.72 + 0.2 * uDistBoost) * (1.0 - 0.9 * uNear));

    // Refuerzo sutil del contorno oscuro en el borde extremo (complementa el casco invertido)
    float edgeInk = smoothstep(0.15, 0.04, ndotv) * (1.0 - uNear);
    col = mix(col, uOutlineColor, edgeInk * 0.85);

    if (uNear > 0.001) {
      float camD = distance(cameraPosition, vWorldPos);
      float aire = smoothstep(18.0, 120.0, camD);
      col = mix(col, uAtmoColor * 0.42 + col * 0.35, aire * 0.42 * uNear);
      // barrio: el suelo lejos de la ballita baja un poco, la zona por donde camina queda más clara
      float lejos = smoothstep(10.0, 55.0, distance(vWorldPos, uFocoPos));
      col *= 1.0 - 0.2 * lejos * uNear;
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// ───────────────────────── Semilla, paleta y configuración por planeta ─────────────────────────

/**
 * Calcula una semilla determinista que depende de node.idx y de la geometría/semilla del mundo,
 * garantizando planetas distintos entre nodos y entre partidas con diferente semilla.
 */
export function computePlanetSeed(node, world) {
  let h = ((world?.seed ?? 369) | 0) ^ Math.imul((node.idx | 0) + 1, 0x9e3779b1)
  const v0 = node.verts?.[0]?.dir
  if (v0) {
    h ^= Math.imul(Math.round(v0.x * 1e4), 0x85ebca6b)
    h ^= Math.imul(Math.round(v0.y * 1e4), 0xc2b2ae35)
    h ^= Math.imul(Math.round(v0.z * 1e4), 0x27d4eb2f)
  }
  const d0 = node.destinos?.[0]?.dir
  if (d0) {
    h ^= Math.imul(Math.round(d0.x * 1e4), 0x165667b1)
    h ^= Math.imul(Math.round(d0.z * 1e4), 0x9e3779b9)
  }
  if (Array.isArray(world?.picks) && world.picks.length > 0) {
    h ^= Math.imul((world.picks[node.idx % world.picks.length] | 0) + 17, 0x45d9f3b)
  }
  return (h >>> 0) + 1
}

function shiftColor(hex, rng, hRange = 0.045, sRange = 0.08, lRange = 0.06) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(
    (hsl.h + (rng() - 0.5) * 2 * hRange + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + (rng() - 0.5) * 2 * sRange, 0.08, 0.98),
    THREE.MathUtils.clamp(hsl.l + (rng() - 0.5) * 2 * lRange, 0.06, 0.96),
  )
  return c
}

/**
 * Resuelve tipo, paleta (5 colores con variación de tono por semilla), escala de ruido,
 * rotación e inclinación axial a partir de la semilla del nodo y del bioma asignado.
 */
export function resolvePlanetConfig(node, biome, world) {
  const seed = computePlanetSeed(node, world)
  const rng = mulberry32(seed)

  const pool = BIOME_TYPE_POOL[biome?.id] || PLANET_TYPES
  // Con probabilidad 22% usa cualquier otro tipo para sorprender entre partidas distintas
  const type = rng() < 0.78
    ? pool[(Math.floor(rng() * pool.length) + node.idx) % pool.length]
    : PLANET_TYPES[(Math.floor(rng() * PLANET_TYPES.length) + node.idx) % PLANET_TYPES.length]
  const typeIndex = PLANET_TYPES.indexOf(type)

  const subPalettes = TYPE_PALETTES[type]
  const rawPalette = subPalettes[Math.floor(rng() * subPalettes.length)]
  // Tierra: giro de tono amplio y colores más saturados para distinguirlos de lejos
  const hueR = type === 'tierra_continentes' ? 0.16 : 0.045
  const palette = rawPalette.map((hex) => {
    const c = shiftColor(hex, rng, hueR)
    const hsl = { h: 0, s: 0, l: 0 }
    c.getHSL(hsl)
    return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.12 + 0.04), hsl.l)
  })
  // Proporción de océano/continente: sube o baja el nivel del mar por semilla
  const seaBias = type === 'tierra_continentes' ? (rng() - 0.5) * 0.5 : 0

  const atmoColor = shiftColor(biome?.atmoRim || rawPalette[3], rng, 0.03, 0.06, 0.04)
  const outlineColor = new THREE.Color('#080a14').lerp(palette[0], 0.14)

  const noiseScale = 2.2 + rng() * 2.0
  const bandFreq = 4.5 + rng() * 5.5
  const seedVec = new THREE.Vector3(
    (rng() - 0.5) * 80,
    (rng() - 0.5) * 80,
    (rng() - 0.5) * 80,
  )

  const sy = (rng() - 0.5) * 1.2
  const sr = Math.sqrt(Math.max(0, 1 - sy * sy))
  const sa = rng() * Math.PI * 2
  const stormPos = new THREE.Vector3(Math.cos(sa) * sr, sy, Math.sin(sa) * sr).normalize()

  const tiltX = (rng() - 0.5) * 0.48
  const tiltZ = (rng() - 0.5) * 0.48
  const rotY0 = rng() * Math.PI * 2
  const spinSpeed = (0.015 + rng() * 0.035) * (rng() < 0.5 ? 1 : -1)

  // Escala visual del planeta: 1.0 a 1.6 x NODE_R según semilla, acotada para que las
  // terminales y las rectas radiales de los caminos sigan emergiendo sobre la superficie
  const rawVisualScale = 1.0 + rng() * 0.6
  const maxSafeR = NODE_R + Math.max(0, Math.min(GRID_LEN, FINISH_LEN) - 3.2)
  const visualScale = Math.min(rawVisualScale, Math.max(1.0, maxSafeR / NODE_R))
  const visualR = NODE_R * visualScale

  // Anillos inclinados en ~30% de los planetas
  const ringChance = (type === 'gaseoso_bandas' || type === 'hielo') ? 0.44
    : (type === 'desierto_dunas' || type === 'toxico') ? 0.28 : 0.18
  const hasRings = rng() < ringChance
  const ring = hasRings ? {
    tilt: [(rng() - 0.5) * 0.52 + 0.18, rng() * Math.PI * 2, (rng() - 0.5) * 0.52],
    freq: 18 + rng() * 20,
    seed: rng() * 10,
    colors: [
      palette[2].clone().lerp(palette[3], 0.4),
      palette[3].clone(),
      palette[1].clone().lerp(atmoColor, 0.35),
    ],
  } : null

  // Lunas pequeñas en órbita en ~45% de los planetas (1 o 2)
  const moonCount = rng() < 0.48 ? (rng() < 0.35 ? 2 : 1) : 0
  const moons = []
  for (let i = 0; i < moonCount; i++) {
    const baseOrbit = hasRings ? 2.15 : 1.48
    const orbitRatio = baseOrbit + i * 0.36 + rng() * 0.22
    const radiusRatio = 0.12 + rng() * 0.08
    const baseMoonHex = rng() < 0.5 ? '#9ea8c4' : '#c7a487'
    const mc0 = shiftColor(baseMoonHex, rng, 0.06, 0.1, 0.08).multiplyScalar(0.55)
    const mc1 = shiftColor(baseMoonHex, rng, 0.05, 0.08, 0.08)
    const mc2 = mc1.clone().lerp(new THREE.Color('#ffffff'), 0.45)
    moons.push({
      radiusRatio,
      orbitRatio,
      tilt: [(rng() - 0.5) * 0.7, 0, (rng() - 0.5) * 0.7],
      phase: rng() * Math.PI * 2,
      speed: (0.2 + rng() * 0.26) * (rng() < 0.5 ? 1 : -1),
      colors: [mc0, mc1, mc2],
      seedVec: new THREE.Vector3((rng() - 0.5) * 40, (rng() - 0.5) * 40, (rng() - 0.5) * 40),
    })
  }

  // Nubes toon en capa propia (ausentes o muy tenues en lunas áridas)
  const cloudTypes = ['tierra_continentes', 'oceano_espiral', 'hielo', 'gaseoso_bandas']
  const cloudsEnabled = cloudTypes.includes(type) && rng() < 0.8
  const clouds = {
    enabled: cloudsEnabled,
    coverage: 0.3 + rng() * 0.14, // alto = pocas manchas pequeñas
    scale: 3.6 + rng() * 1.6,
    opacity: 0.4 + rng() * 0.2,
    speed: biome?.cloudSpeed ?? (0.02 + rng() * 0.025),
    colorLit: type === 'lava'
      ? new THREE.Color('#ffd0b3')
      : type === 'toxico'
        ? new THREE.Color('#dcff9e')
        : new THREE.Color(biome?.cloudColor || '#ffffff').lerp(new THREE.Color('#ffffff'), 0.55),
    colorShade: type === 'lava'
      ? new THREE.Color('#4a2d2d')
      : new THREE.Color(biome?.atmoBase || '#7b99c9').lerp(palette[0], 0.35),
    seedVec: new THREE.Vector3((rng() - 0.5) * 60, (rng() - 0.5) * 60, (rng() - 0.5) * 60),
  }

  return {
    seed,
    type,
    typeIndex,
    palette,
    atmoColor,
    outlineColor,
    outlineHex: `#${outlineColor.getHexString()}`,
    noiseScale,
    bandFreq,
    seaBias,
    seedVec,
    stormPos,
    tilt: [tiltX, 0, tiltZ],
    rotY0,
    spinSpeed,
    visualScale,
    visualR,
    ring,
    moons,
    clouds,
  }
}

/**
 * Crea un ShaderMaterial para un planeta compartiendo el programa compilado en caché de Three.js
 * (mismos shaders + customProgramCacheKey), con uniforms propios por planeta.
 */
export function createPlanetCartoonMaterial(config) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: SCENE_SUN_DIR.clone() },
      uPlanetType: { value: config.typeIndex },
      uCol0: { value: config.palette[0].clone() },
      uCol1: { value: config.palette[1].clone() },
      uCol2: { value: config.palette[2].clone() },
      uCol3: { value: config.palette[3].clone() },
      uCol4: { value: config.palette[4].clone() },
      uAtmoColor: { value: config.atmoColor.clone() },
      uOutlineColor: { value: config.outlineColor.clone() },
      uNoiseScale: { value: config.noiseScale },
      uBandFreq: { value: config.bandFreq },
      uSeedVec: { value: config.seedVec.clone() },
      uStormPos: { value: config.stormPos.clone() },
      uSeaBias: { value: config.seaBias },
      uDistBoost: { value: 0 },
      uNear: { value: 0 },
      uRadius: { value: config.visualR },
      uFocoPos: FOCO.pos,
    },
    vertexShader: PLANET_VERTEX_SHADER,
    fragmentShader: PLANET_FRAGMENT_SHADER,
  })
  mat.customProgramCacheKey = () => 'planet-cartoon-v3'
  return mat
}

// ───────────────────────── Shader de Nubes Toon ─────────────────────────

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  uniform vec3 uColorLit;
  uniform vec3 uColorShade;
  uniform vec3 uOutlineColor;
  uniform float uCoverage;
  uniform float uScale;
  uniform float uOpacity;
  uniform vec3 uSeedVec;

  varying vec3 vLocalDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${GLSL_NOISE_3D}

  void main() {
    vec3 p = normalize(vLocalDir) * uScale + uSeedVec + vec3(uTime * 0.015, 0.0, -uTime * 0.01);
    float n = fbm(p) + 0.3 * fbm(p * 2.2);
    float latFade = 1.0 - smoothstep(0.7, 0.92, abs(vLocalDir.y));
    float puff = n * latFade - uCoverage;
    if (puff < 0.0) discard;

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uLightDir);
    float ndotl = dot(N, L);
    float bShadow = smoothstep(-0.12, 0.0, ndotl);
    float bLit = smoothstep(0.38, 0.48, ndotl);
    vec3 col = mix(uColorShade, uColorLit, mix(0.32, 1.0, bShadow));
    col = mix(col, vec3(1.0), bLit * 0.16);

    // Borde suave: el alfa sube gradualmente desde el borde de la mancha
    float alpha = smoothstep(0.0, 0.16, puff) * uOpacity;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createPlanetCloudMaterial(config) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: SCENE_SUN_DIR.clone() },
      uColorLit: { value: config.clouds.colorLit.clone() },
      uColorShade: { value: config.clouds.colorShade.clone() },
      uOutlineColor: { value: config.outlineColor.clone() },
      uCoverage: { value: config.clouds.coverage },
      uScale: { value: config.clouds.scale },
      uOpacity: { value: config.clouds.opacity },
      uSeedVec: { value: config.clouds.seedVec.clone() },
    },
    vertexShader: PLANET_VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  })
  mat.customProgramCacheKey = () => 'planet-clouds-cartoon-v1'
  return mat
}

// ───────────────────────── Shader de Anillos Cartoon con Sombra Planetaria ─────────────────────────

const RING_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vLocalPos = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const RING_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uLightDir;
  uniform vec3 uPlanetCenter;
  uniform float uPlanetR;
  uniform vec3 uCol0;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  uniform vec3 uOutlineColor;
  uniform float uFreq;
  uniform float uSeed;

  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    float r = length(vLocalPos.xz);
    float t = clamp((r - 1.34) / 0.62, 0.0, 1.0);

    // Bandas concéntricas con divisiones estilo Cassini
    float w1 = sin(t * uFreq + uSeed + sin(t * 15.0) * 0.45) * 0.5 + 0.5;
    float w2 = cos(t * uFreq * 1.85 - uSeed * 0.7) * 0.5 + 0.5;
    float band = mix(w1, w2, 0.38);

    vec3 col = mix(uCol0, uCol1, smoothstep(0.28, 0.45, band));
    col = mix(col, uCol2, smoothstep(0.66, 0.82, band));

    float gap1 = smoothstep(0.022, 0.05, abs(t - 0.62));
    float gap2 = smoothstep(0.015, 0.038, abs(t - 0.28));
    float edgeFade = smoothstep(0.0, 0.055, t) * smoothstep(1.0, 0.93, t);

    // Contorno oscuro sutil en los bordes del anillo
    float borderInk = (1.0 - smoothstep(0.0, 0.03, t)) + (1.0 - smoothstep(0.97, 1.0, t));
    col = mix(col, uOutlineColor, clamp(borderInk, 0.0, 0.75));

    // Sombra proyectada por el planeta sobre sus propios anillos
    vec3 L = normalize(uLightDir);
    vec3 rel = vWorldPos - uPlanetCenter;
    float proj = dot(rel, L);
    float perp = length(rel - L * proj);
    float shadow = proj < 0.0 ? smoothstep(uPlanetR * 0.94, uPlanetR * 1.05, perp) : 1.0;

    // Iluminación toon suave (anillo traslúcido visto por ambos lados)
    vec3 N = normalize(gl_FrontFacing ? vWorldNormal : -vWorldNormal);
    float ndotl = abs(dot(N, L));
    float toon = mix(0.68, 1.08, smoothstep(0.18, 0.45, ndotl));
    col *= toon * mix(0.32, 1.0, shadow);

    float alpha = clamp((0.46 + band * 0.42) * gap1 * gap2 * edgeFade, 0.0, 0.88);
    if (alpha < 0.03) discard;

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createPlanetRingMaterial(config, planetCenter, planetR) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: SCENE_SUN_DIR.clone() },
      uPlanetCenter: { value: planetCenter.clone() },
      uPlanetR: { value: planetR },
      uCol0: { value: config.ring.colors[0].clone() },
      uCol1: { value: config.ring.colors[1].clone() },
      uCol2: { value: config.ring.colors[2].clone() },
      uOutlineColor: { value: config.outlineColor.clone() },
      uFreq: { value: config.ring.freq },
      uSeed: { value: config.ring.seed },
    },
    vertexShader: RING_VERTEX_SHADER,
    fragmentShader: RING_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  mat.customProgramCacheKey = () => 'planet-ring-cartoon-v1'
  return mat
}

// ───────────────────────── Shader de Lunas Toon ─────────────────────────

const MOON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uLightDir;
  uniform vec3 uCol0;
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  uniform vec3 uOutlineColor;
  uniform vec3 uSeedVec;

  varying vec3 vLocalDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${GLSL_NOISE_3D}

  void main() {
    float n = fbm(normalize(vLocalDir) * 3.4 + uSeedVec);
    vec3 baseCol = mix(uCol0, uCol1, smoothstep(-0.22, 0.15, n));
    baseCol = mix(baseCol, uCol2, smoothstep(0.28, 0.55, n));

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndotl = dot(N, L);
    float bShadow = smoothstep(-0.08, 0.02, ndotl);
    float bLit = smoothstep(0.42, 0.52, ndotl);
    float toon = mix(0.42, mix(0.88, 1.14, bLit), bShadow);

    float ndotv = clamp(dot(N, V), 0.0, 1.0);
    float rim = smoothstep(0.55, 0.88, 1.0 - ndotv) * (0.4 + 0.6 * bShadow);
    vec3 col = baseCol * toon + uCol2 * rim * 0.35;
    float edgeInk = smoothstep(0.18, 0.05, ndotv);
    col = mix(col, uOutlineColor, edgeInk * 0.88);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createPlanetMoonMaterial(moonCfg, outlineColor) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: SCENE_SUN_DIR.clone() },
      uCol0: { value: moonCfg.colors[0].clone() },
      uCol1: { value: moonCfg.colors[1].clone() },
      uCol2: { value: moonCfg.colors[2].clone() },
      uOutlineColor: { value: outlineColor.clone() },
      uSeedVec: { value: moonCfg.seedVec.clone() },
    },
    vertexShader: PLANET_VERTEX_SHADER,
    fragmentShader: MOON_FRAGMENT_SHADER,
  })
  mat.customProgramCacheKey = () => 'planet-moon-cartoon-v1'
  return mat
}
