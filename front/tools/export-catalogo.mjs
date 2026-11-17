// Exporta los catálogos del front a back/seed/catalogo.json (el back lo siembra en SQLite).
// Uso: cd front && node tools/export-catalogo.mjs   (luego, si cambió, `python back/seed.py --force`)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SKIN_PARTS } from '../src/Components/World3D/skins.js'
import { VISUALS } from '../src/Components/World3D/themes.js'
import { THEMES } from '../src/Core/world.js'
import { SKIN_FAMILIES, SKIN_PRESETS, TRAIT_LABEL, TONE, BASE, FACES, PLAN_REASONS } from '../src/Core/personality.js'
import { EVENT_LINES, SKIN_LINES } from '../src/Core/dialogos.js'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../back/seed/catalogo.json')

// piezas: una fila por pieza; `params` = defaults de generación; `familia` = rol/slot de la pieza.
const piezas = []
for (const [tipo, items] of Object.entries(SKIN_PARTS)) {
  for (const p of Object.values(items)) {
    piezas.push({ tipo, id: p.id, label: p.label, emoji: p.emoji, categoria: p.category, familia: tipo, params: p.defaults ?? {} })
  }
}

const secciones = {
  familias: SKIN_FAMILIES, // arquetipo dominante -> familia de skin
  presets: SKIN_PRESETS,
  rasgos: { etiquetas: TRAIT_LABEL, tono: TONE },
  caras: FACES,
  razones: PLAN_REASONS,
  temas: Object.fromEntries(THEMES.map((t) => [t.id, { ...t, visual: VISUALS[t.id] ?? null }])),
  dialogos: { base: BASE, eventos: EVENT_LINES, skins: SKIN_LINES },
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ piezas, secciones }, null, 1) + '\n')
console.log(`catalogo.json: ${piezas.length} piezas, secciones: ${Object.keys(secciones).join(', ')}`)
