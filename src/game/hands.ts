import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assetUrl } from './assets'
import { SAFE, pbr } from './mats'

export const HAND_PATH = 'public/assets/models/hand.glb'
const HAND_URL = assetUrl('models/hand.glb')

let source: GLTF | null = null
let loading: Promise<void> | null = null

/** Downloads the anatomical hand model used in first person. */
export function loadHandModel(): Promise<void> {
  if (source) return Promise.resolve()
  loading ??= (async () => {
    const res = await fetch(HAND_URL)
    if (!res.ok) throw new Error(`Hand model not found at ${HAND_URL} (HTTP ${res.status}). Commit ${HAND_PATH} to your repository.`)
    const buf = await res.arrayBuffer()
    if (new TextDecoder().decode(buf.slice(0, 4)) !== 'glTF') throw new Error(`${HAND_URL} is not a valid model file.`)
    source = await new GLTFLoader().parseAsync(buf, '')
  })()
  return loading
}

export interface Curl {
  index: number
  middle: number
  ring: number
  pinky: number
  thumb: number
}

export interface HandPose {
  /** Wrist position in the weapon's local space (metres). */
  pos: [number, number, number]
  /** Euler rotation in radians. */
  rot: [number, number, number]
  curl: Curl
}

/** Hand poses, tuned for a two-handed rifle grip. Mutable so they can be adjusted while testing. */
export const HAND_POSE: { right: HandPose; left: HandPose } = {
  right: { pos: [0.04, -0.07, -0.06], rot: [0, Math.PI, Math.PI / 2], curl: { index: 0.7, middle: 1, ring: 1, pinky: 1, thumb: 0.6 } },
  left: { pos: [-0.06, -0.05, 0.2], rot: [0, Math.PI, -Math.PI / 2], curl: { index: 0.8, middle: 0.9, ring: 0.9, pinky: 0.9, thumb: 0.4 } },
}

const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'] as const
const SKIN = 0xd9a283

/** One realistic bare human hand with posable fingers. */
export class RealHand {
  readonly root = new THREE.Group()
  private fingers: Record<(typeof FINGERS)[number], { bones: THREE.Object3D[]; rest: THREE.Quaternion[] }>

  constructor(mirror: boolean) {
    if (!source) throw new Error('Hand model not loaded')
    const model = SkeletonUtils.clone(source.scene) as THREE.Group
    model.updateMatrixWorld(true)
    const wrist = model.getObjectByName('hand_r')
    const origin = wrist ? wrist.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()
    model.position.sub(origin)
    const pivot = new THREE.Group()
    pivot.add(model)
    pivot.scale.setScalar(1.25)
    if (mirror) pivot.scale.x = -1.25
    this.root.add(pivot)

    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      mesh.castShadow = false
      const m = SAFE ? pbr({ color: SKIN, roughness: 0.6 }) : (mesh.material as THREE.MeshStandardMaterial).clone()
      if (!SAFE) {
        m.color.set(SKIN)
        m.roughness = 0.58
        m.metalness = 0
        m.envMapIntensity = 0.8
      }
      if (mirror) m.side = THREE.DoubleSide
      mesh.material = m
    })

    const find = (n: string) => model.getObjectByName(n) ?? null
    this.fingers = {} as typeof this.fingers
    for (const f of FINGERS) {
      const bones = [1, 2, 3].map((i) => find(`${f}_0${i}_r`)).filter((b): b is THREE.Object3D => !!b)
      this.fingers[f] = { bones, rest: bones.map((b) => b.quaternion.clone()) }
    }
  }

  setPose(p: HandPose) {
    this.root.position.set(...p.pos)
    this.root.rotation.set(...p.rot)
    const q = new THREE.Quaternion()
    const axis = new THREE.Vector3(0, 0, 1)
    for (const f of FINGERS) {
      const { bones, rest } = this.fingers[f]
      bones.forEach((b, i) => {
        // Knuckles bend a little less than the middle joints, like a real grip.
        const k = f === 'thumb' ? [0.5, 0.7, 0.6][i] : [0.75, 1, 0.8][i]
        q.setFromAxisAngle(axis, p.curl[f] * k * 1.15)
        b.quaternion.copy(rest[i]).multiply(q)
      })
    }
  }

  dispose() {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) (mesh.material as THREE.Material).dispose()
    })
  }
}
