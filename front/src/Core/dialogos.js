// Repertorio ampliado de diálogos contextuales y con memoria para Ballitas.
// No modifica personality.js ni rompe voice(); complementa la UI (Ballita.jsx y Detail.jsx).

import { skinFamily } from './personality.js'

export const EMOJI_EVENTO = {
  nace: '👋',
  llega: '📍',
  ganaP: '⭐',
  ganaE: '⚡',
  camino: '🧭',
  hambre: '😴',
  miedo: '😟',
  muere: '💤',
  // Obstáculos clásicos
  salida: '🚀',
  llegada: '🏁',
  rampa: '🛝',
  horquilla: '↩️',
  rizo: '➰',
  sacacorchos: '🧬',
  trampolin: '🤸',
  canon: '💥',
  espiral: '🌀',
  caida: '🪂',
  cascada: '🌊',
  embudo: '🌪️',
  // Eventos y obstáculos nuevos
  geiser: '⛲',
  erupcion: '🌋',
  turbina: '💨',
  hielo_resbaloso: '🧊',
  pantano: '🫧',
  portal: '🟣',
  // Contexto dinámico
  velocidad_rapida: '⚡',
  velocidad_lenta: '🐢',
  cerca_ballita: '💬',
  plan: '💡',
}

export const EVENT_LINES = {
  nace: [
    '¡Hola, mundo redondo!',
    'Acabo de rodar hasta aquí.',
    '¡Qué brillante se ve todo!',
    'Listísima para rodar sin parar.',
    '¡Alguien sabe dónde está la rampa?',
    'Recién salida del horno cósmico.',
  ],
  llega: [
    '¡Por fin llegué a {n}!',
    'Así que esto es {n}… qué vistas.',
    'Aterrizaje suave en {n}.',
    '¡Hola, {n}! Ya estoy aquí.',
    'Un planeta más en mi bitácora: {n}.',
  ],
  ganaP: [
    '¡Puntos fresquitos en {s}!',
    '¡{s} suma un montón!',
    '¡Toma ya, más puntos en {s}!',
    'Esto en {s} sí que vale la pena.',
    '¡Brillo total gracias a {s}!',
  ],
  ganaE: [
    '¡Batería al cien en {s}!',
    '{s} me recarga las pilas.',
    '¡Qué gusto da pasar por {s}!',
    'Energía pura saliendo de {s}.',
    'Con esto en {s} ruedo hasta mañana.',
  ],
  camino: [
    'Rumbo a {n} por el {c}.',
    '¡Nos vemos en {n}! Tomo el {c}.',
    'Toca cruzar el {c} hacia {n}.',
    '¡Siguiente parada: {n}!',
    'A ver qué sorpresas guarda el {c}.',
  ],
  hambre: [
    'Me quedo sin pilas…',
    'Necesito recargar ya…',
    'Uf, qué pesada me siento…',
    '¿Hay algún cargador cerca?',
    'Mis patitas piden un descanso.',
  ],
  miedo: [
    'Me quedan pocos puntos…',
    'Esto se está poniendo feo…',
    'Necesito puntos urgente.',
    '¡Ay, no quiero desaparecer!',
    'Tiemblo hasta las mejillas…',
  ],
  muere: [
    'Adiós, mundo… fue divertido rodar.',
    'Me apago despacito…',
    'Buenas noches, universo…',
    'Hasta la próxima generación…',
  ],
  salida: [
    '¡Tres, dos, uno… lanzada!',
    '¡Allá voy a toda pastilla!',
    '¡Agárrense que salgo!',
    '¡Despegue del tubo!',
  ],
  llegada: [
    '¡Meta a la vista!',
    '¡Llegando a puerto!',
    '¡Qué viajazo me acabo de pegar!',
    '¡Frenando con estilo!',
  ],
  canon: [
    '¡Fueeego! ¡Salgo volando!',
    '¡Pum! ¡Adiós tubo!',
    '¡Modo bala activado!',
    '¡Por los aires sin frenos!',
    '¡Disparo directo al cielo!',
  ],
  trampolin: [
    '¡Boing, boing, boing!',
    '¡Qué pedazo de salto!',
    '¡Toco las estrellas y vuelvo!',
    '¡Rebote perfecto!',
    '¡Wheee, floto en el aire!',
  ],
  rizo: [
    '¡Cabeza abajo, qué locura!',
    '¡La gravedad hoy no manda!',
    '¡Looping de campeonato!',
    '¡El mundo da vueltas!',
    '¡Otra vuelta más!',
  ],
  caida: [
    '¡Aaaah, que me caigooo!',
    '¡Al vacío sin paracaídas!',
    '¡Siento mariposas en la panza!',
    '¡Suelo, acércate despacio!',
    '¡Vértigo máximo!',
  ],
  embudo: [
    'Vueltas y vueltas sin fin…',
    '¡Me estoy mareandooo!',
    '¡Como agua por el desagüe!',
    '¡Gira que te gira!',
    '¿Dónde quedó el norte?',
  ],
  cascada: [
    '¡Splash! ¡Qué fresquita el agua!',
    '¡Bajada con espuma y burbujas!',
    '¡Cuidado que salpica!',
    '¡Tobogán acuático espacial!',
    '¡Gluglú, qué chorro tan rico!',
  ],
  espiral: [
    '¡Hélice infinita!',
    '¡Enroscada como un resorte!',
    '¡Bajando en tirabuzón!',
    '¡Qué curvas tan elegantes!',
  ],
  sacacorchos: [
    '¡Giro doble en el aire!',
    '¡Parecemos un sacacorchos!',
    '¡Tornillo cósmico a toda velocidad!',
    '¡Izquierda, derecha, vuelta!',
  ],
  horquilla: [
    '¡Horquilla! ¡Media vuelta!',
    '¡Curva cerrada, a frenar!',
    '¡Me pego a la pared en la vuelta!',
    '¡Qué curvón!',
  ],
  rampa: [
    '¡Deslizamiento suave!',
    '¡Qué gustito da esta rampa!',
    '¡Patinando cuesta abajo!',
  ],
  // ── NUEVOS EVENTOS ──
  geiser: [
    '¡Chorro arriba! ¡Me lanza el géiser!',
    '¡Pshhh! ¡Vapor a presión!',
    '¡El géiser me manda por los aires!',
    '¡Agua caliente y vuelo gratis!',
    '¡Qué empujón tan brutal del géiser!',
    '¡Surfeando la columna de vapor!',
  ],
  erupcion: [
    '¡BOOM! ¡Erupción volcánica!',
    '¡Chispas por todas partes!',
    '¡El cráter me disparó al espacio!',
    '¡Caliente, caliente, qué salto!',
    '¡Lava abajo, yo arriba volando!',
    '¡Súper eyección volcánica!',
  ],
  turbina: [
    '¡Fiuuu! ¡Menudo ventarrón!',
    '¡La turbina me empuja de lado!',
    '¡Aire a mil por hora!',
    '¡Me despeino con este viento!',
    '¡Impulso lateral turbo!',
    '¡Viento de cola, qué velocidad!',
  ],
  hielo_resbaloso: [
    '¡Fiuuu, patinando sin control!',
    '¡Hielo puro! ¡No hay quien frene!',
    '¡Brrr, qué frío y qué rápido!',
    '¡Patinaje artístico espacial!',
    '¡Resbalo como mantequilla!',
    '¡A toda pastilla sobre el hielo!',
  ],
  pantano: [
    '¡Glup… esto está súper pegajoso!',
    '¡Uf, qué lento se rueda aquí!',
    '¡Burbujas de lodo por todos lados!',
    '¡Me cuesta avanzar en este pantano!',
    '¡Chof, chof… paso a pasito!',
    '¡Paciencia, ya saldremos del barro!',
  ],
  portal: [
    '¡ZAP! ¡Teletransporte instantáneo!',
    '¡Acabo de doblar el espacio!',
    '¿Eso fue un portal? ¡Qué flash!',
    '¡Salto cuántico completado!',
    '¡De aquí a allá en un parpadeo!',
    '¡Wooo, luces de otra dimensión!',
  ],
  // ── CONTEXTO DINÁMICO ──
  velocidad_rapida: [
    '¡Voy hecha un rayo!',
    '¡Máxima velocidad, qué subidón!',
    '¡El viento me silba en las orejas!',
    '¡Ruta exprés sin mirar atrás!',
    '¡No me alcanzan ni las estrellas!',
  ],
  velocidad_lenta: [
    'Tranquilita, disfrutando el paisaje…',
    'Sin prisa, paso a paso.',
    'Ruta calmada, qué relax.',
    'Aquí se va despacito pero seguro.',
    'Respirando hondo en este tramo lento.',
  ],
  cerca_ballita: [
    '¡Hola, {other}! ¡Qué gusto verte!',
    '¡Eh, {other}, echamos una carrera?',
    '¡Cuidado {other}, que paso rodando!',
    '¡Nos cruzamos en el camino, {other}!',
    '¡Ánimo, {other}!',
  ],
  plan: [
    'Mi plan: {razon}',
    'Lo tengo claro: {razon}',
    'Decidido: {razon}',
  ],
}

// Líneas con personalidad propia según familia de skin
export const SKIN_LINES = {
  pirata: {
    _idle: ['¡Arrr, a por el tesoro!', '¡Viento en popa, grumete!'],
    canon: ['¡Al abordaje por los aires!', '¡Disparo de cañón pirata!'],
    geiser: ['¡Un géiser marino, arr!', '¡Por la borda hacia el cielo!'],
    erupcion: ['¡Fuego en la cubierta!', '¡Más pólvora que mi barco!'],
    cascada: ['¡Agua salada a la vista!', '¡Surfeando la ola, arr!'],
    hielo_resbaloso: ['¡Iceberg a estribor!', '¡Resbalo más que en cubierta mojada!'],
    pantano: ['¡Encallada en el lodo!', '¡Remen fuerte, marineros!'],
    portal: ['¡Un atajo secreto de corsarios!'],
    cerca_ballita: ['¡Ahoy, {other}!', '¡Comparte el botín, {other}!'],
  },
  miedosa: {
    _idle: ['Ay, ay, ay… espero no caerme.', '¿Segura que este tubo aguanta?'],
    caida: ['¡NOOO, MIS OREJITAS TIEMBLAN!', '¡Sálvenmeeee!'],
    erupcion: ['¡FUEGOOO! ¡Quiero volver a casa!', '¡Socorro, el volcán me lanzó!'],
    geiser: ['¡Ay! ¡El agua me empujó muy alto!'],
    turbina: ['¡Me lleva el viento, auxilio!'],
    hielo_resbaloso: ['¡No puedo frenar, qué susto!'],
    pantano: ['Al menos aquí no voy tan rápido… uf.'],
    portal: ['¿¡Dónde estoy ahora!? ¡Qué miedo!'],
    cerca_ballita: ['¡{other}, no me dejes sola!'],
  },
  maga: {
    _idle: ['Siento vibraciones arcanas…', '¡Magia en cada curva!'],
    portal: ['¡Hechizo de teletransporte perfecto!', '¡Mi especialidad: portales!'],
    erupcion: ['¡Conjuro de fuego natural!', '¡Qué energía tan mística!'],
    geiser: ['¡Alquimia de agua y vapor!'],
    turbina: ['¡Vientos etéreos a mi favor!'],
    cascada: ['¡Poción de cascada brillante!'],
    cerca_ballita: ['¡Saludos mágicos, {other}!'],
  },
  rutinaria: {
    _idle: ['Todo según el horario previsto.', 'Paso a paso, sin sorpresas.'],
    pantano: ['Un retraso de 3 segundos en el cronograma.'],
    hielo_resbaloso: ['¡Demasiada velocidad para mi agenda!'],
    portal: ['¡Esto no estaba en el mapa oficial!'],
    cascada: ['Hum, humedad dentro de los parámetros.'],
    cerca_ballita: ['Buenos días, {other}. Circulando.'],
  },
  zombi: {
    _idle: ['Mmm… ¿hay snacks en el planeta?', 'Ruedo por comida… ñam…'],
    pantano: ['¡Lodo fresquito! Me recuerda a casa.', 'Mmm, burbujas…'],
    erupcion: ['¡Asadito al carbón!'],
    geiser: ['¡Baño termal gratis!'],
    hielo_resbaloso: ['¡Frío para conservarme fresca!'],
    cerca_ballita: ['Hola {other}… ¿tienes galletas?'],
  },
  ascetica: {
    _idle: ['Paz interior en movimiento.', 'Fluir como el cosmos.'],
    pantano: ['La lentitud enseña paciencia.', 'Acepto la calma del barro.'],
    erupcion: ['Incluso el fuego es armonía.'],
    portal: ['Todo está conectado en un punto.'],
    cascada: ['El agua fluye sin esfuerzo.'],
    cerca_ballita: ['Que la paz te acompañe, {other}.'],
  },
  gatita: {
    _idle: ['¡Miau! ¡A rodar se ha dicho!', '¡Purrr, qué bonito día!'],
    cascada: ['¡Miau, agua noooo! ¡Me mojo!', '¡Fuchi, agua por todas partes!'],
    geiser: ['¡Miau! ¡Susto acuático!'],
    hielo_resbaloso: ['¡Patitas patinando, miau!'],
    trampolin: ['¡Salto felino perfecto!'],
    turbina: ['¡Mis bigotes vuelan al viento!'],
    cerca_ballita: ['¡Miauu, {other}! ¡Juguemos!'],
  },
  solitaria: {
    _idle: ['Mejor sola que mal acompañada.', 'Silencio y velocidad…'],
    portal: ['Desaparecer en un segundo. Ideal.'],
    turbina: ['El viento borra mis huellas.'],
    hielo_resbaloso: ['Nadie me alcanza aquí.'],
    cerca_ballita: ['Oh, {other}… hola, supongo.', 'Espacio personal, {other}.'],
  },
  alegre: {
    _idle: ['¡Yupi! ¡Todo es una fiesta!', '¡Brillos y sonrisas!'],
    trampolin: ['¡Súper salto estelar!'],
    erupcion: ['¡Fuegos artificiales naturales!'],
    geiser: ['¡Fuente de fiesta! ¡Wheee!'],
    portal: ['¡Magia de colores! ¡Otra vez!'],
    cascada: ['¡Arcoíris en el agua!'],
    cerca_ballita: ['¡Holaaa {other}! ¡Qué alegría verte!'],
  },
  elfa: {
    _idle: ['Tsk, qué caminos tan ruidosos…', 'Más rápido, que pierdo el tiempo.'],
    pantano: ['Ugh, ¡me mancho las botas en este lodo!', 'Qué lentitud tan molesta…'],
    hielo_resbaloso: ['Al menos esto avanza rápido.'],
    turbina: ['¡Me despeina el gorro!'],
    erupcion: ['¡Demasiado drama volcánico!'],
    cerca_ballita: ['Apártate un poco, {other}.'],
  },
}

// Memoria de líneas recientes por ballita (id -> array de textos usados)
const MEMORY_MAX = 10
const memoria = new Map()
const globosVivos = new WeakMap()
function globosDe(sim) {
  let globos = globosVivos.get(sim)
  if (!globos) { globos = new Map(); globosVivos.set(sim, globos) }
  return globos
}

function recordar(bId, texto) {
  let hist = memoria.get(bId)
  if (!hist) {
    hist = []
    memoria.set(bId, hist)
    if (memoria.size > 120) {
      const oldest = memoria.keys().next().value
      memoria.delete(oldest)
    }
  }
  hist.push(texto)
  if (hist.length > MEMORY_MAX) hist.shift()
}

function yaDicho(bId, texto) {
  const hist = memoria.get(bId)
  return hist ? hist.includes(texto) : false
}

function fmt(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '')
}

/**
 * Elige un diálogo variado y con memoria para la ballita `b` según el `event` y `ctx`.
 */
export function elegirDialogo(b, event, ctx = {}, rng = Math.random) {
  const fam = skinFamily(b.arch ?? b.genome)
  const skinSet = SKIN_LINES[fam?.id] || {}
  const basePool = EVENT_LINES[event] || EVENT_LINES.camino
  const skinPool = skinSet[event] || []
  const critical = ['muere', 'hambre', 'miedo'].includes(event)
  const idlePool = !critical && !skinPool.length && skinSet._idle && rng() < 0.25 ? skinSet._idle : []

  // Priorizar líneas del skin ~45% de las veces si existen
  let candidates = skinPool.length && rng() < 0.48
    ? skinPool
    : idlePool.length
      ? idlePool
      : basePool

  const formatted = candidates.map((tpl) => fmt(tpl, ctx))
  const fresh = formatted.filter((t) => !yaDicho(b.id, t))
  const pool = fresh.length ? fresh : formatted
  const text = pool[Math.floor(rng() * pool.length)] || '¡Rodando!'
  recordar(b.id, text)

  return {
    text,
    emoji: EMOJI_EVENTO[event] || '💭',
  }
}

/**
 * Sincroniza y genera reacciones de diálogo en vivo para una ballita.
 * Diseñado para llamarse de forma ligera desde Ballita.jsx (con throttling).
 */
export function actualizarDialogoVivo(b, sim, state) {
  const t = sim?.t ?? 0
  const globos = globosDe(sim)
  if (!state.init) {
    state.init = true
    state.lastSeg = b.seg || null
    state.lastPhase = b.phase || null
    state.lastThought = b.thought || null
    state.lastPlanRazon = b.plan?.razon || null
    state.nextSocialAt = t + 4 + (b.id % 5)
    state.nextSpeedAt = t + 6 + (b.id % 7)
  }

  // 1. Si sim.js emitió un b.thought nuevo (e.g. llega, ganaP, ganaE, hambre, miedo, muere, etc.)
  if (b.thought && b.thought !== state.lastThought) {
    state.lastThought = b.thought
    if (b.phase === 'travel') state.lastSeg = b.seg || null
    // Si coincide con un evento conocido reciente, podemos darle sabor del skin si queremos,
    // o respetar b.thought enriqueciéndolo si es un evento de obstáculo
    const ev = b.phase === 'travel' && b.seg?.kind ? b.seg.kind : null
    if (ev && EVENT_LINES[ev] && b.thought.until > t) {
      const d = elegirDialogo(b, ev, { n: sim.world?.nodes?.[b.way?.to]?.name ?? '' }, sim.rngDialogos ?? sim.rng)
      globos.set(b.id, { ...d, until: b.thought.until })
      return globos.get(b.id)
    }
    globos.set(b.id, b.thought)
    return b.thought
  }

  // 2. Reacción al entrar a un nuevo tramo/evento en travel (especialmente los nuevos)
  if (b.phase === 'travel' && b.seg && b.seg !== state.lastSeg) {
    state.lastSeg = b.seg
    const evKey = b.seg.event || b.seg.kind
    if (evKey && EVENT_LINES[evKey] && evKey !== 'rampa') {
      const d = elegirDialogo(b, evKey, {
        n: sim.world?.nodes?.[b.way?.to]?.name ?? '',
      }, sim.rngDialogos ?? sim.rng)
      const bubble = { ...d, until: t + 3.4 }
      globos.set(b.id, bubble)
      return bubble
    }
  }
  if (b.phase !== 'travel') state.lastSeg = null

  // 3. Reacción al plan (b.plan.razon si existe, defensivo)
  const razon = b.plan?.razon
  if (razon && razon !== state.lastPlanRazon) {
    state.lastPlanRazon = razon
    const d = elegirDialogo(b, 'plan', { razon }, sim.rngDialogos ?? sim.rng)
    const bubble = { ...d, until: t + 3.6 }
    globos.set(b.id, bubble)
    return bubble
  }

  // Solo disparar comentarios ambientales si no hay un globo activo ahora
  const cur = globos.get(b.id)
  if (cur && cur.until > t) return cur

  // 4. Reacción a otras ballitas cercanas
  if (t >= state.nextSocialAt && sim?.ballitas?.length > 1) {
    state.nextSocialAt = t + 7 + (b.id % 4)
    for (let i = 0; i < sim.ballitas.length; i++) {
      const other = sim.ballitas[i]
      if (other.id === b.id || other.phase === 'dying' || other.phase === 'gone') continue
      if (b.pos.distanceToSquared(other.pos) < 12.25) {
        const d = elegirDialogo(b, 'cerca_ballita', { other: other.name }, sim.rngDialogos ?? sim.rng)
        const bubble = { ...d, until: t + 3.0 }
        globos.set(b.id, bubble)
        return bubble
      }
    }
  }

  // 5. Reacción a velocidad (ruta rápida/lenta o speedK)
  if (t >= state.nextSpeedAt && b.phase === 'travel') {
    state.nextSpeedAt = t + 8 + (b.id % 5)
    const prof = b.route?.profile?.speed
    const sk = b.seg?.speedK ?? 1
    if (prof === 'rapida' || sk > 1.2 || b.speed > 20) {
      const d = elegirDialogo(b, 'velocidad_rapida', {}, sim.rngDialogos ?? sim.rng)
      const bubble = { ...d, until: t + 2.8 }
      globos.set(b.id, bubble)
      return bubble
    }
    if (prof === 'lenta' || sk < 0.8 || (b.speed > 0 && b.speed < 4.5)) {
      const d = elegirDialogo(b, 'velocidad_lenta', {}, sim.rngDialogos ?? sim.rng)
      const bubble = { ...d, until: t + 2.8 }
      globos.set(b.id, bubble)
      return bubble
    }
  }

  return cur && cur.until > t ? cur : null
}

/**
 * Obtiene el globo activo actual de una ballita (para Ballita.jsx y Detail.jsx).
 */
export function obtenerGlobo(b, sim) {
  const t = sim?.t ?? 0
  const live = sim ? globosDe(sim).get(b.id) : null
  if (live && live.until > t) return live
  if (b.thought && b.thought.until > t) return b.thought
  return live || b.thought || null
}
