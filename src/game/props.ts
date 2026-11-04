import * as THREE from 'three'
import { pbr } from './mats'
import { boxFrom, type Box } from './collision'
import { loadTex } from './mats'

export type PropKind = 'crate' | 'wall' | 'barrier' | 'container' | 'car' | 'sandbag' | 'barrel' | 'rubble' | 'tank' | 'roof'

export interface Prop {
  kind: PropKind
  x: number
  z: number
  w: number
  d: number
  h: number
  y?: number
  color?: number
  fire?: boolean
}

export interface PropTheme {
  wall: string
  brick: boolean
}

const NEUTRAL = 0xffffff

function tex(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  if (g) paint(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function speckle(g: CanvasRenderingContext2D, s: number, n: number, a: number) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() > 0.5 ? 255 : 0
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

/** Box with UVs scaled to world size so textures tile instead of stretching. */
function uvBox(w: number, h: number, d: number, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.getAttribute('uv')
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile)
    }
  }
  return g
}

export class PropFactory {
  readonly boxes: Box[] = []
  readonly smoke: THREE.Vector3[] = []
  readonly flames: THREE.Mesh[] = []
  private disposables: { dispose: () => void }[] = []
  private mats = new Map<string, THREE.MeshStandardMaterial>()
  private textures: Record<string, THREE.Texture> = {}

  constructor(private root: THREE.Group, private theme: PropTheme) {}

  private t<T extends { dispose: () => void }>(o: T): T {
    this.disposables.push(o)
    return o
  }

  private texture(name: string, make: () => THREE.Texture) {
    if (!this.textures[name]) this.textures[name] = this.t(make())
    return this.textures[name]
  }

  private material(key: string, color: number, map: THREE.Texture | null, rough = 0.9, metal = 0.05, emissive = 0, normal: THREE.Texture | null = null) {
    const k = `${key}:${color}`
    let m = this.mats.get(k)
    if (!m) {
      m = this.t(pbr({ color, map, roughness: rough, metalness: metal, emissive, normalMap: normal }))
      this.mats.set(k, m)
    }
    return m
  }

  /** A Poly Haven PBR surface: colour map plus normal map. */
  private surf(name: string, color = NEUTRAL, rough = 0.9, metal = 0.05) {
    const map = this.texture(`d:${name}`, () => loadTex(`${name}_diff`, true))
    const nrm = this.texture(`n:${name}`, () => loadTex(`${name}_nor_gl`, false))
    return this.material(`s:${name}`, color, map, rough, metal, 0, nrm)
  }

  private crateTex() {
    return this.texture('crate', () => tex(256, (g, s) => {
      g.fillStyle = '#7a5a34'
      g.fillRect(0, 0, s, s)
      for (let y = 0; y < s; y += 32) {
        g.fillStyle = y % 64 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'
        g.fillRect(0, y, s, 30)
      }
      g.strokeStyle = '#4a361f'
      g.lineWidth = 14
      g.strokeRect(7, 7, s - 14, s - 14)
      speckle(g, s, 1500, 0.1)
    }))
  }

  private bags() {
    return this.texture('bags', () => tex(256, (g, s) => {
      g.fillStyle = '#8c7b57'
      g.fillRect(0, 0, s, s)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 4; c++) {
          const off = r % 2 ? 32 : 0
          g.fillStyle = `rgb(${158 + Math.random() * 12},${140 + Math.random() * 10},${102 + Math.random() * 10})`
          g.beginPath()
          g.roundRect(c * 64 + off + 3, r * 32 + 3, 58, 26, 10)
          g.fill()
        }
      }
      speckle(g, s, 1500, 0.1)
    }))
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.root, shadow = true) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  private slab(p: Prop, mat: THREE.Material) {
    const y = p.y ?? 0
    this.mesh(this.t(uvBox(p.w, p.h, p.d, 2.5)), mat, p.x, y + p.h / 2, p.z)
    this.boxes.push(boxFrom(p.x, p.z, p.w, p.d, p.h, y))
  }

  add(p: Prop) {
    switch (p.kind) {
      case 'crate':
        return this.slab(p, this.material('crate', 0xffffff, this.crateTex(), 0.8))
      case 'container':
        return this.slab(p, this.surf('corrugated_iron_02', new THREE.Color(p.color ?? 0x8a3b2e).multiplyScalar(2.4).getHex(), 0.5, 0.45))
      case 'sandbag':
        return this.slab(p, this.material('bags', 0xffffff, this.bags(), 1))
      case 'barrier':
        return this.slab(p, this.surf('concrete_floor_worn_001', 0xc9c1b1, 0.95))
      case 'roof':
        return this.slab(p, this.surf('concrete_wall_008', 0x8a8e92, 0.95))
      case 'wall':
        return this.slab(p, this.theme.brick ? this.surf('brick_wall_02', 0xd8cfc6, 0.92) : this.surf('concrete_wall_008', new THREE.Color(this.theme.wall).multiplyScalar(1.5).getHex(), 0.95))
      case 'car':
        return this.car(p)
      case 'barrel':
        return this.barrel(p)
      case 'tank':
        return this.tank(p)
      case 'rubble':
        return this.rubble(p)
    }
  }

  private barrel(p: Prop) {
    const color = p.color ?? [0x9a3028, 0x2f5a8a, 0x6a5a2a][Math.floor(Math.random() * 3)]
    const geo = this.t(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 14))
    this.mesh(geo, this.material('barrel', color, null, 0.5, 0.5), p.x, 0.55, p.z)
    const ring = this.t(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14))
    this.mesh(ring, this.material('ring', 0x1a1a1a, null, 0.6, 0.6), p.x, 0.8, p.z)
    this.boxes.push(boxFrom(p.x, p.z, 0.8, 0.8, 1.1))
  }

  private tank(p: Prop) {
    const r = p.w / 2
    const geo = this.t(new THREE.CylinderGeometry(r, r, p.h, 24))
    this.mesh(geo, this.material('tank', p.color ?? 0xb8b4aa, null, 0.6, 0.4), p.x, p.h / 2, p.z)
    const cap = this.t(new THREE.CylinderGeometry(r * 0.9, r, 0.3, 24))
    this.mesh(cap, this.material('tankcap', 0x555a60, null, 0.6, 0.4), p.x, p.h + 0.1, p.z)
    this.boxes.push(boxFrom(p.x, p.z, p.w, p.w, p.h))
  }

  private rubble(p: Prop) {
    const mat = this.surf('concrete_wall_008', 0x77736e, 1)
    for (let i = 0; i < 7; i++) {
      const s = 0.4 + Math.random() * 0.9
      const m = this.mesh(this.t(new THREE.BoxGeometry(s, s * 0.7, s * 1.2)), mat, p.x + (Math.random() - 0.5) * (p.w - 0.8), s * 0.3, p.z + (Math.random() - 0.5) * (p.d - 0.8))
      m.rotation.set(Math.random() * 0.5, Math.random() * 3, Math.random() * 0.5)
    }
    this.boxes.push(boxFrom(p.x, p.z, p.w, p.d, p.h))
  }

  private car(p: Prop) {
    const g = new THREE.Group()
    const body = p.color ?? [0x7a6a60, 0x8a6a58, 0x626872, 0x7a6048, 0x8a4f40][Math.floor(Math.random() * 5)]
    const char = this.surf('rusty_metal_02', body, 0.7, 0.55)
    const dark = this.material('cardark', 0x0b0b0c, null, 0.9, 0.1)
    const rust = this.material('rust', 0x74401f, null, 1)
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rz = 0) => {
      const mesh = this.mesh(this.t(new THREE.BoxGeometry(w, h, d)), m, x, y, z, g)
      mesh.rotation.z = rz
      return mesh
    }
    add(4.5, 0.7, 1.9, 0, 0.62, 0, char)
    add(2.3, 0.62, 1.72, -0.2, 1.26, 0, char)
    add(2.0, 0.42, 1.76, -0.2, 1.3, 0, dark)
    add(1.35, 0.1, 1.76, 1.55, 1.02, 0, char, 0.16)
    add(0.12, 0.35, 1.5, -1.5, 1.2, 0, char, 0.05)
    add(0.9, 0.18, 1.94, -0.8 + Math.random() * 1.8, 0.78, 0, rust)
    add(4.52, 0.12, 1.92, 0, 0.3, 0, dark)
    for (const [x, z] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {
      const wheel = this.mesh(this.t(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14)), dark, x, 0.3, z, g)
      wheel.rotation.x = Math.PI / 2
    }
    if (p.fire) {
      const flame = this.mesh(this.t(new THREE.BoxGeometry(0.9, 0.35, 0.9)), this.t(new THREE.MeshBasicMaterial({ color: 0xff7a1a })), 1.5, 1.2, 0, g, false)
      this.flames.push(flame)
    }
    g.position.set(p.x, 0, p.z)
    if (p.d > p.w) g.rotation.y = Math.PI / 2
    this.root.add(g)
    this.boxes.push(boxFrom(p.x, p.z, p.w, p.d, 1.5))
    if (p.fire || Math.random() < 0.35) this.smoke.push(new THREE.Vector3(p.x + (p.d > p.w ? 0 : 1.5), 1.4, p.z + (p.d > p.w ? 1.5 : 0)))
  }

  dispose() {
    for (const d of this.disposables) d.dispose()
  }
}
