import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SAFE, pbr } from './mats'
import { MODEL_PATH, MODEL_URL } from './assets'

let source: GLTF | null = null
let loading: Promise<void> | null = null
let baseHeight = 1.8

/** Downloads the soldier model and checks it really is a GLB (a missing file often comes back as an HTML page). */
async function fetchModel(): Promise<GLTF> {
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Soldier model not found at ${MODEL_URL} (HTTP ${res.status}). Commit ${MODEL_PATH} to your repository.`)
  const buf = await res.arrayBuffer()
  if (new TextDecoder().decode(buf.slice(0, 4)) !== 'glTF') {
    throw new Error(`${MODEL_URL} is not a valid model file. Commit ${MODEL_PATH} to your repository.`)
  }
  return new GLTFLoader().parseAsync(buf, '')
}

export function loadCharacters(): Promise<void> {
  if (source) return Promise.resolve()
  loading ??= fetchModel().then((g) => {
    source = g
    g.scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(g.scene)
    baseHeight = Math.max(0.5, box.max.y - box.min.y)
  })
  return loading
}

export function charactersReady() {
  return source !== null
}

export type GunKind = 'rifle' | 'smg' | 'lmg' | 'shotgun' | 'sniper' | 'pistol'

export interface HumanOptions {
  /** Colour multiplied over the camouflage texture. */
  tint: number
  height: number
  bulk?: number
  gun: GunKind
}

const rb = (w: number, h: number, d: number, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, r)
const metal = (c: number, rough = 0.4, m = 0.8) => pbr({ color: c, roughness: rough, metalness: m })

/** A held weapon modelled along +Z with the pistol grip at the origin. */
export function buildHeldGun(kind: GunKind): THREE.Group {
  const g = new THREE.Group()
  const body = metal(0x1b1d21, 0.55, 0.6)
  const steel = metal(0x7a828c, 0.35, 0.9)
  const poly = pbr({ color: 0x15171a, roughness: 0.8 })
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  const cyl = (r: number, len: number, m: THREE.Material, x: number, y: number, z: number) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 12)
    geo.rotateX(Math.PI / 2)
    return add(geo, m, x, y, z)
  }
  if (kind === 'pistol') {
    add(rb(0.04, 0.07, 0.2), body, 0, 0.04, 0.06)
    add(rb(0.035, 0.1, 0.05), poly, 0, -0.03, 0).rotation.x = 0.25
    return g
  }
  const rec = metal(0x24272c, 0.5, 0.7)
  const furn = pbr({ color: 0x2b2e33, roughness: 0.75, metalness: 0.15 })
  const dark = metal(0x0e0f11, 0.6, 0.5)
  const lens = pbr({ color: 0x6fd3ff, roughness: 0.1, metalness: 0.2, emissive: 0x0a3a55 })
  const tilt = (m: THREE.Mesh, x: number) => {
    m.rotation.x = x
    return m
  }
  const long = kind === 'sniper' ? 1.45 : kind === 'smg' ? 0.7 : kind === 'shotgun' ? 1.1 : kind === 'lmg' ? 1.15 : 1
  // receiver and furniture
  add(rb(0.052, 0.088, 0.26 * Math.min(long, 1.1)), rec, 0, 0.05, 0.03)
  add(rb(0.044, 0.06, 0.1), rec, 0, 0.0, -0.02)
  add(rb(0.034, 0.1, 0.048), furn, 0, -0.045, -0.015).rotation.x = 0.3
  add(rb(0.06, 0.07, 0.3 * long), furn, 0, 0.03, 0.17 + 0.15 * long)
  for (let i = 0; i < 4; i++) add(rb(0.062, 0.012, 0.03), dark, 0, 0.03, 0.12 + i * 0.07 * long + 0.15 * (long - 1))
  // top rail, sights and optic
  add(rb(0.028, 0.012, 0.42 * long), steel, 0, 0.1, 0.12 + 0.12 * (long - 1))
  if (kind !== 'sniper' && kind !== 'shotgun') {
    add(rb(0.04, 0.055, 0.085), dark, 0, 0.135, 0.05)
    add(new THREE.CircleGeometry(0.016, 14), lens, 0, 0.138, 0.0915).rotation.y = Math.PI
  }
  add(rb(0.012, 0.04, 0.012), dark, 0, 0.125, 0.12 + 0.3 * long)
  // barrel and muzzle device
  const barrelZ = 0.18 + 0.32 * long
  cyl(0.011, 0.26 * long, steel, 0, 0.046, barrelZ + 0.12)
  cyl(0.018, 0.07, dark, 0, 0.046, 0.5 * long + 0.28)
  // magazine
  if (kind !== 'shotgun') tilt(add(rb(0.036, kind === 'lmg' ? 0.2 : 0.15, 0.062), dark, 0, -0.11, 0.1), 0.14)
  if (kind === 'lmg') add(rb(0.17, 0.13, 0.12), metal(0x2f3a28, 0.7, 0.3), 0, -0.14, 0.1)
  // stock
  cyl(0.02, 0.16, rec, 0, 0.035, -0.16)
  add(rb(0.046, 0.115, 0.16), furn, 0, 0.0, -0.3).rotation.x = 0.08
  add(rb(0.05, 0.12, 0.02), dark, 0, 0.0, -0.385)
  if (kind === 'sniper') {
    cyl(0.03, 0.3, dark, 0, 0.17, 0.12)
    cyl(0.034, 0.04, dark, 0, 0.17, 0.29)
    cyl(0.026, 0.01, lens, 0, 0.17, 0.31)
  }
  if (kind === 'shotgun') add(rb(0.07, 0.06, 0.16), furn, 0, -0.01, 0.45)
  return g
}

const MUZZLE_Z: Record<GunKind, number> = { rifle: 0.84, smg: 0.56, lmg: 0.95, shotgun: 0.92, sniper: 1.3, pistol: 0.2 }
/** Where the off hand grips, along the gun's Z axis. */
const FOREGRIP_Z: Record<GunKind, number> = { rifle: 0.36, smg: 0.24, lmg: 0.44, shotgun: 0.42, sniper: 0.5, pistol: 0.1 }

let flashMat: THREE.SpriteMaterial | null = null
function flashMaterial() {
  if (!flashMat) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(64, 64, 2, 64, 64, 60)
      grad.addColorStop(0, 'rgba(255,250,220,1)')
      grad.addColorStop(0.25, 'rgba(255,200,100,0.9)')
      grad.addColorStop(1, 'rgba(255,120,30,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
      g.strokeStyle = 'rgba(255,230,160,0.9)'
      g.lineWidth = 3
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3
        g.beginPath()
        g.moveTo(64, 64)
        g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62)
        g.stroke()
      }
    }
    flashMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  }
  return flashMat
}

export interface Human {
  group: THREE.Group
  /** Pass the ground speed in metres per second. */
  setSpeed: (mps: number) => void
  /** 1 plays strides forward, -1 plays them in reverse (smoothed). */
  setDirection: (dir: number) => void
  /** Pitch the weapon up (positive) or down. */
  setAim: (pitch: number) => void
  update: (dt: number) => void
  muzzle: THREE.Object3D
  flash: (on: boolean) => void
  /** Hold the weapon at a world pose instead of the default carry position. Pass null to release. */
  placeGun: (pos: THREE.Vector3 | null, quat?: THREE.Quaternion) => void
  setHeadHidden: (hidden: boolean) => void
  /** Turns the weapon away from where the body faces (third person strafing). */
  setAimYaw: (yaw: number) => void
  setShadows: (on: boolean) => void
  setGun: (kind: GunKind) => void
  /** Tips the body over for a death. progress runs 0..1. */
  fall: (progress: number, dir: number) => void
  dispose: () => void
}

const UP = new THREE.Vector3(0, 1, 0)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()

/** Rotates `bone` in world space so the direction bone -> child points along `dir`. */
function pointBone(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.getWorldPosition(_a)
  child.getWorldPosition(_b)
  _b.sub(_a).normalize()
  _q.setFromUnitVectors(_b, dir)
  bone.getWorldQuaternion(_q2)
  _q2.premultiply(_q)
  const parent = bone.parent
  if (parent) {
    parent.getWorldQuaternion(_q)
    bone.quaternion.copy(_q.invert().multiply(_q2))
  } else {
    bone.quaternion.copy(_q2)
  }
  bone.updateMatrixWorld(true)
}

/** Analytic two-bone IK: places the hand on `target`, bending the elbow towards `pole`. */
function solveArm(upper: THREE.Object3D, lower: THREE.Object3D, hand: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) {
  const p0 = upper.getWorldPosition(new THREE.Vector3())
  const p1 = lower.getWorldPosition(new THREE.Vector3())
  const p2 = hand.getWorldPosition(new THREE.Vector3())
  const l1 = p0.distanceTo(p1)
  const l2 = p1.distanceTo(p2)
  const toT = _c.copy(target).sub(p0)
  const dist = Math.min(Math.max(toT.length(), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.005)
  const axis = toT.normalize()
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const perp = pole.clone().addScaledVector(axis, -pole.dot(axis)).normalize()
  const elbow = p0.clone().addScaledVector(axis, a).addScaledVector(perp, h)
  pointBone(upper, lower, elbow.clone().sub(p0).normalize())
  lower.getWorldPosition(_b)
  hand.getWorldPosition(_a)
  const handPos = _a.clone()
  const forward = target.clone().sub(_b).normalize()
  void handPos
  pointBone(lower, hand, forward)
}

export function createHuman(opts: HumanOptions): Human {
  if (!source) throw new Error('Characters are not loaded yet')
  const root = SkeletonUtils.clone(source.scene) as THREE.Group
  const scale = opts.height / baseHeight
  const holder = new THREE.Group()
  holder.add(root)
  holder.scale.setScalar(scale)
  if (opts.bulk) holder.scale.x *= opts.bulk
  const group = new THREE.Group()
  group.add(holder)

  const mats: THREE.Material[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const src = mesh.material as THREE.MeshStandardMaterial
    let m: THREE.MeshStandardMaterial
    if (SAFE) {
      m = pbr({ color: opts.tint, map: src.map })
    } else {
      m = src.clone()
      m.color.set(opts.tint)
      m.envMapIntensity = 0.9
    }
    mesh.material = m
    mats.push(m)
  })

  const mixer = new THREE.AnimationMixer(root)
  const clip = (n: string) => source?.animations.find((a) => a.name === n)
  const start = (c: THREE.AnimationClip | undefined) => {
    if (!c) return null
    const a = mixer.clipAction(c)
    a.play()
    a.weight = 0
    return a
  }
  const walkClip = clip('walk')
  const idle = start(walkClip ? THREE.AnimationUtils.subclip(walkClip, 'idle', 0, 2, 30) : undefined)
  const walk = start(walkClip)
  const run = start(clip('run'))
  if (idle) {
    idle.weight = 1
    idle.timeScale = 0
  }

  // The weapon lives in character space so it can be aimed independently of the walk cycle.
  const s = opts.height / 1.8
  const gunRoot = new THREE.Group()
  gunRoot.position.set(-0.1 * s, 1.27 * s, 0.34 * s)
  group.add(gunRoot)
  let gun = buildHeldGun(opts.gun)
  let kind = opts.gun
  gunRoot.add(gun)
  const muzzle = new THREE.Object3D()
  const flashMesh = new THREE.Sprite(flashMaterial())
  flashMesh.scale.set(0.5, 0.5, 1)
  flashMesh.visible = false
  muzzle.add(flashMesh)
  muzzle.position.set(0, 0.06, MUZZLE_Z[kind])
  gunRoot.add(muzzle)

  const bone = (n: string) => root.getObjectByName(n) ?? null
  const arms = {
    rUpper: bone('RightArm'), rLower: bone('RightForeArm'), rHand: bone('RightHand'),
    lUpper: bone('LeftArm'), lLower: bone('LeftForeArm'), lHand: bone('LeftHand'),
  }

  let speed = 0
  let aim = 0
  let worldPos: THREE.Vector3 | null = null
  let worldQuat: THREE.Quaternion | null = null
  let headHidden = false
  let aimYaw = 0
  let shadowsOn = true
  const headBones = [bone('Head'), bone('neck')]
  const defaultPos = new THREE.Vector3(-0.1 * s, 1.27 * s, 0.34 * s)
  let fallen = false
  const blend = { idle: 1, walk: 0, run: 0 }
  const gq = new THREE.Quaternion()
  const rTarget = new THREE.Vector3()
  const lTarget = new THREE.Vector3()
  const rPole = new THREE.Vector3()
  const lPole = new THREE.Vector3()

  let dirTarget = 1
  let dirNow = 1
  const update = (dt: number) => {
    if (fallen) return
    dirNow += (dirTarget - dirNow) * Math.min(1, dt * 10)
    const wantRun = speed > 2.6 ? 1 : 0
    const wantWalk = speed > 0.2 && !wantRun ? 1 : 0
    const k = Math.min(1, dt * 9)
    blend.idle += ((speed <= 0.2 ? 1 : 0) - blend.idle) * k
    blend.walk += (wantWalk - blend.walk) * k
    blend.run += (wantRun - blend.run) * k
    if (idle) idle.weight = blend.idle
    if (walk) {
      walk.weight = blend.walk
      walk.timeScale = Math.max(0.4, speed / 1.5) * dirNow
    }
    if (run) {
      run.weight = blend.run
      run.timeScale = Math.max(0.5, speed / 4.0) * dirNow
    }
    mixer.update(dt)

    group.updateMatrixWorld(true)
    if (worldPos && worldQuat) {
      gunRoot.position.copy(group.worldToLocal(_a.copy(worldPos)))
      group.getWorldQuaternion(_q2).invert()
      gunRoot.quaternion.copy(_q2.multiply(worldQuat))
    } else {
      gunRoot.position.copy(defaultPos).applyAxisAngle(UP, aimYaw)
      gunRoot.rotation.set(-aim, aimYaw, 0, 'YXZ')
    }
    for (const hb of headBones) hb?.scale.setScalar(headHidden ? 0.001 : 1)
    group.updateMatrixWorld(true)
    if (arms.rUpper && arms.rLower && arms.rHand && arms.lUpper && arms.lLower && arms.lHand) {
      gunRoot.getWorldQuaternion(gq)
      gunRoot.localToWorld(rTarget.set(0.005, -0.045, 0.015))
      gunRoot.localToWorld(lTarget.set(0.02, -0.01, FOREGRIP_Z[kind]))
      rPole.set(-0.5, -1, -0.4).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))
      lPole.set(0.4, -1, -0.3).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))
      solveArm(arms.rUpper, arms.rLower, arms.rHand, rTarget, rPole)
      solveArm(arms.lUpper, arms.lLower, arms.lHand, lTarget, lPole)
    }
  }

  return {
    group,
    setSpeed: (mps) => {
      speed = mps
    },
    setDirection: (d) => {
      dirTarget = d
    },
    setAim: (pitch) => {
      aim = pitch
    },
    update,
    muzzle,
    flash: (on) => {
      flashMesh.visible = on
      if (on) flashMesh.material.rotation = Math.random() * 6.28
    },
    placeGun: (pos, quat) => {
      worldPos = pos ? pos.clone() : null
      worldQuat = pos && quat ? quat.clone() : null
    },
    setHeadHidden: (h) => {
      headHidden = h
    },
    setAimYaw: (y) => {
      aimYaw = y
    },
    setShadows: (on) => {
      if (on === shadowsOn) return
      shadowsOn = on
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = on
      })
    },
    setGun: (next) => {
      gunRoot.remove(gun)
      gun = buildHeldGun(next)
      kind = next
      gunRoot.add(gun)
      muzzle.position.z = MUZZLE_Z[next]
    },
    fall: (progress, dir) => {
      fallen = true
      const t = Math.min(1, progress)
      const ease = 1 - (1 - t) * (1 - t)
      holder.rotation.set(-Math.PI / 2 * ease * dir, 0, (1 - dir) * 0.4 * ease)
      holder.position.y = 0.12 * ease
      gunRoot.visible = t < 0.5
    },
    dispose: () => {
      mixer.stopAllAction()
      group.removeFromParent()
      for (const m of mats) m.dispose()
    },
  }
}
