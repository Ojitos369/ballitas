// Sonda 3D en Edge real: sigue ballitas en vista Seguir (tecla 3) en escritorio y móvil vertical,
// evalúa en cada muestra qué cintas ajenas y qué mallas de estructura invaden el prisma M2 (o aire M1 / unión M3)
// del carril que pisa la ballita (usando window.__ballitasDebug.cam.selected y laneFrame), y guarda capturas.
// Uso: node front/_capturas/choques3d.mjs [url=http://127.0.0.1:4414/?stats=1] [outDir=front/_capturas/repro] [muestrasPorModo=600]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.argv[2] || 'http://127.0.0.1:4414/?stats=1'
const outDir = resolve(process.argv[3] || 'front/_capturas/repro')
const targetSamples = +(process.argv[4] || 600)
const maxShotsPerMode = +(process.argv[5] || 12)
mkdirSync(outDir, { recursive: true })

// Instalamos el evaluador geométrico en la página usando las estructuras exactas de world.js (laneFrame)
async function setupProbe(page) {
  await page.evaluate(() => {
    const dbg = window.__ballitasDebug
    const THREE = dbg.cam.THREE
    const TK = 4.7
    const BALL_R = 0.4
    const LANE_W = +(0.4 * 2.6).toFixed(2) * TK
    const RIBBON_CURB = 0.17 * TK
    const RIBBON_TERR = 0.55 * TK
    const RIBBON_HALF = LANE_W / 2 + RIBBON_CURB + RIBBON_TERR
    const CALZADA_HALF = LANE_W / 2 + RIBBON_CURB
    const GALIBO_H = 6 * TK
    const AIRE_LAT = 2 * RIBBON_HALF
    const QUILLA = 0.75
    const COPLANAR_Y = 0.25
    const COPLANAR_DOT = 0.98
    const TAU = Math.PI * 2
    const NODE_OPEN = 8 * TK
    const HUB_OPEN = 6 * TK
    const OPEN_RAMP = 16 * TK
    const BRAID_RAMP = 18 * TK

    const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
    const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }
    function angDiff(a, b) {
      let d = (b - a) % TAU
      if (d > Math.PI) d -= TAU
      if (d <= -Math.PI) d += TAU
      return d
    }
    function canonDown(T, out = new THREE.Vector3()) {
      out.set(0, -1, 0).addScaledVector(T, T.y)
      if (out.lengthSq() < 0.02) out.set(1, 0, 0).addScaledVector(T, -T.x)
      return out.normalize()
    }
    function arcParamAt(fr, u) {
      const lengths = fr.arcLengths; const last = lengths.length - 1
      if (last <= 0 || !Number.isFinite(u)) return 0
      const target = clamp(u, 0, 1) * lengths[last]
      let low = 0; let high = last
      while (low <= high) {
        const i = Math.floor(low + (high - low) / 2)
        if (lengths[i] < target) low = i + 1
        else if (lengths[i] > target) high = i - 1
        else return i / last
      }
      const before = lengths[high]; const after = lengths[low]
      const fraction = after > before ? (target - before) / (after - before) : 0
      return (high + fraction) / last
    }
    const FRAME_TMP = new THREE.Vector3()
    function wallFrame(seg, angle, u, rho = seg.air ? 0 : seg.radius - BALL_R, out = {}) {
      u = Number.isFinite(u) ? clamp(u, 0, 1) : 0
      const fr = seg._fr; const f = u * fr.n; const i = Math.min(fr.n - 1, Math.floor(f)); const k = f - i; const A = fr.D
      const T = out.tangent || (out.tangent = new THREE.Vector3())
      T.fromArray(fr.T, i * 3); FRAME_TMP.fromArray(fr.T, (i + 1) * 3); T.lerp(FRAME_TMP, k).normalize()
      const w = out.dir || (out.dir = new THREE.Vector3())
      w.set(
        A[i * 3] + (A[i * 3 + 3] - A[i * 3]) * k,
        A[i * 3 + 1] + (A[i * 3 + 4] - A[i * 3 + 1]) * k,
        A[i * 3 + 2] + (A[i * 3 + 5] - A[i * 3 + 2]) * k,
      )
      w.addScaledVector(T, -w.dot(T))
      if (w.lengthSq() < 1e-8) canonDown(T, w)
      w.normalize().applyAxisAngle(T, angle)
      const axis = out.axis || (out.axis = new THREE.Vector3())
      const curveU = arcParamAt(fr, u)
      seg.curve.getPoint(curveU, axis)
      out.axis = axis; out.dir = w; out.angle = angle; out.tangent = T
      out.pos = (out.pos || new THREE.Vector3()).copy(axis).addScaledVector(w, rho)
      out.wall = (out.wall || new THREE.Vector3()).copy(axis).addScaledVector(w, seg.radius)
      out.up = (out.up || new THREE.Vector3()).copy(w).negate()
      out.side = (out.side || new THREE.Vector3()).crossVectors(T, out.up).normalize()
      return out
    }
    function segmentTangent(seg, u, out = new THREE.Vector3()) {
      const fr = seg._fr
      const f = clamp(u, 0, 1) * fr.n
      const i = Math.min(fr.n - 1, Math.floor(f)); const k = f - i; const j = i * 3
      return out.set(
        fr.T[j] + (fr.T[j + 3] - fr.T[j]) * k,
        fr.T[j + 1] + (fr.T[j + 4] - fr.T[j + 1]) * k,
        fr.T[j + 2] + (fr.T[j + 5] - fr.T[j + 2]) * k,
      ).normalize()
    }
    const laneOf = (seg, id) => seg.lanes?.find((l) => l.id === id) || seg.lanes?.[0] || null
    const lerpArr = (arr, u) => {
      const n = arr.length - 1; const f = clamp(Number.isFinite(u) ? u : 0, 0, 1) * n; const i = Math.min(n - 1, Math.floor(f))
      return arr[i] + (arr[i + 1] - arr[i]) * (f - i)
    }
    function braidDelay(seg) {
      return [seg.kind === 'salida' ? NODE_OPEN : seg.hubA ? HUB_OPEN : 0, seg.kind === 'llegada' ? NODE_OPEN : seg.hubB ? HUB_OPEN : 0]
    }
    function braidEnv(seg, u) {
      const L = seg.length; const x = clamp(Number.isFinite(u) ? u : 0, 0, 1) * L
      const [a, b] = braidDelay(seg)
      const r = Math.max(4 * TK, Math.min(OPEN_RAMP, (L - a - b) * 0.3))
      return smooth01((x - a) / r) * smooth01((L - b - x) / r)
    }
    function rollAt(seg, lane, u) {
      if (!lane || lane.roll === 'plano' || !seg._braid) return 0
      const e = braidEnv(seg, u)
      if (lane.roll === 'cabeza') return Math.PI * e
      if (lane.roll === 'lado_der') return (Math.PI / 2) * e
      if (lane.roll === 'lado_izq') return (-Math.PI / 2) * e
      const [a, b] = seg._braid.full
      return (lane.roll === 'tirabuzon' ? 1 : -1) * TAU * smooth01((clamp(u, 0, 1) - a) / (b - a))
    }
    function laneAngle(seg, laneId, u) {
      const l = laneOf(seg, laneId)
      if (!l) return 0
      const a = rollAt(seg, l, u)
      const bk = seg._bank
      if (!bk) return a
      const x = lerpArr(bk.x, u); const y = lerpArr(bk.y, u); const m = Math.hypot(x, y)
      return m < 1e-6 ? a : a + m * Math.sin(angDiff(a, Math.atan2(y, x)))
    }
    function laneRelief(seg, laneId, u) {
      const arr = seg._relief?.h.get(laneOf(seg, laneId)?.id)
      return arr ? lerpArr(arr, u) : 0
    }
    function roadAt(seg, laneId, u, out) {
      const br = seg._braid
      if (!br) return out.copy(wallFrame(seg, 0, u, 0, {}).axis)
      const P = br.P[laneOf(seg, laneId)?.id ?? 0] || br.P[0]
      const f = clamp(Number.isFinite(u) ? u : 0, 0, 1) * br.N; const i = Math.min(br.N - 1, Math.floor(f)); const k = f - i; const j = i * 3
      return out.set(P[j] + (P[j + 3] - P[j]) * k, P[j + 1] + (P[j + 4] - P[j + 1]) * k, P[j + 2] + (P[j + 5] - P[j + 2]) * k)
    }
    const LF_W = {}; const LF_P0 = new THREE.Vector3(); const LF_P1 = new THREE.Vector3()
    function surfAt(seg, laneId, u, out, up) {
      const d = wallFrame(seg, laneAngle(seg, laneId, u), u, 0, LF_W).dir
      if (up) up.copy(d).negate()
      roadAt(seg, laneId, u, out)
      return seg.air ? out : out.addScaledVector(d, -laneRelief(seg, laneId, u))
    }
    function laneFrame(seg, laneId, u, out = {}) {
      u = Number.isFinite(u) ? clamp(u, 0, 1) : 0
      const up = out.up || (out.up = new THREE.Vector3())
      const surface = out.surface || (out.surface = new THREE.Vector3())
      surfAt(seg, laneId, u, surface, up)
      const road = out.road || (out.road = new THREE.Vector3())
      roadAt(seg, laneId, u, road)
      const du = Math.min(0.01, (0.4 * TK) / seg.length); const u0 = Math.max(0, u - du); const u1 = Math.min(1, u + du)
      const T = out.tangent || (out.tangent = new THREE.Vector3())
      T.subVectors(surfAt(seg, laneId, u1, LF_P1), surfAt(seg, laneId, u0, LF_P0))
      if (T.lengthSq() > 1e-12) T.normalize(); else segmentTangent(seg, u, T)
      up.addScaledVector(T, -up.dot(T))
      if (up.lengthSq() < 1e-10) canonDown(T, up).negate()
      up.normalize()
      out.side = (out.side || new THREE.Vector3()).crossVectors(T, up).normalize()
      out.pos = (out.pos || new THREE.Vector3()).copy(surface).addScaledVector(up, BALL_R)
      return out
    }

    // Pre-muestrear todas las cintas del mundo para consultas rápidas en vivo
    const nodes = dbg.cam.nodes
    const ways = [...new Set(nodes.flatMap((n) => n.ports.flatMap((p) => [p.wayIn, p.wayOut])).filter(Boolean))].sort((a, b) => a.idx - b.idx)
    const STEP = 1.5 * TK
    const CELL = 36 * TK
    const cellKey = (x, y, z) => `${x},${y},${z}`
    const grid = new Map()
    const samples = []
    const F = {}
    for (const way of ways) {
      for (const seg of way.segments) {
        if (seg.air || !seg.lanes) continue
        const n = Math.max(4, Math.ceil(seg.length / STEP))
        const [da, db] = braidDelay(seg)
        for (const l of seg.lanes) {
          for (let i = 0; i <= n; i++) {
            const u = i / n
            const s = u * seg.length
            laneFrame(seg, l.id, u, F)
            const sp = {
              way: way.idx, theme: way.theme.id, seg: seg.i, segObj: seg, kind: seg.kind, route: seg.route, lane: l.id, u,
              s, L: seg.length, closedStart: s < da, closedEnd: (seg.length - s) < db,
              x: F.surface.x, y: F.surface.y, z: F.surface.z,
              ux: F.up.x, uy: F.up.y, uz: F.up.z,
              sx: F.side.x, sy: F.side.y, sz: F.side.z,
              tx: F.tangent.x, ty: F.tangent.y, tz: F.tangent.z,
            }
            const idx = samples.length
            samples.push(sp)
            const ck = cellKey(Math.floor(sp.x / CELL), Math.floor(sp.y / CELL), Math.floor(sp.z / CELL))
            let b = grid.get(ck); if (!b) grid.set(ck, b = []); b.push(idx)
          }
        }
      }
    }

    window.__choquesProbe = {
      ways, samples, grid, laneFrame,
      constants: { TK, LANE_W, RIBBON_HALF, CALZADA_HALF, GALIBO_H, AIRE_LAT, QUILLA, COPLANAR_Y, COPLANAR_DOT, CELL },
      sampleNow() {
        const b = window.__ballitasDebug?.cam?.selected
        if (!b || b.phase !== 'travel' || !b.seg || b.seg.air) return null
        const seg = b.seg; const way = b.way; const lane = b.lane; const u0 = b.segT ?? 0
        const F0 = laneFrame(seg, lane, u0, {})
        const ribbonIntrusions = []
        const seenRib = new Set()

        // Revisamos el prisma M2 en la posición de la ballita y 12 u hacia delante (lo que tiene justo enfrente)
        const checkOffsets = [0, 4, 8, 12]
        for (const dOff of checkOffsets) {
          const u = clamp(u0 + dOff / Math.max(seg.length, 1), 0, 1)
          const A = laneFrame(seg, lane, u, {})
          const ax = A.surface.x; const ay = A.surface.y; const az = A.surface.z
          const aux = A.up.x; const auy = A.up.y; const auz = A.up.z
          const asx = A.side.x; const asy = A.side.y; const asz = A.side.z
          const atx = A.tangent.x; const aty = A.tangent.y; const atz = A.tangent.z
          const cx = Math.floor(ax / CELL); const cy = Math.floor(ay / CELL); const cz = Math.floor(az / CELL)

          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const bucket = grid.get(cellKey(cx + dx, cy + dy, cz + dz))
            if (!bucket) continue
            for (const j of bucket) {
              const B = samples[j]
              // Ignorar el mismo carril en el mismo tramo o en el tramo contiguo inmediato
              if (B.way === way.idx && B.lane === lane) {
                if (B.seg === seg.i && Math.abs(B.u - u) * seg.length < 15 * TK) continue
                if (seg.next?.includes(B.seg) && (1 - u) * seg.length + B.s < 15 * TK) continue
                if (B.segObj.next?.includes(seg.i) && (1 - B.u) * B.L + u * seg.length < 15 * TK) continue
              }
              const rx = B.x - ax; const ry = B.y - ay; const rz = B.z - az
              const zLong = Math.abs(rx * atx + ry * aty + rz * atz)
              if (zLong > STEP * 1.1) continue
              const y = rx * aux + ry * auy + rz * auz
              const x = Math.abs(rx * asx + ry * asy + rz * asz)
              const dot = aux * B.ux + auy * B.uy + auz * B.uz
              const medioB = RIBBON_HALF * Math.max(Math.abs(dot), 0.35)
              const altoB = RIBBON_HALF * Math.sqrt(Math.max(0, 1 - dot * dot)) + QUILLA
              const coplanar = dot >= COPLANAR_DOT && Math.abs(y) <= COPLANAR_Y

              // ¿Están en una zona de unión compartida?
              const sameSeg = B.way === way.idx && B.seg === seg.i
              const nearStart = u * seg.length < 25 * TK && B.s < 25 * TK
              const nearEnd = (1 - u) * seg.length < 25 * TK && (B.L - B.s) < 25 * TK
              const inJoint = (sameSeg && (nearStart || nearEnd)) ||
                (B.way === way.idx && ((nearStart && B.s < 25 * TK) || (nearEnd && (B.L - B.s) < 25 * TK)))

              if (coplanar && inJoint) continue // unión limpia coplanar

              if (x - medioB < CALZADA_HALF && y - altoB < GALIBO_H && y + altoB > -QUILLA) {
                const kind = inJoint ? 'union_desnivel' : 'galibo'
                const key = `${kind}:w${B.way}s${B.seg}L${B.lane}`
                if (!seenRib.has(key)) {
                  seenRib.add(key)
                  ribbonIntrusions.push({
                    type: kind,
                    way: B.way, theme: B.theme, seg: B.seg, segKind: B.kind, route: B.route, lane: B.lane,
                    u: +B.u.toFixed(2), x: +x.toFixed(2), y: +y.toFixed(2), dot: +dot.toFixed(3),
                    clearY: +(y - altoB).toFixed(2), clearX: +(x - medioB - CALZADA_HALF).toFixed(2),
                  })
                }
              }
            }
          }
        }

        // 2) Estructuras visibles en scene que caen dentro del corredor/gálibo M2 del carril que pisa la ballita
        const structIntrusions = []
        const seenStruct = new Set()
        const scene = window.__ballitasDebug.scene
        const m4 = new THREE.Matrix4()
        const pos = new THREE.Vector3()
        const scale = new THREE.Vector3()
        const quat = new THREE.Quaternion()

        const ax = F0.surface.x; const ay = F0.surface.y; const az = F0.surface.z
        const aux = F0.up.x; const auy = F0.up.y; const auz = F0.up.z
        const asx = F0.side.x; const asy = F0.side.y; const asz = F0.side.z
        const atx = F0.tangent.x; const aty = F0.tangent.y; const atz = F0.tangent.z

        scene.traverse((obj) => {
          if (!obj.visible) return
          let p = obj.parent; let vis = true
          while (p) { if (!p.visible) { vis = false; break } p = p.parent }
          if (!vis) return

          const gName = obj.geometry?.name || ''
          if (gName.startsWith('pista:')) return

          if (obj.isInstancedMesh && obj.count > 0) {
            const isRing = gName === 'anillos:lowBase' || gName.includes('anillo_neon') || Boolean(obj.material?.customProgramCacheKey && obj.material.customProgramCacheKey() === 'kit-anillo-core-v1')
            const isArch = gName.startsWith('struct:arch:')
            const isUnion = gName.startsWith('uniones:')
            if (!isRing && !isArch && !isUnion) return

            for (let i = 0; i < obj.count; i++) {
              obj.getMatrixAt(i, m4)
              m4.decompose(pos, quat, scale)
              const rx = pos.x - ax; const ry = pos.y - ay; const rz = pos.z - az
              const z = rx * atx + ry * aty + rz * atz
              if (z < -4 || z > 22) continue
              const x = rx * asx + ry * asy + rz * asz
              const y = rx * aux + ry * auy + rz * auz

              if (isRing) {
                // Un anillo propio está centrado en x ~ 0, y ~ -0.42*sc y su aro pasa a radio ~0.56*sc (~5.8 u).
                // Un anillo AJENO tiene su centro desplazado lateralmente o en altura y su aro (radio R = 0.56 * scale.x)
                // corta el prisma M2 (|x| < CALZADA_HALF, 0 < y < GALIBO_H).
                const R = 0.56 * scale.x
                const centerLat = Math.abs(x)
                const centerY = y + 0.66 * scale.y
                const isOwnRing = centerLat < 1.2 && Math.abs(y + 0.42 * scale.x) < 1.5
                if (!isOwnRing) {
                  // ¿La circunferencia o el disco del anillo ajeno entra en |x| < CALZADA_HALF y 0 < y < GALIBO_H?
                  if (centerLat - R < CALZADA_HALF && centerY + R > 0 && centerY - R < GALIBO_H) {
                    const key = `anillo:${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`
                    if (!seenStruct.has(key)) {
                      seenStruct.add(key)
                      structIntrusions.push({
                        type: 'anillo_ajeno', mesh: gName || 'anillo_neon',
                        x: +x.toFixed(2), y: +centerY.toFixed(2), z: +z.toFixed(2), r: +R.toFixed(2),
                      })
                    }
                  }
                }
              } else if (isArch) {
                const halfSpan = scale.x * 0.5
                const archH = scale.y
                const isOwnArch = Math.abs(x) < 1.0 && Math.abs(y) < 1.0
                if (!isOwnArch && Math.abs(x) - halfSpan < CALZADA_HALF && y + archH > 0 && y < GALIBO_H) {
                  const key = `arco:${gName}:${Math.round(pos.x)},${Math.round(pos.y)}`
                  if (!seenStruct.has(key)) {
                    seenStruct.add(key)
                    structIntrusions.push({
                      type: 'arco_ajeno', mesh: gName,
                      x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), span: +scale.x.toFixed(2), h: +archH.toFixed(2),
                    })
                  }
                }
              } else if (isUnion && (gName === 'uniones:pillar' || gName === 'uniones:beam' || gName === 'uniones:dividerBody')) {
                const halfW = gName === 'uniones:beam' ? scale.x * 0.5 : 0.4
                const h = gName === 'uniones:pillar' ? 3.6 : 0.4
                if (gName === 'uniones:pillar' && Math.abs(x) < CALZADA_HALF - 0.2 && y + h > 0 && y < GALIBO_H) {
                  const key = `pilar:${Math.round(pos.x)},${Math.round(pos.y)}`
                  if (!seenStruct.has(key)) {
                    seenStruct.add(key)
                    structIntrusions.push({ type: 'pilar_en_calzada', mesh: gName, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) })
                  }
                }
              }
            }
          }
        })

        return {
          ballita: b.name,
          way: way.idx,
          theme: way.theme.id,
          seg: seg.i,
          segKind: seg.kind,
          route: seg.route,
          lane,
          u: +u0.toFixed(3),
          ribbonIntrusions,
          structIntrusions,
        }
      },
    }
  })
}

async function runMode(browser, modeName, contextOpts, samplesGoal) {
  const context = await browser.newContext(contextOpts)
  const page = await context.newPage()
  await page.goto(url)
  await page.waitForFunction(() => window.__ballitasDebug?.gl && window.__ballitasDebug?.cam?.nodes?.length, null, { timeout: 60000 })
  await page.waitForTimeout(4000)
  await setupProbe(page)

  // Entrar en vista ballita (tecla 3) y poner velocidad 3x para recorrer más tramo por muestra
  await page.keyboard.press('3')
  await page.waitForTimeout(1500)

  let samples = 0
  let intrusions = 0
  let shots = 0
  const byCat = { galibo: 0, union_desnivel: 0, anillo_ajeno: 0, arco_ajeno: 0, pilar_en_calzada: 0 }
  const ballitasSeen = new Set()
  const cases = []
  const shotCooldown = new Map()

  let stepsWithoutTravel = 0
  let ballIdx = 0
  const nextBallita = async () => {
    ballIdx++
    await page.evaluate((idx) => {
      const btns = document.querySelectorAll('nav.puntos button.punto')
      if (btns.length) btns[idx % btns.length].click()
    }, ballIdx)
  }
  while (samples < samplesGoal) {
    const res = await page.evaluate(() => window.__choquesProbe.sampleNow())
    if (!res) {
      stepsWithoutTravel++
      if (stepsWithoutTravel >= 4) {
        await nextBallita()
        stepsWithoutTravel = 0
      }
      await page.waitForTimeout(180)
      continue
    }
    stepsWithoutTravel = 0
    samples++
    ballitasSeen.add(res.ballita)

    const hasRib = res.ribbonIntrusions.length > 0
    const hasStr = res.structIntrusions.length > 0
    if (hasRib || hasStr) {
      intrusions++
      for (const r of res.ribbonIntrusions) byCat[r.type] = (byCat[r.type] || 0) + 1
      for (const s of res.structIntrusions) byCat[s.type] = (byCat[s.type] || 0) + 1

      const catKey = res.ribbonIntrusions[0]?.type || res.structIntrusions[0]?.type || 'hit'
      const locKey = `${modeName}:${catKey}:w${res.way}s${res.seg}`
      if (shots < maxShotsPerMode && !shotCooldown.has(locKey)) {
        shotCooldown.set(locKey, true)
        const file = `${outDir}/${modeName}_${String(shots).padStart(2, '0')}_${res.theme}_w${res.way}s${res.seg}_${catKey}.jpg`
        await page.screenshot({ path: file, quality: 78 })
        shots++
        cases.push({ file, ...res })
      }
    }

    // Cambiar de ballita cada ~60 muestras para cubrir >= 6 ballitas distintas
    if (samples % 60 === 0) {
      await nextBallita()
      await page.waitForTimeout(350)
    } else {
      await page.waitForTimeout(80)
    }
  }

  await context.close()
  return { mode: modeName, samples, ballitas: ballitasSeen.size, ballitaNames: [...ballitasSeen], intrusions, byCat, shots, cases }
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: false,
  args: ['--window-size=1420,960', '--ignore-gpu-blocklist'],
})
const __guardia = setTimeout(() => { browser.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {

const desktop = await runMode(browser, 'desktop', { viewport: { width: 1400, height: 900 } }, targetSamples)
console.log('DESKTOP:', JSON.stringify({ ...desktop, cases: desktop.cases.length }))

const mobile = await runMode(browser, 'movil', {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.6,
  isMobile: true,
  hasTouch: true,
}, targetSamples)
console.log('MOVIL:', JSON.stringify({ ...mobile, cases: mobile.cases.length }))

writeFileSync(`${outDir}/reporte_choques3d.json`, JSON.stringify({ url, desktop, mobile }, null, 2))
} finally {
  clearTimeout(__guardia)
  await browser.close().catch(() => {})
}
