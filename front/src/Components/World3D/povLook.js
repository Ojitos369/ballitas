// Lógica pura de la mirada POV (sin three): offset de yaw limitado al cono frontal y decaimiento a 0.
export const POV_YAW_MAX = (75 * Math.PI) / 180
export const POV_IDLE_DECAY_S = 1.5 // segundos sin input antes de volver a seguir el camino
export const POV_DECAY_RATE = 3 // 1/s, retorno suave del offset
export const POV_CENTER_RATE = 8 // 1/s, retorno al pulsar centrar

const TWO_PI = Math.PI * 2

// Diferencia angular envuelta a (-PI, PI]: sin saltos al cruzar ±180°.
export function angleDiff(a, b) {
  const d = (((a - b) % TWO_PI) + TWO_PI) % TWO_PI
  return d > Math.PI ? d - TWO_PI : d
}

export function wrapAngle(a) {
  return ((a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI
}

// Offset de yaw respecto al camino: envuelto y limitado, nunca mira hacia atrás.
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
