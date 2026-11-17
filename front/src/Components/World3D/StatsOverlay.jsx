import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { VIDA_PERF } from './vida/index.js'

const NOOP = () => {}

function countInstanced(scene) {
  let instancedMeshes = 0
  let visibleInstancedMeshes = 0
  let totalInstances = 0
  let visibleInstances = 0
  scene.traverse((obj) => {
    if (!obj.isInstancedMesh) return
    instancedMeshes += 1
    totalInstances += obj.count || 0
    // Comprueba visibilidad acumulada en la jerarquía
    let vis = obj.visible
    let p = obj.parent
    while (vis && p) {
      vis = p.visible
      p = p.parent
    }
    if (vis) {
      visibleInstancedMeshes += 1
      visibleInstances += obj.count || 0
    }
  })
  return { instancedMeshes, visibleInstancedMeshes, totalInstances, visibleInstances }
}

/**
 * Sonda dentro del Canvas R3F. Solo trabaja cuando `active` es true.
 * Desactiva `gl.info.autoReset` para acumular todas las pasadas del frame
 * (sombras + escena principal + postproceso) y las lee/reinicia en priority 0.
 */
export function StatsProbe({ active, onSample = NOOP }) {
  const { gl, scene } = useThree()
  const accRef = useRef({
    frames: 0,
    dtSum: 0,
    callsSum: 0,
    trisSum: 0,
    ptsSum: 0,
    linesSum: 0,
    lastFrameTime: performance.now(),
    lastPublishTime: performance.now(),
    ready: false,
  })

  useEffect(() => {
    if (!active) return undefined
    window.__bollitasDebug = { scene, gl }
    const prevAutoReset = gl.info.autoReset
    gl.info.autoReset = false
    gl.info.reset()
    const st = accRef.current
    st.frames = 0
    st.dtSum = 0
    st.callsSum = 0
    st.trisSum = 0
    st.ptsSum = 0
    st.linesSum = 0
    st.lastFrameTime = performance.now()
    st.lastPublishTime = st.lastFrameTime
    st.ready = false
    return () => {
      gl.info.autoReset = prevAutoReset
    }
  }, [active, gl])

  useFrame(() => {
    if (!active) return
    const now = performance.now()
    const st = accRef.current
    const frameMs = now - st.lastFrameTime
    st.lastFrameTime = now

    if (st.ready) {
      st.frames += 1
      st.dtSum += frameMs
      st.callsSum += gl.info.render.calls
      st.trisSum += gl.info.render.triangles
      st.ptsSum += gl.info.render.points
      st.linesSum += gl.info.render.lines
    } else {
      st.ready = true
    }

    gl.info.reset()

    const elapsed = now - st.lastPublishTime
    if (elapsed >= 500 && st.frames > 0) {
      const n = st.frames
      const avgMs = st.dtSum / n
      const fps = avgMs > 0 ? 1000 / avgMs : 0
      const inst = countInstanced(scene)
      const mem = performance.memory
      const cutoff = now - 1000
      let mounts1s = 0
      for (let i = VIDA_PERF.mountTimes.length - 1; i >= 0; i--) {
        if (VIDA_PERF.mountTimes[i] >= cutoff) mounts1s += 1
        else break
      }
      const sample = {
        fps: Number(fps.toFixed(1)),
        frameMs: Number(avgMs.toFixed(1)),
        calls: Math.round(st.callsSum / n),
        triangles: Math.round(st.trisSum / n),
        points: Math.round(st.ptsSum / n),
        lines: Math.round(st.linesSum / n),
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        heapUsedMB: mem ? Number((mem.usedJSHeapSize / 1048576).toFixed(1)) : null,
        heapTotalMB: mem ? Number((mem.totalJSHeapSize / 1048576).toFixed(1)) : null,
        instancedMeshes: inst.instancedMeshes,
        visibleInstancedMeshes: inst.visibleInstancedMeshes,
        totalInstances: inst.totalInstances,
        visibleInstances: inst.visibleInstances,
        vidaActive: VIDA_PERF.active,
        vidaMountsTotal: VIDA_PERF.totalMounts,
        vidaMountsPerSec: mounts1s,
        dpr: Number(gl.getPixelRatio().toFixed(2)),
        timestamp: now,
      }
      window.__bollitasStats = sample
      onSample(sample)
      st.frames = 0
      st.dtSum = 0
      st.callsSum = 0
      st.trisSum = 0
      st.ptsSum = 0
      st.linesSum = 0
      st.lastPublishTime = now
    }
  }, 0)

  return null
}

/**
 * Overlay HUD compacto con métricas en vivo (F3 o `?stats=1`).
 */
export function StatsHud({ stats }) {
  if (!stats) {
    return (
      <aside className="stats-overlay" aria-label="Estadísticas de rendimiento">
        <div>Stats: midiendo… (F3)</div>
      </aside>
    )
  }
  const fmtInt = (v) => (v == null ? '—' : v.toLocaleString('en-US'))
  return (
    <aside className="stats-overlay" aria-label="Estadísticas de rendimiento">
      <div className="stats-title">PERF [F3] · DPR {stats.dpr}</div>
      <div>FPS: <b>{stats.fps}</b> ({stats.frameMs} ms)</div>
      <div>Calls: <b>{fmtInt(stats.calls)}</b> · Tris: <b>{fmtInt(stats.triangles)}</b></div>
      <div>Pts: {fmtInt(stats.points)} · Lines: {fmtInt(stats.lines)}</div>
      <div>Mem: <b>{stats.geometries}</b> geos · <b>{stats.textures}</b> texs</div>
      <div>
        Heap:{' '}
        <b>{stats.heapUsedMB != null ? `${stats.heapUsedMB} MB` : 'N/A'}</b>
        {stats.heapTotalMB != null ? ` / ${stats.heapTotalMB} MB` : ''}
      </div>
      <div>
        InstMesh: <b>{stats.visibleInstancedMeshes}</b>/{stats.instancedMeshes} · Inst:{' '}
        <b>{fmtInt(stats.visibleInstances)}</b>/{fmtInt(stats.totalInstances)}
      </div>
      <div>
        Vida: <b>{stats.vidaActive}</b> activos · {stats.vidaMountsPerSec}/s (tot {stats.vidaMountsTotal})
      </div>
    </aside>
  )
}
