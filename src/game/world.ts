import * as THREE from 'three'
import { pbr } from './mats'
import { ARENA } from './config'
import { boxFrom, type Box } from './collision'
import { getMap, type MapDef, type MapId } from './maps'
import { PropFactory } from './props'
import { SAFE, loadTex } from './mats'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

export interface World {
  map: MapDef
  boxes: Box[]
  spawns: { x: number; z: number }[]
  ambush: { x: number; z: number }[]
  playerStart: { x: number; z: number }
  update: (dt: number) => void
  dispose: () => void
}

function softDot() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(c)
}

/** Streams in an HDRI: real sky behind the arena, image-based light on every surface, and a sun that matches. */
async function loadSky(scene: THREE.Scene, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, name: string, hemiPower: number, fallbackSun: [number, number, number], bag: { dispose: () => void }[]) {
  try {
    const tex = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(`/assets/hdr/${name}.hdr`)
    tex.mapping = THREE.EquirectangularReflectionMapping
    const img = tex.image as { data: Float32Array; width: number; height: number }
    let best = 0
    let bi = -1
    for (let i = 0; i < img.width * img.height; i++) {
      const lum = 0.2126 * img.data[i * 4] + 0.7152 * img.data[i * 4 + 1] + 0.0722 * img.data[i * 4 + 2]
      if (lum > best) {
        best = lum
        bi = i
      }
    }
    if (bi >= 0 && best > 30) {
      const col = bi % img.width
      const row = Math.floor(bi / img.width)
      const phi = ((col + 0.5) / img.width - 0.5) * Math.PI * 2
      const elev = Math.PI * (0.5 - (row + 0.5) / img.height)
      sun.position.set(Math.cos(phi) * Math.cos(elev), Math.max(0.2, Math.sin(elev)), Math.sin(phi) * Math.cos(elev)).multiplyScalar(120)
    } else {
      sun.position.set(...fallbackSun)
    }
    scene.background = tex
    // Match the distance fog to the real horizon colour so the arena melts into the sky.
    const rows = [Math.floor(img.height * (0.5 - 6 / 180)), Math.floor(img.height * 0.5)]
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = rows[0]; y < rows[1]; y++) {
      for (let x = 0; x < img.width; x += 4) {
        const i = (y * img.width + x) * 4
        r += img.data[i]
        g += img.data[i + 1]
        b += img.data[i + 2]
        n++
      }
    }
    if (n > 0 && scene.fog) {
      const k = Math.min(1, 0.85 / Math.max(r / n, g / n, b / n, 0.001))
      ;(scene.fog as THREE.FogExp2).color.setRGB((r / n) * k, (g / n) * k, (b / n) * k)
    }
    if (!SAFE) {
      const pmrem = new THREE.PMREMGenerator(sceneRenderer())
      scene.environment = pmrem.fromEquirectangular(tex).texture
      scene.environmentIntensity = 0.85
      pmrem.dispose()
      hemi.intensity = hemiPower * 0.35
    }
    bag.push(tex)
  } catch (err) {
    console.warn('Sky failed to load, keeping the flat sky', err)
  }
}

let rendererRef: THREE.WebGLRenderer | null = null
export function registerRenderer(r: THREE.WebGLRenderer) {
  rendererRef = r
}
function sceneRenderer() {
  if (!rendererRef) throw new Error('Renderer not registered')
  return rendererRef
}

export function buildWorld(scene: THREE.Scene, mapId: MapId): World {
  const map = getMap(mapId)
  const th = map.theme
  const half = map.half
  ARENA.half = half
  const root = new THREE.Group()
  scene.add(root)
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o)
    return o
  }

  scene.fog = new THREE.FogExp2(th.fog, th.fogDensity)
  scene.background = new THREE.Color(th.skyMid)
  const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiPower)
  root.add(hemi)
  const sun = new THREE.DirectionalLight(th.sun, th.sunPower)
  sun.position.set(...th.sunPos)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  const ext = Math.min(half, 70)
  sc.left = -ext
  sc.right = ext
  sc.top = ext
  sc.bottom = -ext
  sc.near = 10
  sc.far = 220
  sun.shadow.bias = -0.0005
  root.add(sun)
  void loadSky(scene, sun, hemi, th.hdr, th.hemiPower, th.sunPos, disposables)

  const groundMap = track(loadTex(`${th.groundTex}_diff`, true, [half / 2, half / 2]))
  const groundNormal = track(loadTex(`${th.groundTex}_nor_gl`, false, [half / 2, half / 2]))
  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(half * 2, half * 2)),
    track(pbr({ map: groundMap, normalMap: groundNormal, roughness: 0.95, color: new THREE.Color().setScalar(th.groundBoost) })),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const props = new PropFactory(root, { wall: th.wall, brick: th.brick })
  for (const p of map.props) props.add(p)
  const boxes = props.boxes

  const t = 2
  const ph = 8
  const rim = pbr({ color: new THREE.Color(th.wall).multiplyScalar(0.6), roughness: 1 })
  track(rim)
  const wallPiece = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, ph, d)), rim)
    m.position.set(x, ph / 2, z)
    m.castShadow = true
    root.add(m)
    boxes.push(boxFrom(x, z, w, d, ph))
  }
  wallPiece(0, -half - t / 2, half * 2 + t * 2, t)
  wallPiece(0, half + t / 2, half * 2 + t * 2, t)
  wallPiece(-half - t / 2, 0, t, half * 2)
  wallPiece(half + t / 2, 0, t, half * 2)

  const inside = (x: number, z: number, r: number) =>
    !boxes.some((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) && Math.abs(x) < half - 2 && Math.abs(z) < half - 2

  const spawns: { x: number; z: number }[] = []
  for (let i = -half + 6; i <= half - 6; i += 12) {
    for (const [x, z] of [[i, -half + 3], [i, half - 3], [-half + 3, i], [half - 3, i]]) if (inside(x, z, 0.7)) spawns.push({ x, z })
  }

  const ambush: { x: number; z: number }[] = []
  const reach = (b: Box) => [
    [b.minX - 1.1, (b.minZ + b.maxZ) / 2], [b.maxX + 1.1, (b.minZ + b.maxZ) / 2],
    [(b.minX + b.maxX) / 2, b.minZ - 1.1], [(b.minX + b.maxX) / 2, b.maxZ + 1.1],
  ]
  for (const p of map.props) {
    if (p.kind !== 'car' && p.kind !== 'container' && p.kind !== 'sandbag' && p.kind !== 'crate') continue
    const cand = reach(boxFrom(p.x, p.z, p.w, p.d, p.h))
    const [x, z] = cand[Math.floor(Math.random() * 4)]
    if (inside(x, z, 0.6) && Math.hypot(x - map.start.x, z - map.start.z) > 22) ambush.push({ x, z })
  }

  // Drifting smoke from wrecks plus flickering flames.
  const smokeTex = track(softDot())
  const N = Math.max(1, props.smoke.length) * 10
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const age = new Float32Array(N)
  const src: THREE.Vector3[] = props.smoke.length ? props.smoke : [new THREE.Vector3(0, -50, 0)]
  const smokeColor = new THREE.Color(th.smoke)
  const fogColor = new THREE.Color(th.fog)
  const reset = (i: number) => {
    const s = src[Math.floor(i / 10) % src.length]
    pos[i * 3] = s.x + (Math.random() - 0.5) * 0.6
    pos[i * 3 + 1] = s.y
    pos[i * 3 + 2] = s.z + (Math.random() - 0.5) * 0.6
    age[i] = Math.random() * 0.2
  }
  for (let i = 0; i < N; i++) {
    reset(i)
    age[i] = Math.random()
  }
  const smokeGeo = track(new THREE.BufferGeometry())
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  smokeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const smokeMat = track(new THREE.PointsMaterial({ size: 2.8, map: smokeTex, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }))
  const smoke = new THREE.Points(smokeGeo, smokeMat)
  smoke.frustumCulled = false
  if (props.smoke.length) root.add(smoke)

  let clock = 0
  const update = (dt: number) => {
    clock += dt
    for (let i = 0; i < N; i++) {
      age[i] += dt / 5
      if (age[i] >= 1) reset(i)
      pos[i * 3] += dt * (0.5 + age[i])
      pos[i * 3 + 1] += dt * (1.6 + age[i] * 0.8)
      const c = smokeColor.clone().lerp(fogColor, age[i])
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    smokeGeo.attributes.position.needsUpdate = true
    smokeGeo.attributes.color.needsUpdate = true
    props.flames.forEach((f, i) => {
      const k = 0.8 + Math.sin(clock * 11 + i * 2) * 0.25 + Math.sin(clock * 23 + i) * 0.1
      f.scale.set(k, 0.7 + k * 0.7, k)
    })
  }

  return {
    map,
    boxes,
    spawns,
    ambush,
    playerStart: map.start,
    update,
    dispose: () => {
      scene.remove(root)
      props.dispose()
      for (const d of disposables) d.dispose()
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose()
      })
    },
  }
}
