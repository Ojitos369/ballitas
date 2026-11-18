// LÃ³gica pura de la mirada POV (sin three): offset de yaw limitado al cono frontal y decaimiento a 0.
export const POV_YAW_MAX = (75 * Math.PI) / 180
export const POV_IDLE_DECAY_S = 1.5 // segundos sin input antes de volver a seguir el camino
export const POV_DECAY_RATE = 3 // 1/s, retorno suave del offset
export const POV_CENTER_RATE = 8 // 1/s, retorno al pulsar centrar

const TWO_PI = Math.PI * 2

// Diferencia angular envuelta a (-PI, PI]: sin saltos al cruzar Â±180Â°.
export function angleDiff(a, b) {
  const d = (((a - b) % TWO_PI) + TWO_PI) % TWO_PI
  return d > Math.PI ? d - TWO_PI : d
}

export function wrapAngle(a) {
  return ((a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI
}

// Offset de yaw respecto al camino: envuelto y limitado, nunca mira hacia atrÃ¡s.
export function clampYaw(y, max = POV_YAW_MAX) {
  const w = wrapAngle(y)
  return w > max ? max : w < -max ? -max : w
}

// Un paso de decaimiento: tras idleS >= POV_IDLE_DECAY_S (o si centering) el valor tiende a 0.
export function decayOffset(v, h, idleS, centering = false) {
  if (!centering && idleS < POV_IDLE_DECAY_S) return v
  const out = v * Math.exp(-(centering ? POV_CENTER_RATE : POV_DECAY_RATE) * h)
  return Math.abs(out) < 1e-4 ? 0 : out
}

// Zoom continuo del POV: z 0..1. 0 = tercera persona a la espalda, POV_ZOOM_EYE = ojos de la ballita,
// 1 = ojos con zoom óptico (FOV bajo). Todo con suavizado en S: sin saltos entre tramos.
export const POV_ZOOM_EYE = 0.5
export const POV_BACK_MAX = 2.2 // distancia atrás con z = 0
export const POV_UP_MAX = 0.55 // altura extra con z = 0
export const POV_FOV_MIN = 28
const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)

export function povZoomView(z) {
  const k = smooth(clamp01(z / POV_ZOOM_EYE)) // 0 espalda ? 1 ojos
  const t = smooth(clamp01((z - POV_ZOOM_EYE) / (1 - POV_ZOOM_EYE))) // 0 ojos ? 1 zoom máximo
  const base = 68 + 7 * k
  return { back: POV_BACK_MAX * (1 - k), up: POV_UP_MAX * (1 - k), fov: base + (POV_FOV_MIN - base) * t, body: 1 - k > 0.1 }
}

// La escena escribe aquí cada cuadro si la ballita debe dibujarse en POV (tercera persona); Ballita.jsx lo lee.
export const povView = { body: false }

// Distancia minima entre una linea de camara y una envolvente esferica. Devuelve 0 si no bloquea.
export function raySpherePenetration(origin, end, center, radius) {
  const dx = end.x - origin.x
  const dy = end.y - origin.y
  const dz = end.z - origin.z
  const lenSq = dx * dx + dy * dy + dz * dz
  if (lenSq < 1e-8) return 0
  const cx = center.x - origin.x
  const cy = center.y - origin.y
  const cz = center.z - origin.z
  const t = (cx * dx + cy * dy + cz * dz) / lenSq
  if (t <= 0 || t >= 1) return 0
  const ex = cx - dx * t
  const ey = cy - dy * t
  const ez = cz - dz * t
  const penetration = radius - Math.sqrt(ex * ex + ey * ey + ez * ez)
  return penetration > 0 ? penetration : 0
}
