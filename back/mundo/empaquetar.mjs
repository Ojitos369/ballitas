// Genera back/mundo/servidor.bundle.mjs: un solo archivo con servidor.mjs + la sim del front + three + ws, para que el
// contenedor no necesite node_modules y haya una sola fuente de la sim. Usa el esbuild que trae Vite.
//   cd front && pnpm build:mundo        (lo llama también migrate_view.py)
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const front = path.join(aqui, '..', '..', 'front')
const req = createRequire(path.join(front, 'package.json'))
let esbuild
try { esbuild = req('esbuild') } catch { esbuild = createRequire(req.resolve('vite'))('esbuild') } // pnpm: esbuild cuelga de vite

const salida = path.join(aqui, 'servidor.bundle.mjs')
const r = await esbuild.build({
  entryPoints: [path.join(aqui, 'servidor.mjs')], outfile: salida, bundle: true, platform: 'node', format: 'esm', target: 'node20',
  nodePaths: [path.join(front, 'node_modules')], // `ws` se resuelve desde front/node_modules aunque el servidor viva en back/
  external: ['bufferutil', 'utf-8-validate'], // opcionales de ws
  // ws es CommonJS: necesita `require` para los módulos de Node
  banner: { js: "// GENERADO por back/mundo/empaquetar.mjs: no editar.\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  minifySyntax: true, legalComments: 'none', logLevel: 'warning', metafile: true,
})
const kb = (fs.statSync(salida).size / 1024).toFixed(0)
console.log(`servidor.bundle.mjs: ${kb} KB, ${Object.keys(r.metafile.inputs).length} módulos`)
