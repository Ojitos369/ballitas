// Personalidad y expresividad: rasgos del genoma -> arquetipo, voz, estado de ánimo y gestos de la cara.

export const TRAIT_LABEL = {
  valentia: ['Miedosa', 'Valiente'],
  curiosidad: ['Rutinaria', 'Curiosa'],
  apetito: ['Ascética', 'Glotona'],
  sociabilidad: ['Solitaria', 'Sociable'],
  animo: ['Gruñona', 'Alegre'],
}

// Prefijo de voz por rasgo dominante: [bajo, alto]
export const TONE = {
  valentia: ['Ay… ', '¡Sin miedo! '],
  curiosidad: ['Mmh. ', 'Ooh, '],
  apetito: ['Meh. ', 'Ñam, '],
  sociabilidad: ['(a solas) ', '¡Amigos! '],
  animo: ['Tsk. ', '¡Yupi! '],
}

export const BASE = {
  nace: ['¡Hola, mundo!', 'Acabo de rodar hasta aquí.'],
  llega: ['Llegué a {n}.', 'Así que esto es {n}.'],
  ganaP: ['Conseguí puntos en {s}.', '¡{s} suma!'],
  ganaE: ['Recargo energía en {s}.', '{s} me sienta de maravilla.'],
  camino: ['Voy a {n} por el {c}.', 'Toca el {c}.'],
  hambre: ['Se me acaba la energía…', 'Necesito descansar.'],
  miedo: ['Me quedan pocos puntos…', 'Esto no pinta bien.'],
  muere: ['Adiós, mundo…', 'Me apago…'],
  // obstáculos llamativos del circuito (la clave es el `kind` del tramo)
  canon: ['¡Fueeego!', '¡Salgo disparada!'],
  trampolin: ['¡Boing, boing!', '¡Qué bote!'],
  rizo: ['¡Cabeza abajo!', '¡Otra vuelta!'],
  caida: ['¡Aaaah, caigo!', '¡Al vacío!'],
  embudo: ['Vueltas y vueltas…', 'Me mareo…'],
  geiser: ['¡Al chorro del géiser!', '¡Arriba voy!'],
  erupcion: ['¡Erupción! ¡A volar!', '¡El cráter me lanza!'],
  turbina: ['¡Viento de lado!', '¡Qué impulso!'],
  hielo_resbaloso: ['¡Qué rápido patina!', '¡A toda velocidad!'],
  pantano: ['Uy, qué pegajoso…', 'Me frena el pantano…'],
  portal: ['¡Salto espacial!', '¡Teletransporte!'],
  cascada: ['¡Por la cascada!', '¡Agua va!'],
  carril: ['¡Cambio de carril por {m}!', '¡Por la pared gracias a {m}!'],
  falla: ['¡Uy, me caí en {m}!', '¡Falló {m}!', '¡Al suelo otra vez por {m}!'],
}

const EMOJI = {
  nace: '👋', llega: '📍', ganaP: '⭐', ganaE: '⚡', camino: '🧭', hambre: '😴', miedo: '😟', muere: '💤',
  canon: '💥', trampolin: '🤸', rizo: '➰', caida: '🪂', embudo: '🌪️',
  geiser: '⛲', erupcion: '🌋', turbina: '💨', hielo_resbaloso: '🧊', pantano: '🫧',
  portal: '🟣', cascada: '🌊', carril: '↔️', falla: '😵',
}

export function archetype(genome) {
  const t = genome.traits
  const ranked = Object.keys(TRAIT_LABEL).sort((a, b) => Math.abs(t[b] - 0.5) - Math.abs(t[a] - 0.5))
  const top = ranked[0]
  const labels = ranked.slice(0, 2).map((k) => TRAIT_LABEL[k][t[k] >= 0.5 ? 1 : 0])
  return { key: top, hi: t[top] >= 0.5, title: labels.join(' y ') }
}

export function voice(b, event, ctx, rng) {
  const lines = BASE[event]
  const line = lines[Math.floor(rng() * lines.length)].replace(/\{(\w)\}/g, (_, k) => ctx[k] ?? '')
  const tone = TONE[b.arch.key][b.arch.hi ? 1 : 0]
  // el tono sólo se aplica a veces para que no suene a disco rayado
  return { text: (rng() < 0.6 ? tone : '') + line, emoji: EMOJI[event] }
}

export function moodOf(b) {
  if (b.p < 18 && b.e < 18) return 'asustada'
  if (b.p < 30 && b.e < 30) return 'mareada'
  if (b.e < 30) return 'cansada'
  if (b.p < 30) return 'preocupada'
  if (b.p > 80 && b.e > 70) return 'euforica'
  return 'feliz'
}

// Parámetros de la cara por ánimo: ojos (apertura), cejas (ángulo rad), boca (curva -1..1), rubor, sudor, rebote.
export const FACES = {
  feliz: { eye: 1, brow: 0, mouth: 0.7, blush: 0.4, sweat: 0, bounce: 1, emoji: '😊' },
  euforica: { eye: 1.15, brow: 0.05, mouth: 1, blush: 0.9, sweat: 0, bounce: 1.8, emoji: '🤩' },
  cansada: { eye: 0.35, brow: -0.25, mouth: -0.2, blush: 0, sweat: 0, bounce: 0.4, emoji: '😴' },
  preocupada: { eye: 1.1, brow: -0.5, mouth: -0.6, blush: 0, sweat: 1, bounce: 0.7, emoji: '😟' },
  mareada: { eye: 0.6, brow: -0.35, mouth: -0.35, blush: 0, sweat: 1, bounce: 0.5, emoji: '😵' },
  asustada: { eye: 1.35, brow: -0.7, mouth: -0.9, blush: 0, sweat: 1, bounce: 1.2, emoji: '😱' },
}

// Familias de skin por arquetipo dominante (5 rasgos × alto/bajo).
export const SKIN_FAMILIES = {
  'valentia:1': { id: 'pirata', name: 'Pirata', emoji: '🏴‍☠️' },
  'valentia:0': { id: 'miedosa', name: 'Conejito temblón', emoji: '🐰' },
  'curiosidad:1': { id: 'maga', name: 'Maga', emoji: '🧙' },
  'curiosidad:0': { id: 'rutinaria', name: 'Boina clásica', emoji: '🥐' },
  'apetito:1': { id: 'zombi', name: 'Zombi glotona', emoji: '🧟' },
  'apetito:0': { id: 'ascetica', name: 'Monje zen', emoji: '😇' },
  'sociabilidad:1': { id: 'gatita', name: 'Gatita', emoji: '🐱' },
  'sociabilidad:0': { id: 'solitaria', name: 'Encapuchada', emoji: '🕶️' },
  'animo:1': { id: 'alegre', name: 'Estrellita', emoji: '🌟' },
  'animo:0': { id: 'elfa', name: 'Elfa gruñona', emoji: '🧝' },
}

export function skinFamily(genomeOrArch) {
  const a = genomeOrArch?.traits ? archetype(genomeOrArch) : genomeOrArch
  const k = `${a?.key ?? 'animo'}:${a?.hi ? 1 : 0}`
  return SKIN_FAMILIES[k] ?? SKIN_FAMILIES['animo:1']
}

export const PLAN_REASONS = {
  'busco energía': '⚡',
  'quiero puntos': '⭐',
  'ruta inexplorada': '🧭',
  'seguir al grupo': '🤝',
  'evitar multitudes': '🫧',
  'busco adrenalina': '🔥',
  'camino seguro': '🛡️',
  'me apetece velocidad': '💨',
  'explorar circuito': '🗺️',
}

export const TRAIT_KEYS = ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']

// Metadatos de presets de skin asociados a los arquetipos clásicos (incluye los 6 personajes de la hoja chibi).
export const SKIN_PRESETS = {
  elfa: { id: 'elfa', name: 'Elfa gruñona', emoji: '🧝', trait: 'animo', hi: false, baseHue: 0.28 },
  gatita: { id: 'gatita', name: 'Gatita', emoji: '🐱', trait: 'sociabilidad', hi: true, baseHue: 0.08 },
  maga: { id: 'maga', name: 'Maga', emoji: '🧙', trait: 'curiosidad', hi: true, baseHue: 0.74 },
  pirata: { id: 'pirata', name: 'Pirata', emoji: '🏴‍☠️', trait: 'valentia', hi: true, baseHue: 0.05 },
  zombi: { id: 'zombi', name: 'Zombi glotona', emoji: '🧟', trait: 'apetito', hi: true, baseHue: 0.31 },
  ascetica: { id: 'ascetica', name: 'Monje zen', emoji: '😇', trait: 'apetito', hi: false, baseHue: 0.07 },
  miedosa: { id: 'miedosa', name: 'Conejito temblón', emoji: '🐰', trait: 'valentia', hi: false, baseHue: 0.56 },
  rutinaria: { id: 'rutinaria', name: 'Boina clásica', emoji: '🥐', trait: 'curiosidad', hi: false, baseHue: 0.1 },
  solitaria: { id: 'solitaria', name: 'Encapuchada', emoji: '🕶️', trait: 'sociabilidad', hi: false, baseHue: 0.65 },
  alegre: { id: 'alegre', name: 'Estrellita', emoji: '🌟', trait: 'animo', hi: true, baseHue: 0.13 },
}

// Resume los rasgos del genoma con su intensidad dominante y ranking para reglas de coherencia visual.
export function traitProfile(genome) {
  const t = genome?.traits ?? {}
  const ranked = Object.keys(TRAIT_LABEL)
    .map((key) => {
      const val = t[key] ?? 0.5
      return { key, val, hi: val >= 0.5, dist: Math.abs(val - 0.5) }
    })
    .sort((a, b) => b.dist - a.dist)
  const top = ranked[0] ?? { key: 'animo', val: 0.5, hi: true, dist: 0 }
  return {
    traits: t,
    ranked,
    dominant: top.key,
    dominantHi: top.hi,
    dominance: top.dist,
    secondary: ranked[1] ?? top,
  }
}



