// Aspecto de cada camino (los datos de juego viven en Core/world.js).
// glass: tinte del cristal; rib: costillas y aros; rail: riel emisivo, estela y partículas.
// banner: colores/forma de banderines; lamp: farolas; arch: pilares/arcos.
// props: decoración instanciada alrededor del tubo.
//   k geometría, seed (mismo seed = misma posición, para componer árboles), d densidad por unidad de tubo,
//   off distancia entre la pared del tubo y la base del objeto, y desplazamiento extra hacia fuera,
//   w/h tamaño, c colores, e brillo (bloom), a opacidad, top (solo sobre el lomo del tubo y creciendo
//   hacia arriba), tilt inclinación al azar, ring (aro que abraza el tubo; w = múltiplo del radio).
export const VISUALS = {
  sombrio: {
    glass: '#7a5cc0', rib: '#8a5cf0', rail: '#a24bff',
    banner: { c: ['#3d2466', '#6b3fa0', '#9b6bff'] },
    lamp: { c: '#b784ff', pole: '#2a2238' },
    arch: { c: '#2e2540' },
    props: [
      { k: 'cyl', seed: 1, d: 0.22, off: [0, 0.4], y: [0, 0], w: [0.1, 0.18], h: [1.6, 3.2], c: ['#17121f'], top: true, tilt: 0.25 },
      { k: 'cone', seed: 1, d: 0.22, off: [0, 0.4], y: [1.4, 1.4], w: [0.6, 1], h: [0.8, 1.4], c: ['#221a30'], top: true, tilt: 0.25 },
      { k: 'box', seed: 2, d: 0.15, off: [0, 0.3], y: [0, 0], w: [0.3, 0.45], h: [0.5, 1], c: ['#4a4a5e'], top: true, tilt: 0.2 },
      { k: 'sphere', seed: 3, d: 0.25, off: [0.4, 2.2], y: [0, 0], w: [0.2, 0.34], h: [0.2, 0.34], c: ['#b784ff', '#7a5cff'], e: 1.3, a: 0.75 },
    ],
    parts: { n: 90, c: '#9b6bff', s: 0.1, kind: 'spores', vy: 0.18, vx: 0.15, amp: 0.65, freq: 1.1, a: 0.55, glow: 1.25 },
  },
  bosque: {
    glass: '#7fe09a', rib: '#4caf50', rail: '#9cff6b',
    banner: { c: ['#2e7d32', '#8bc34a', '#ffd54f'] },
    lamp: { c: '#d4ff5a', pole: '#4e342e' },
    arch: { c: '#4a3525' },
    props: [
      { k: 'cyl', seed: 4, d: 0.3, off: [0, 0.3], y: [0, 0], w: [0.2, 0.3], h: [1, 1.5], c: ['#6b4426'], top: true, tilt: 0.12 },
      { k: 'cone', seed: 4, d: 0.3, off: [0, 0.3], y: [0.9, 0.9], w: [1.2, 1.8], h: [1.6, 2.5], c: ['#2e7d32', '#3f9b46', '#1b5e20'], top: true, tilt: 0.12 },
      { k: 'cone', seed: 4, d: 0.3, off: [0, 0.3], y: [1.8, 1.8], w: [0.9, 1.3], h: [1.2, 1.7], c: ['#43a047', '#2e7d32'], top: true, tilt: 0.12 },
      { k: 'sphere', seed: 5, d: 0.3, off: [0, 0.2], y: [0, 0], w: [0.35, 0.6], h: [0.22, 0.34], c: ['#e53935', '#ff7043'], top: true },
    ],
    parts: { n: 80, c: '#d4ff5a', s: 0.12, kind: 'fireflies', vy: 0.08, vx: 0.12, amp: 0.9, freq: 1.6, a: 0.65, glow: 1.3 },
  },
  mar: {
    glass: '#5fc4f0', rib: '#7fe0ff', rail: '#7fe0ff',
    banner: { c: ['#0288d1', '#4dd0e1', '#ff8a65'] },
    lamp: { c: '#bff3ff', pole: '#29566e' },
    arch: { c: '#2b536b' },
    props: [
      { k: 'cone', seed: 6, d: 0.35, off: [0, 0.3], y: [0, 0], w: [0.25, 0.55], h: [0.6, 1.5], c: ['#ff6f91', '#ff9671', '#ffc75f'], tilt: 0.3 },
      { k: 'sphere', seed: 7, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.8, 1.6], h: [0.3, 0.6], c: ['#2a8fd6', '#5fc4f0', '#e6fbff'], a: 0.85 },
      { k: 'sphere', seed: 8, d: 0.4, off: [0.3, 3], y: [0, 0], w: [0.15, 0.4], h: [0.15, 0.4], c: ['#bff3ff'], e: 1.2, a: 0.5 },
    ],
    parts: { n: 95, c: '#bff3ff', s: 0.1, kind: 'bubbles', vy: 0.75, vx: 0.08, amp: 0.45, freq: 1.8, a: 0.55, glow: 1.2 },
  },
  desierto: {
    glass: '#f0cf8a', rib: '#ffb347', rail: '#ffd27a',
    banner: { c: ['#d84315', '#ff9800', '#ffe082'] },
    lamp: { c: '#ffd27a', pole: '#6d4c3d' },
    arch: { c: '#7a5a3a' },
    props: [
      { k: 'cyl', seed: 9, d: 0.2, off: [0, 0.3], y: [0, 0], w: [0.25, 0.4], h: [0.9, 1.9], c: ['#3f8f4a', '#2f7a3e'], top: true, tilt: 0.1 },
      { k: 'sphere', seed: 9, d: 0.2, off: [0, 0.3], y: [1, 1.8], w: [0.3, 0.45], h: [0.3, 0.45], c: ['#ff7aa8'], top: true },
      { k: 'sphere', seed: 10, d: 0.3, off: [0.4, 1.6], y: [0, 0], w: [1.6, 3.4], h: [0.5, 1.2], c: ['#e0b872', '#d4a55c'] },
      { k: 'octa', seed: 11, d: 0.25, off: [0, 0.8], y: [0, 0], w: [0.4, 0.8], h: [0.3, 0.6], c: ['#8d6e4b', '#a0805a'], tilt: 0.6 },
    ],
    parts: { n: 85, c: '#ffe2a8', s: 0.085, kind: 'sand', vy: 0.05, vx: 0.95, amp: 0.5, freq: 2.0, a: 0.5, glow: 1.15 },
  },
  hielo: {
    glass: '#bfeaff', rib: '#eaffff', rail: '#bff3ff',
    banner: { c: ['#4fc3f7', '#b3e5fc', '#ffffff'] },
    lamp: { c: '#d8f6ff', pole: '#4d6f82' },
    arch: { c: '#54798e' },
    props: [
      { k: 'cone', seed: 12, d: 0.45, off: [0, 0.2], y: [0, 0], w: [0.3, 0.6], h: [1, 3], c: ['#cfefff', '#9edcff'], a: 0.82, tilt: 0.3 },
      { k: 'sphere', seed: 13, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.5, 1], h: [0.4, 0.8], c: ['#e8f7ff'], top: true },
    ],
    parts: { n: 115, c: '#e8f9ff', s: 0.095, kind: 'snow', vy: -0.65, vx: 0.14, amp: 0.6, freq: 1.4, a: 0.65, glow: 1.15 },
  },
  volcan: {
    glass: '#ff9a6a', rib: '#ff5a1f', rail: '#ff7a2f',
    banner: { c: ['#b71c1c', '#ff5722', '#ffb300'] },
    lamp: { c: '#ff8a3d', pole: '#2e1d1a' },
    arch: { c: '#3d2420' },
    props: [
      { k: 'octa', seed: 14, d: 0.35, off: [0, 0.6], y: [0, 0], w: [0.4, 0.9], h: [0.3, 0.7], c: ['#ff4d1a', '#ff8a2f'], e: 1.35, tilt: 0.6 },
      { k: 'octa', seed: 15, d: 0.35, off: [0, 1.2], y: [0, 0], w: [0.7, 1.5], h: [0.6, 1.5], c: ['#2b1b17', '#3a2620'], tilt: 0.5 },
      { k: 'cone', seed: 16, d: 0.2, off: [0, 0.3], y: [0, 0], w: [0.3, 0.6], h: [1, 2.4], c: ['#5a2a1a'], top: true },
    ],
    parts: { n: 105, c: '#ff7b29', s: 0.105, kind: 'embers', vy: 1.05, vx: 0.2, amp: 0.55, freq: 2.4, a: 0.65, glow: 1.35 },
  },
  cristal: {
    glass: '#b8a1ff', rib: '#a78bff', rail: '#b8a1ff',
    banner: { c: ['#7e57c2', '#4dd0e1', '#f48fb1'] },
    lamp: { c: '#d8c4ff', pole: '#3a3352' },
    arch: { c: '#483f66' },
    props: [
      { k: 'octa', seed: 17, d: 0.45, off: [0, 0.3], y: [0, 0], w: [0.3, 0.6], h: [0.8, 2.4], c: ['#7df9ff', '#ff7de9', '#a78bff', '#7dffb2'], e: 1.3, a: 0.82, tilt: 0.3 },
      { k: 'sphere', seed: 18, d: 0.2, off: [0.5, 2.5], y: [0, 0], w: [0.18, 0.32], h: [0.18, 0.32], c: ['#e6dcff'], e: 1.35 },
    ],
    parts: { n: 90, c: '#d4c2ff', s: 0.105, kind: 'sparkles', vy: 0.12, vx: 0.1, amp: 0.5, freq: 2.2, a: 0.6, glow: 1.3 },
  },
  nubes: {
    glass: '#ffffff', rib: '#fff2a8', rail: '#fff2a8',
    banner: { c: ['#ffd54f', '#90caf9', '#f8bbd0'] },
    lamp: { c: '#fff0a0', pole: '#6b758a' },
    arch: { c: '#7a8499' },
    props: [
      { k: 'sphere', seed: 19, d: 0.4, off: [0.2, 2.4], y: [0, 0], w: [0.9, 2], h: [0.7, 1.4], c: ['#ffffff', '#f1f7ff'], a: 0.88 },
      { k: 'torus', seed: 20, d: 0.1, off: [0, 0], y: [0, 0], w: [1.7, 1.7], h: [1, 1], c: ['#ffd54a'], e: 1.25, ring: true },
      { k: 'sphere', seed: 21, d: 0.25, off: [0.5, 3], y: [0, 0], w: [0.15, 0.3], h: [0.15, 0.3], c: ['#fff7b0'], e: 1.25 },
    ],
    parts: { n: 65, c: '#fff6cc', s: 0.12, kind: 'feathers', vy: -0.15, vx: 0.22, amp: 0.75, freq: 1.1, a: 0.55, glow: 1.15 },
  },
  neon: {
    glass: '#2bffe8', rib: '#ff2bd6', rail: '#2bffe8',
    banner: { c: ['#ff2bd6', '#2bffe8', '#ffe600'] },
    lamp: { c: '#2bffe8', pole: '#1c2233' },
    arch: { c: '#222a40' },
    props: [
      { k: 'torus', seed: 22, d: 0.16, off: [0, 0], y: [0, 0], w: [1.5, 2.1], h: [1, 1], c: ['#ff2bd6', '#2bffe8', '#fff22b'], e: 1.35, ring: true },
      { k: 'cyl', seed: 23, d: 0.25, off: [0, 0.4], y: [0, 0], w: [0.1, 0.18], h: [1, 3], c: ['#2bffe8', '#ff2bd6'], e: 1.3 },
      { k: 'box', seed: 24, d: 0.2, off: [0.4, 2.4], y: [0, 0], w: [0.25, 0.5], h: [0.25, 0.5], c: ['#ff2bd6', '#2bffe8'], e: 1.3, tilt: 0.8 },
    ],
    parts: { n: 90, c: '#ff4be0', s: 0.1, kind: 'sparks', vy: 0.2, vx: 0.65, amp: 0.4, freq: 2.8, a: 0.6, glow: 1.35 },
  },
  jardin: {
    glass: '#ffd1e8', rib: '#ff8fb8', rail: '#ffd1e8',
    banner: { c: ['#ff6fa5', '#ffd24a', '#a5d6a7'] },
    lamp: { c: '#ffb8d6', pole: '#3f6340' },
    arch: { c: '#476b47' },
    props: [
      { k: 'sphere', seed: 25, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.7, 1.3], h: [0.5, 0.9], c: ['#2f8f3a', '#3fa84a'], top: true },
      { k: 'cyl', seed: 26, d: 0.6, off: [0, 0.3], y: [0, 0], w: [0.05, 0.08], h: [0.5, 0.9], c: ['#3b8f3b'], top: true, tilt: 0.2 },
      { k: 'sphere', seed: 26, d: 0.6, off: [0, 0.3], y: [0.75, 0.75], w: [0.25, 0.45], h: [0.25, 0.45], c: ['#ff6fa5', '#ffd24a', '#b06bff', '#ff8a5c'], top: true, tilt: 0.2 },
    ],
    parts: { n: 75, c: '#ffc2df', s: 0.11, kind: 'petals', vy: -0.35, vx: 0.25, amp: 0.85, freq: 1.3, a: 0.65, glow: 1.2 },
  },
}
