import * as THREE from 'three'
import { pbr } from './mats'
import { ARENA, GRENADE } from './config'
import { groundHeight, resolveCircle, type Box } from './collision'

export type PickupKind = 'ammo' | 'health'

interface Pickup {
  mesh: THREE.Group
  kind: PickupKind
  x: number
  z: number
  age: number
}

export class Pickups {
  private list: Pickup[] = []
  private ammoMat = pbr({ color: 0xd9a441, emissive: 0x6b4a10, roughness: 0.5 })
  private healthMat = pbr({ color: 0xf4f6f8, emissive: 0x333a44, roughness: 0.5 })
  private crossMat = pbr({ color: 0xe0364c, emissive: 0x7a1020 })
  private boxGeo = new THREE.BoxGeometry(0.5, 0.34, 0.34)
  private barA = new THREE.BoxGeometry(0.28, 0.08, 0.36)
  private barB = new THREE.BoxGeometry(0.08, 0.28, 0.36)

  constructor(private scene: THREE.Scene) {}

  spawn(kind: PickupKind, x: number, z: number) {
    const g = new THREE.Group()
    const base = new THREE.Mesh(this.boxGeo, kind === 'ammo' ? this.ammoMat : this.healthMat)
    base.castShadow = true
    g.add(base)
    if (kind === 'health') {
      const a = new THREE.Mesh(this.barA, this.crossMat)
      const b = new THREE.Mesh(this.barB, this.crossMat)
      g.add(a, b)
    }
    g.position.set(x, 0.6, z)
    this.scene.add(g)
    this.list.push({ mesh: g, kind, x, z, age: 0 })
  }

  update(dt: number, px: number, pz: number, onCollect: (k: PickupKind) => void) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]
      p.age += dt
      p.mesh.rotation.y += dt * 1.8
      p.mesh.position.y = 0.6 + Math.sin(p.age * 3) * 0.08
      if (Math.hypot(px - p.x, pz - p.z) < 1.3) {
        onCollect(p.kind)
        this.scene.remove(p.mesh)
        this.list.splice(i, 1)
      } else if (p.age > 40) {
        this.scene.remove(p.mesh)
        this.list.splice(i, 1)
      }
    }
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.mesh)
    this.list = []
  }

  dispose() {
    this.clear()
    for (const m of [this.ammoMat, this.healthMat, this.crossMat]) m.dispose()
    for (const g of [this.boxGeo, this.barA, this.barB]) g.dispose()
  }
}

interface Grenade {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  fuse: number
}

export class Grenades {
  private list: Grenade[] = []
  private geo = new THREE.SphereGeometry(0.11, 12, 10)
  private mat = pbr({ color: 0x2f3a2a, roughness: 0.5, metalness: 0.4 })

  constructor(private scene: THREE.Scene) {}

  throwFrom(origin: THREE.Vector3, dir: THREE.Vector3, inherit: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.geo, this.mat)
    mesh.position.copy(origin).addScaledVector(dir, 0.6)
    mesh.castShadow = true
    this.scene.add(mesh)
    const vel = dir.clone().multiplyScalar(GRENADE.speed).add(inherit)
    vel.y += 3.2
    this.list.push({ mesh, vel, fuse: GRENADE.fuse })
  }

  update(dt: number, boxes: Box[], onExplode: (pos: THREE.Vector3) => void) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i]
      g.fuse -= dt
      g.vel.y -= 20 * dt
      const p = g.mesh.position
      const attempted = { x: p.x + g.vel.x * dt, z: p.z + g.vel.z * dt }
      const resolved = { ...attempted }
      resolveCircle(resolved, 0.12, p.y - 0.1, boxes, ARENA.half)
      if (Math.abs(resolved.x - attempted.x) > 1e-4) g.vel.x *= -0.4
      if (Math.abs(resolved.z - attempted.z) > 1e-4) g.vel.z *= -0.4
      p.x = resolved.x
      p.z = resolved.z
      p.y += g.vel.y * dt
      const floor = groundHeight(p.x, p.z, 0.12, p.y, boxes) + 0.11
      if (p.y < floor) {
        p.y = floor
        g.vel.y = Math.abs(g.vel.y) > 2 ? -g.vel.y * 0.4 : 0
        g.vel.x *= 0.7
        g.vel.z *= 0.7
      }
      g.mesh.rotation.x += dt * 8
      if (g.fuse <= 0) {
        const pos = p.clone()
        this.scene.remove(g.mesh)
        this.list.splice(i, 1)
        onExplode(pos)
      }
    }
  }

  clear() {
    for (const g of this.list) this.scene.remove(g.mesh)
    this.list = []
  }

  dispose() {
    this.clear()
    this.geo.dispose()
    this.mat.dispose()
  }
}
