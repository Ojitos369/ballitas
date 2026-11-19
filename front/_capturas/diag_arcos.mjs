// Diagnóstico: qué invaden los arcos de tema en su sitio original. node _capturas/diag_arcos.mjs [semilla]
import * as W from '../src/Core/world.js'
import * as C from '../src/Components/World3D/vida/colocacion.js'
const w = W.buildWorld(+(process.argv[2] ?? 1))
C.DIAG.on = true
C.colocarTodoMundo(w)
console.log(Object.entries(C.DIAG.cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join('\n'))
console.log(JSON.stringify(C.STATS))
