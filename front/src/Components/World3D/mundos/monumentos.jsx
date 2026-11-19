import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { NODE_R, mulberry32 } from '../../../Core/world.js'
import { conFoco } from './foco.js'

const UP = new THREE.Vector3(0, 1, 0)
const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'

// ─── Caché de GLBs en módulo (sin Suspense, con color_1 -> color) ───
const gltfLoader = new GLTFLoader()
const glbCache = new Map()
const glbPromises = new Map()

function extractGlbGeo(gltf) {
  let found = null
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    if (found || !o.isMesh) return
    const g = o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)
    if (g.attributes.color_1) {
      const s = g.attributes.color_1
      const a = new Float32Array(s.count * 3)
      for (let i = 0; i < s.count; i++) {
        a[i * 3] = s.getX(i)
        a[i * 3 + 1] = s.getY(i)
        a[i * 3 + 2] = s.getZ(i)
      }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3))
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k)
    }
    if (!g.attributes.normal) g.computeVertexNormals()
    if (!g.attributes.color) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3))
    }
    g.computeBoundingSphere()
    found = g
  })
  return found
}

function useMonumentGlb(name) {
  const [geo, setGeo] = useState(() => (name ? glbCache.get(name) ?? null : null))
  useEffect(() => {
    if (!name) return undefined
    if (glbCache.has(name)) {
      setGeo(glbCache.get(name))
      return undefined
    }
    let alive = true
    let p = glbPromises.get(name)
    if (!p) {
      p = gltfLoader.loadAsync(`${BASE_URL}${name}.glb`)
        .then((gltf) => {
          const g = extractGlbGeo(gltf)
          if (g) glbCache.set(name, g)
          return g
        })
        .catch(() => null)
      glbPromises.set(name, p)
    }
    p.then((g) => { if (alive && g) setGeo(g) })
    return () => { alive = false }
  }, [name])
  return geo
}

// ─── Geometrías procedurales en caché de módulo para monumentos ───
const GEO = {
  plinth: new THREE.CylinderGeometry(1.55, 1.85, 0.35, 12).translate(0, 0.175, 0),
  plinthSq: new THREE.BoxGeometry(3.2, 0.35, 3.2).translate(0, 0.175, 0),
  trunk: new THREE.CylinderGeometry(0.32, 0.62, 2.2, 10).translate(0, 1.1, 0),
  canopyLow: new THREE.DodecahedronGeometry(1.45, 1).scale(1.15, 0.7, 1.15),
  canopyTop: new THREE.DodecahedronGeometry(1.0, 1).scale(1.1, 0.78, 1.1),
  lighthouseBody: new THREE.CylinderGeometry(0.45, 0.82, 3.1, 14).translate(0, 1.55, 0),
  lighthouseCap: new THREE.ConeGeometry(0.62, 0.65, 14).translate(0, 0.325, 0),
  lighthouseBeam: new THREE.ConeGeometry(0.95, 3.4, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.7),
  pyr1: new THREE.BoxGeometry(3.1, 0.65, 3.1).translate(0, 0.325, 0),
  pyr2: new THREE.BoxGeometry(2.25, 0.65, 2.25).translate(0, 0.975, 0),
  pyr3: new THREE.BoxGeometry(1.45, 0.65, 1.45).translate(0, 1.625, 0),
  pyr4: new THREE.BoxGeometry(0.75, 0.55, 0.75).translate(0, 2.225, 0),
  pyrApex: new THREE.OctahedronGeometry(0.42, 0),
  iceKeep: new THREE.CylinderGeometry(0.68, 0.88, 2.4, 6).translate(0, 1.2, 0),
  iceSpire: new THREE.ConeGeometry(0.72, 1.45, 6).translate(0, 0.725, 0),
  iceTurret: new THREE.CylinderGeometry(0.24, 0.3, 1.55, 6).translate(0, 0.775, 0),
  iceTurretCap: new THREE.ConeGeometry(0.28, 0.75, 6).translate(0, 0.375, 0),
  crystalMain: new THREE.OctahedronGeometry(0.95, 0).scale(0.65, 2.1, 0.65).translate(0, 1.9, 0),
  crystalSide: new THREE.OctahedronGeometry(0.55, 0).scale(0.55, 1.6, 0.55).translate(0, 0.8, 0),
  neonCore: new THREE.CylinderGeometry(0.35, 0.52, 3.5, 8).translate(0, 1.75, 0),
  neonRing: new THREE.TorusGeometry(0.95, 0.08, 8, 24).rotateX(Math.PI / 2),
  neonNeedle: new THREE.ConeGeometry(0.18, 1.2, 8).translate(0, 4.0, 0),
  mausoleumBody: new THREE.BoxGeometry(1.9, 1.35, 2.1).translate(0, 0.85, 0),
  mausoleumRoof: new THREE.ConeGeometry(1.55, 1.05, 4).rotateY(Math.PI / 4).translate(0, 2.05, 0),
  mausoleumPillar: new THREE.CylinderGeometry(0.14, 0.16, 1.35, 8).translate(0, 0.85, 0),
  archRing: new THREE.TorusGeometry(1.25, 0.1, 8, 20, Math.PI),
  cloudHalo: new THREE.TorusGeometry(1.35, 0.06, 8, 24).rotateX(Math.PI / 2),
  orb: new THREE.OctahedronGeometry(0.38, 0),
  lavaPool: new THREE.CylinderGeometry(1.15, 1.25, 0.14, 16).translate(0, 0.12, 0),
}

const BIOME_GLB = {
  volcan: 'volcan_erupcion',
  nubes: 'isla_nube',
  cristal: 'geoda',
  jardin: 'fuente_jardin',
  bosque: 'hongo_gigante',
  mar: 'concha_gigante',
  desierto: 'saguaro_grande',
  hielo: 'estalagmita_hielo',
  sombrio: 'lapida',
  neon: 'luciernaga_farol',
}

/**
 * Elige un punto prominente y despejado en el hemisferio superior del planeta
 * para colocar el monumento único del mundo.
 */
export function pickMonumentSpot(node, near, surfaceR = NODE_R) {
  const rng = mulberry32(5150 + node.idx * 313)
  const rot = rng() * Math.PI * 2
  const samples = 64
  let bestDir = new THREE.Vector3(0, 1, 0)
  let bestScore = -Infinity

  const scaleK = surfaceR / 7.5
  const minClear = 2.2 * scaleK * scaleK
  for (let i = 0; i < samples; i++) {
    const yy = 0.96 - (i / samples) * 0.62 // hemisferio superior (y: 0.96 .. 0.34)
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy))
    const ang = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr).normalize()
    const worldPt = dir.clone().multiplyScalar(surfaceR).add(node.pos)
    let minD2 = Infinity
    for (const [p, rad] of near) {
      const d2 = p.distanceToSquared(worldPt) - rad * rad
      if (d2 < minD2) minD2 = d2
    }
    if (minD2 > minClear) {
      bestDir = dir
      break
    }
    if (minD2 > bestScore) {
      bestScore = minD2
      bestDir = dir
    }
  }

  return {
    dir: bestDir,
    pos: bestDir.clone().multiplyScalar(surfaceR - 0.06 * scaleK),
    quat: new THREE.Quaternion().setFromUnitVectors(UP, bestDir),
  }
}

function liftColor(hex, minL, minSat = 0.25) {
  if (!minL) return hex
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s > 0.02 ? Math.max(hsl.s, minSat) : hsl.s, Math.max(hsl.l, minL))
  return c
}

export function Monument({ node, biome, spot, surfaceR = NODE_R, animRegRef = null, scale = null, minLight = 0, emissiveMap = null }) {
  const glbName = BIOME_GLB[biome.id]
  const glbGeo = useMonumentGlb(glbName)
  const animRef = useRef()
  const animRef2 = useRef()

  const mats = useMemo(() => {
    const texProps = emissiveMap ? { emissive: biome.cityLight, emissiveMap, emissiveIntensity: 0.75 } : {}
    // conFoco: con la ballita seguida en el planeta, la piedra oscura sube a tono medio y lo lejano se atenúa
    // (k = 0 en mapa/camino: idéntico). La vista Superficie no lo usa (FOCO.k es 0 allí).
    return {
      stone: conFoco(new THREE.MeshStandardMaterial({ color: liftColor(biome.groundHigh, minLight * 1.45), roughness: 0.78, metalness: 0.14, ...texProps })),
      accent: conFoco(new THREE.MeshStandardMaterial({ color: biome.cityLight, emissive: biome.cityLight, emissiveIntensity: 1.15, roughness: 0.25, metalness: 0.35, toneMapped: false }), { desat: 0.7, oscurece: 0.55 }),
      dark: conFoco(new THREE.MeshStandardMaterial({ color: liftColor(biome.groundLow, minLight * 0.9), roughness: 0.85, metalness: 0.2 }), { lift: [new THREE.Color(biome.groundMid).lerp(new THREE.Color('#9a9a9a'), 0.5), 0.5] }),
      mid: conFoco(new THREE.MeshStandardMaterial({ color: liftColor(biome.groundMid, minLight * 1.15), roughness: 0.68, metalness: 0.18, ...texProps }), { lift: [new THREE.Color(biome.groundHigh).lerp(new THREE.Color('#b0b0b0'), 0.4), 0.35] }),
      glass: conFoco(new THREE.MeshStandardMaterial({ color: biome.atmoRim, emissive: biome.atmoBase, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.55, transparent: true, opacity: 0.88 })),
      beam: new THREE.MeshBasicMaterial({ color: biome.cityLight, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      glb: conFoco(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.12 })),
    }
  }, [biome, minLight, emissiveMap])

  useEffect(() => () => {
    Object.values(mats).forEach((m) => m.dispose())
  }, [mats])

  useLayoutEffect(() => {
    if (!animRegRef?.current) return undefined
    const reg = animRegRef.current
    const entry = { animRef, animRef2, biomeId: biome.id, nodeIdx: node.idx }
    reg.monument = entry
    return () => {
      if (reg.monument === entry) reg.monument = null
    }
  }, [animRegRef, biome.id, node.idx])

  const monScale = useMemo(() => (scale != null ? scale : surfaceR / 7.5), [scale, surfaceR])

  return (
    <group position={spot.pos} quaternion={spot.quat} scale={monScale}>
      {biome.id === 'bosque' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.dark} />
          <mesh geometry={GEO.trunk} material={mats.dark} />
          <mesh geometry={GEO.canopyLow} material={mats.mid} position={[0, 2.2, 0]} />
          <mesh geometry={GEO.canopyTop} material={mats.stone} position={[0, 3.1, 0]} />
          <mesh ref={animRef} geometry={GEO.orb} material={mats.accent} position={[0, 4.05, 0]} scale={0.65} />
          {glbGeo && (
            <>
              <mesh geometry={glbGeo} material={mats.glb} position={[1.15, 0.15, 0.6]} scale={0.75} />
              <mesh geometry={glbGeo} material={mats.glb} position={[-1.0, 0.15, -0.75]} scale={0.58} rotation={[0, 1.4, 0]} />
            </>
          )}
        </group>
      )}

      {biome.id === 'mar' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.stone} />
          <mesh geometry={GEO.lighthouseBody} material={mats.stone} />
          <mesh geometry={GEO.neonRing} material={mats.accent} position={[0, 2.95, 0]} scale={0.56} />
          <mesh geometry={GEO.lighthouseCap} material={mats.dark} position={[0, 3.15, 0]} />
          <group ref={animRef} position={[0, 2.95, 0]}>
            <mesh geometry={GEO.lighthouseBeam} material={mats.beam} />
          </group>
          {glbGeo && <mesh geometry={glbGeo} material={mats.glb} position={[1.35, 0.1, 0.5]} scale={0.95} rotation={[0, -0.6, 0]} />}
        </group>
      )}

      {biome.id === 'desierto' && (
        <group>
          <mesh geometry={GEO.pyr1} material={mats.mid} />
          <mesh geometry={GEO.pyr2} material={mats.stone} />
          <mesh geometry={GEO.pyr3} material={mats.mid} />
          <mesh geometry={GEO.pyr4} material={mats.stone} />
          <mesh ref={animRef} geometry={GEO.pyrApex} material={mats.accent} position={[0, 2.95, 0]} />
          {glbGeo && (
            <>
              <mesh geometry={glbGeo} material={mats.glb} position={[1.85, 0, 1.1]} scale={1.15} />
              <mesh geometry={glbGeo} material={mats.glb} position={[-1.75, 0, -1.0]} scale={0.95} rotation={[0, 1.1, 0]} />
            </>
          )}
        </group>
      )}

      {biome.id === 'hielo' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.mid} />
          <mesh geometry={GEO.iceKeep} material={mats.glass} />
          <mesh geometry={GEO.iceSpire} material={mats.accent} position={[0, 2.4, 0]} />
          {[0, 1, 2, 3].map((k) => {
            const a = (k * Math.PI) / 2 + Math.PI / 4
            return (
              <group key={k} position={[Math.cos(a) * 1.05, 0.2, Math.sin(a) * 1.05]}>
                <mesh geometry={GEO.iceTurret} material={mats.stone} />
                <mesh geometry={GEO.iceTurretCap} material={mats.glass} position={[0, 1.55, 0]} />
              </group>
            )
          })}
          {glbGeo && <mesh geometry={glbGeo} material={mats.glb} position={[1.55, 0, -0.4]} scale={1.1} />}
        </group>
      )}

      {biome.id === 'volcan' && (
        <group>
          <mesh geometry={GEO.lavaPool} material={mats.accent} />
          {glbGeo ? (
            <mesh geometry={glbGeo} material={mats.glb} position={[0, 0.05, 0]} scale={3.1} />
          ) : (
            <mesh geometry={GEO.lighthouseBody} material={mats.dark} scale={[1.6, 0.75, 1.6]} />
          )}
          <mesh ref={animRef} geometry={GEO.orb} material={mats.accent} position={[0, 3.25, 0]} scale={0.85} />
        </group>
      )}

      {biome.id === 'cristal' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.dark} />
          <mesh geometry={GEO.crystalMain} material={mats.glass} />
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k * Math.PI * 2) / 5
            return (
              <mesh
                key={k}
                geometry={GEO.crystalSide}
                material={k % 2 === 0 ? mats.accent : mats.glass}
                position={[Math.cos(a) * 0.82, 0.15, Math.sin(a) * 0.82]}
                rotation={[Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25]}
              />
            )
          })}
          {glbGeo && <mesh geometry={glbGeo} material={mats.glb} position={[1.55, 0.05, 0.75]} scale={1.1} />}
        </group>
      )}

      {biome.id === 'nubes' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.mid} scale={[0.85, 0.7, 0.85]} />
          <group ref={animRef} position={[0, 1.65, 0]}>
            {glbGeo ? (
              <mesh geometry={glbGeo} material={mats.glb} scale={2.35} />
            ) : (
              <mesh geometry={GEO.canopyLow} material={mats.stone} />
            )}
            <mesh geometry={GEO.cloudHalo} material={mats.accent} position={[0, 0.35, 0]} />
          </group>
          <mesh ref={animRef2} geometry={GEO.cloudHalo} material={mats.glass} position={[0, 1.15, 0]} scale={0.78} />
        </group>
      )}

      {biome.id === 'neon' && (
        <group>
          <mesh geometry={GEO.plinthSq} material={mats.dark} />
          <mesh geometry={GEO.neonCore} material={mats.mid} />
          <mesh geometry={GEO.neonNeedle} material={mats.accent} />
          <mesh ref={animRef} geometry={GEO.neonRing} material={mats.accent} position={[0, 1.4, 0]} />
          <mesh ref={animRef2} geometry={GEO.neonRing} material={mats.glass} position={[0, 2.5, 0]} scale={0.72} />
          {glbGeo && (
            <>
              <mesh geometry={glbGeo} material={mats.glb} position={[1.3, 0.3, 1.3]} scale={0.9} />
              <mesh geometry={glbGeo} material={mats.glb} position={[-1.3, 0.3, -1.3]} scale={0.9} />
            </>
          )}
        </group>
      )}

      {biome.id === 'jardin' && (
        <group>
          <mesh geometry={GEO.plinth} material={mats.stone} />
          <mesh geometry={GEO.archRing} material={mats.mid} position={[0, 0.3, 0]} scale={1.15} />
          <mesh geometry={GEO.archRing} material={mats.mid} position={[0, 0.3, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.15} />
          {glbGeo ? (
            <mesh geometry={glbGeo} material={mats.glb} position={[0, 0.28, 0]} scale={1.7} />
          ) : (
            <mesh geometry={GEO.canopyTop} material={mats.mid} position={[0, 1.4, 0]} />
          )}
          <mesh ref={animRef} geometry={GEO.orb} material={mats.accent} position={[0, 2.45, 0]} scale={0.62} />
        </group>
      )}

      {biome.id === 'sombrio' && (
        <group>
          <mesh geometry={GEO.plinthSq} material={mats.dark} />
          <mesh geometry={GEO.mausoleumBody} material={mats.mid} />
          <mesh geometry={GEO.mausoleumRoof} material={mats.dark} />
          {[[-0.9, -0.95], [0.9, -0.95], [-0.9, 0.95], [0.9, 0.95]].map(([px, pz], idx) => (
            <mesh key={idx} geometry={GEO.mausoleumPillar} material={mats.stone} position={[px, 0, pz]} />
          ))}
          <mesh ref={animRef} geometry={GEO.orb} material={mats.accent} position={[0, 2.95, 0]} scale={0.85} />
          {glbGeo && (
            <>
              <mesh geometry={glbGeo} material={mats.glb} position={[1.7, 0.1, 0.6]} scale={0.9} rotation={[0, 0.4, 0]} />
              <mesh geometry={glbGeo} material={mats.glb} position={[-1.7, 0.1, -0.5]} scale={0.8} rotation={[0, -0.5, 0]} />
            </>
          )}
        </group>
      )}
    </group>
  )
}
