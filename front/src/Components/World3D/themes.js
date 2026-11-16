// Aspecto de cada camino (los datos de juego viven en Core/world.js).
// glass: tinte del cristal; rib: costillas y aros; rail: riel emisivo, estela y partículas.
// props: decoración instanciada alrededor del tubo.
//   k geometría, seed (mismo seed = misma posición, para componer árboles), d densidad por unidad de tubo,
//   off distancia entre la pared del tubo y la base del objeto, y desplazamiento extra hacia fuera,
//   w/h tamaño, c colores, e brillo (bloom), a opacidad, top (solo sobre el lomo del tubo y creciendo
//   hacia arriba), tilt inclinación al azar, ring (aro que abraza el tubo; w = múltiplo del radio).
export const VISUALS = {
  sombrio: {
    glass: '#7a5cc0', rib: '#8a5cf0', rail: '#a24bff',
    props: [
      { k: 'cyl', seed: 1, d: 0.22, off: [0, 0.4], y: [0, 0], w: [0.1, 0.18], h: [1.6, 3.2], c: ['#17121f'], top: true, tilt: 0.25 },
      { k: 'cone', seed: 1, d: 0.22, off: [0, 0.4], y: [1.4, 1.4], w: [0.6, 1], h: [0.8, 1.4], c: ['#221a30'], top: true, tilt: 0.25 },
      { k: 'box', seed: 2, d: 0.15, off: [0, 0.3], y: [0, 0], w: [0.3, 0.45], h: [0.5, 1], c: ['#4a4a5e'], top: true, tilt: 0.2 },
      { k: 'sphere', seed: 3, d: 0.25, off: [0.4, 2.2], y: [0, 0], w: [0.2, 0.34], h: [0.2, 0.34], c: ['#b784ff', '#7a5cff'], e: 1, a: 0.8 },
    ],
    parts: { n: 90, c: '#9b6bff', s: 0.1 },
  },
  bosque: {
    glass: '#7fe09a', rib: '#4caf50', rail: '#9cff6b',
    props: [
      { k: 'cyl', seed: 4, d: 0.3, off: [0, 0.3], y: [0, 0], w: [0.2, 0.3], h: [1, 1.5], c: ['#6b4426'], top: true, tilt: 0.12 },
      { k: 'cone', seed: 4, d: 0.3, off: [0, 0.3], y: [0.9, 0.9], w: [1.2, 1.8], h: [1.6, 2.5], c: ['#2e7d32', '#3f9b46', '#1b5e20'], top: true, tilt: 0.12 },
      { k: 'cone', seed: 4, d: 0.3, off: [0, 0.3], y: [1.8, 1.8], w: [0.9, 1.3], h: [1.2, 1.7], c: ['#43a047', '#2e7d32'], top: true, tilt: 0.12 },
      { k: 'sphere', seed: 5, d: 0.3, off: [0, 0.2], y: [0, 0], w: [0.35, 0.6], h: [0.22, 0.34], c: ['#e53935', '#ff7043'], top: true },
    ],
    parts: { n: 70, c: '#d4ff5a', s: 0.12 },
  },
  mar: {
    glass: '#5fc4f0', rib: '#7fe0ff', rail: '#7fe0ff',
    props: [
      { k: 'cone', seed: 6, d: 0.35, off: [0, 0.3], y: [0, 0], w: [0.25, 0.55], h: [0.6, 1.5], c: ['#ff6f91', '#ff9671', '#ffc75f'], tilt: 0.3 },
      { k: 'sphere', seed: 7, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.8, 1.6], h: [0.3, 0.6], c: ['#2a8fd6', '#5fc4f0', '#e6fbff'], a: 0.9 },
      { k: 'sphere', seed: 8, d: 0.4, off: [0.3, 3], y: [0, 0], w: [0.15, 0.4], h: [0.15, 0.4], c: ['#bff3ff'], e: 1, a: 0.5 },
    ],
    parts: { n: 90, c: '#bff3ff', s: 0.09 },
  },
  desierto: {
    glass: '#f0cf8a', rib: '#ffb347', rail: '#ffd27a',
    props: [
      { k: 'cyl', seed: 9, d: 0.2, off: [0, 0.3], y: [0, 0], w: [0.25, 0.4], h: [0.9, 1.9], c: ['#3f8f4a', '#2f7a3e'], top: true, tilt: 0.1 },
      { k: 'sphere', seed: 9, d: 0.2, off: [0, 0.3], y: [1, 1.8], w: [0.3, 0.45], h: [0.3, 0.45], c: ['#ff7aa8'], top: true },
      { k: 'sphere', seed: 10, d: 0.3, off: [0.4, 1.6], y: [0, 0], w: [1.6, 3.4], h: [0.5, 1.2], c: ['#e0b872', '#d4a55c'] },
      { k: 'octa', seed: 11, d: 0.25, off: [0, 0.8], y: [0, 0], w: [0.4, 0.8], h: [0.3, 0.6], c: ['#8d6e4b', '#a0805a'], tilt: 0.6 },
    ],
    parts: { n: 80, c: '#ffe2a8', s: 0.08 },
  },
  hielo: {
    glass: '#bfeaff', rib: '#eaffff', rail: '#bff3ff',
    props: [
      { k: 'cone', seed: 12, d: 0.45, off: [0, 0.2], y: [0, 0], w: [0.3, 0.6], h: [1, 3], c: ['#cfefff', '#9edcff'], a: 0.85, tilt: 0.3 },
      { k: 'sphere', seed: 13, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.5, 1], h: [0.4, 0.8], c: ['#ffffff'], top: true },
    ],
    parts: { n: 110, c: '#ffffff', s: 0.09 },
  },
  volcan: {
    glass: '#ff9a6a', rib: '#ff5a1f', rail: '#ff7a2f',
    props: [
      { k: 'octa', seed: 14, d: 0.35, off: [0, 0.6], y: [0, 0], w: [0.4, 0.9], h: [0.3, 0.7], c: ['#ff4d1a', '#ff8a2f'], e: 1, tilt: 0.6 },
      { k: 'octa', seed: 15, d: 0.35, off: [0, 1.2], y: [0, 0], w: [0.7, 1.5], h: [0.6, 1.5], c: ['#2b1b17', '#3a2620'], tilt: 0.5 },
      { k: 'cone', seed: 16, d: 0.2, off: [0, 0.3], y: [0, 0], w: [0.3, 0.6], h: [1, 2.4], c: ['#5a2a1a'], top: true },
    ],
    parts: { n: 100, c: '#ff9a3c', s: 0.1 },
  },
  cristal: {
    glass: '#b8a1ff', rib: '#a78bff', rail: '#b8a1ff',
    props: [
      { k: 'octa', seed: 17, d: 0.45, off: [0, 0.3], y: [0, 0], w: [0.3, 0.6], h: [0.8, 2.4], c: ['#7df9ff', '#ff7de9', '#a78bff', '#7dffb2'], e: 1, a: 0.85, tilt: 0.3 },
      { k: 'sphere', seed: 18, d: 0.2, off: [0.5, 2.5], y: [0, 0], w: [0.18, 0.32], h: [0.18, 0.32], c: ['#ffffff'], e: 1 },
    ],
    parts: { n: 90, c: '#e0d4ff', s: 0.1 },
  },
  nubes: {
    glass: '#ffffff', rib: '#fff2a8', rail: '#fff2a8',
    props: [
      { k: 'sphere', seed: 19, d: 0.4, off: [0.2, 2.4], y: [0, 0], w: [0.9, 2], h: [0.7, 1.4], c: ['#ffffff', '#f1f7ff'], a: 0.92 },
      { k: 'torus', seed: 20, d: 0.1, off: [0, 0], y: [0, 0], w: [1.7, 1.7], h: [1, 1], c: ['#ffd54a'], e: 1, ring: true },
      { k: 'sphere', seed: 21, d: 0.25, off: [0.5, 3], y: [0, 0], w: [0.15, 0.3], h: [0.15, 0.3], c: ['#fff7b0'], e: 1 },
    ],
    parts: { n: 60, c: '#ffffff', s: 0.12 },
  },
  neon: {
    glass: '#2bffe8', rib: '#ff2bd6', rail: '#2bffe8',
    props: [
      { k: 'torus', seed: 22, d: 0.16, off: [0, 0], y: [0, 0], w: [1.5, 2.1], h: [1, 1], c: ['#ff2bd6', '#2bffe8', '#fff22b'], e: 1, ring: true },
      { k: 'cyl', seed: 23, d: 0.25, off: [0, 0.4], y: [0, 0], w: [0.1, 0.18], h: [1, 3], c: ['#2bffe8', '#ff2bd6'], e: 1 },
      { k: 'box', seed: 24, d: 0.2, off: [0.4, 2.4], y: [0, 0], w: [0.25, 0.5], h: [0.25, 0.5], c: ['#ff2bd6', '#2bffe8'], e: 1, tilt: 0.8 },
    ],
    parts: { n: 90, c: '#ff2bd6', s: 0.1 },
  },
  jardin: {
    glass: '#ffd1e8', rib: '#ff8fb8', rail: '#ffd1e8',
    props: [
      { k: 'sphere', seed: 25, d: 0.25, off: [0, 0.2], y: [0, 0], w: [0.7, 1.3], h: [0.5, 0.9], c: ['#2f8f3a', '#3fa84a'], top: true },
      { k: 'cyl', seed: 26, d: 0.6, off: [0, 0.3], y: [0, 0], w: [0.05, 0.08], h: [0.5, 0.9], c: ['#3b8f3b'], top: true, tilt: 0.2 },
      { k: 'sphere', seed: 26, d: 0.6, off: [0, 0.3], y: [0.75, 0.75], w: [0.25, 0.45], h: [0.25, 0.45], c: ['#ff6fa5', '#ffd24a', '#b06bff', '#ff8a5c'], top: true, tilt: 0.2 },
    ],
    parts: { n: 70, c: '#ffd1e8', s: 0.11 },
  },
}
