import * as THREE from 'three'
import { locomotion } from './locomotion'
import { ARENA, ENEMIES, type EnemyDef } from './config'
import { createHuman, type GunKind, type Human } from './characters'
import { lineOfSight, raySphere, rayBox, resolveCircle, type Box } from './collision'
import type { EnemyKind } from './types'

export interface EnemyShot {
  enemy: Enemy
  from: THREE.Vector3
  hit: boolean
  damage: number
}

export interface HitResult {
  dist: number
  head: boolean
}

let markerMat: THREE.SpriteMaterial | null = null
function markerMaterial() {
  if (!markerMat) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = '#e8343f'
      g.strokeStyle = 'rgba(0,0,0,0.7)'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(8, 12)
      g.lineTo(56, 12)
      g.lineTo(32, 54)
      g.closePath()
      g.stroke()
      g.fill()
    }
    markerMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true, fog: false })
  }
  return markerMat
}
const LOOKS: Record<EnemyKind, { tint: number; bulk: number; gun: GunKind }> = {
  grunt: { tint: 0xd2b88e, bulk: 1, gun: 'rifle' },
  rusher: { tint: 0x8a7468, bulk: 0.96, gun: 'smg' },
  heavy: { tint: 0x7d8590, bulk: 1.16, gun: 'lmg' },
}

export class Enemy {
  readonly group = new THREE.Group()
  readonly def: EnemyDef
  hp: number
  x: number
  z: number
  dead = false
  deathT = 0
  private human: Human
  private animSpeed = 0
  private bodyOff = 0
  private lodAcc = 0
  private lodShadow = true
  private fallDir = Math.random() < 0.7 ? 1 : -1
  private muzzleT = 0
  private fireCd: number
  private sightT = 0
  private strafeDir = Math.random() < 0.5 ? 1 : -1
  private strafeT = 1 + Math.random() * 2
  private avoidT = 0
  private avoidDir = 1
  private meleeCd = 0

  hidden: boolean
  justAlerted = false
  marker: THREE.Sprite
  crouch = 1
  private hideT = 0
  private provoked = false

  constructor(kind: EnemyKind, x: number, z: number, wave: number, hidden = false) {
    this.def = ENEMIES[kind]
    this.hp = Math.round(this.def.health * (1 + Math.min(wave - 1, 12) * 0.05))
    this.x = x
    this.z = z
    this.fireCd = 0.8 + Math.random() * 0.8
    const look = LOOKS[kind]
    this.human = createHuman({ tint: look.tint, height: this.def.height, bulk: look.bulk, gun: look.gun })
    this.group.add(this.human.group)
    this.group.position.set(x, 0, z)
    this.hidden = hidden
    this.crouch = hidden ? 0.68 : 1
    this.human.group.scale.y = this.crouch
    this.marker = new THREE.Sprite(markerMaterial())
    this.marker.position.y = this.def.height + 0.55
    const ms = kind === 'heavy' ? 0.62 : 0.45
    this.marker.scale.set(ms, ms, 1)
    this.marker.renderOrder = 20
    this.marker.visible = !hidden
    this.group.add(this.marker)
  }

  get headCenter() {
    return new THREE.Vector3(this.x, (this.def.height - 0.14) * this.crouch, this.z)
  }

  get chestCenter() {
    return new THREE.Vector3(this.x, this.def.height * 0.62 * this.crouch, this.z)
  }

  private bodyBox(): Box {
    const r = this.def.radius * 0.85
    return { minX: this.x - r, maxX: this.x + r, minY: 0, maxY: (this.def.height - 0.32) * this.crouch, minZ: this.z - r, maxZ: this.z + r }
  }

  /** Ray test against head sphere and body box. dir must be normalised. */
  hitTest(o: THREE.Vector3, d: THREE.Vector3, max: number): HitResult | null {
    if (this.dead) return null
    const hc = this.headCenter
    const headR = 0.2 * (this.def.height / 1.8) * (this.def.kind === 'heavy' ? 1.3 : 1)
    const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, hc.x, hc.y, hc.z, headR)
    const tb = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, this.bodyBox())
    if (th <= max && th <= tb) return { dist: th, head: true }
    if (tb <= max) return { dist: tb, head: false }
    return null
  }

  /** Applies damage and returns true when this blow killed the enemy. */
  damage(amount: number): boolean {
    if (this.dead) return false
    this.hp -= amount
    this.provoked = true
    this.sightT = Math.max(this.sightT, 0.6)
    if (this.hp <= 0) {
      this.dead = true
      this.deathT = 0
      return true
    }
    return false
  }

  update(dt: number, px: number, pz: number, py: number, boxes: Box[], others: Enemy[], wave: number): EnemyShot | null {
    if (this.dead) {
      this.deathT += dt
      this.human.fall(this.deathT / 0.65, this.fallDir)
      return null
    }
    if (this.muzzleT > 0) {
      this.muzzleT -= dt
      if (this.muzzleT <= 0) this.human.flash(false)
    }

    const dx = px - this.x
    const dz = pz - this.z
    const dist = Math.hypot(dx, dz) || 0.001
    if (this.hidden) {
      this.hideT += dt
      this.group.rotation.y = Math.atan2(dx / dist, dz / dist)
      if (dist < 22 || this.hideT > 16 || this.provoked) {
        this.hidden = false
        this.justAlerted = true
      } else {
        this.human.setSpeed(0)
        this.human.setAim(0.02)
        this.human.update(dt)
        return null
      }
    }
    if (this.crouch < 1) {
      this.crouch = Math.min(1, this.crouch + dt * 3.5)
      this.human.group.scale.y = this.crouch
    }
    const nx = dx / dist
    const nz = dz / dist
    const eye = this.def.height - 0.2
    const los = lineOfSight(this.x, eye, this.z, px, py + 1.2, pz, boxes)
    this.sightT = los ? this.sightT + dt : 0
    this.group.rotation.y = Math.atan2(nx, nz)

    let moveX = 0
    let moveZ = 0
    const holdRange = this.def.preferredRange
    if (this.def.kind === 'rusher' || !los || dist > holdRange * 1.15) {
      moveX = nx
      moveZ = nz
    } else if (dist < holdRange * 0.55) {
      moveX = -nx * 0.7
      moveZ = -nz * 0.7
    } else {
      this.strafeT -= dt
      if (this.strafeT <= 0) {
        this.strafeT = 1 + Math.random() * 2
        this.strafeDir = -this.strafeDir
      }
      moveX = -nz * this.strafeDir * 0.6
      moveZ = nx * this.strafeDir * 0.6
    }
    if (this.avoidT > 0) {
      this.avoidT -= dt
      const px2 = -moveZ * this.avoidDir
      const pz2 = moveX * this.avoidDir
      moveX = px2 * 1.2 + moveX * 0.2
      moveZ = pz2 * 1.2 + moveZ * 0.2
    }
    const sp = this.def.speed
    const before = { x: this.x, z: this.z }
    const next = { x: this.x + moveX * sp * dt, z: this.z + moveZ * sp * dt }
    for (const o of others) {
      if (o === this || o.dead) continue
      const ox = next.x - o.x
      const oz = next.z - o.z
      const od = Math.hypot(ox, oz)
      const min = this.def.radius + o.def.radius
      if (od < min && od > 0.001) {
        next.x += (ox / od) * (min - od) * 0.5
        next.z += (oz / od) * (min - od) * 0.5
      }
    }
    resolveCircle(next, this.def.radius, 0, boxes, ARENA.half)
    const moved = Math.hypot(next.x - before.x, next.z - before.z)
    const wanted = Math.hypot(moveX, moveZ) * sp * dt
    if (wanted > 0.001 && moved < wanted * 0.35 && this.avoidT <= 0) {
      this.avoidT = 0.9
      this.avoidDir = Math.random() < 0.5 ? 1 : -1
    }
    this.x = next.x
    this.z = next.z
    this.group.position.set(this.x, 0, this.z)

    this.animSpeed += (moved / Math.max(dt, 0.001) - this.animSpeed) * Math.min(1, dt * 8)
    // Strafe and backpedal naturally while the weapon stays on the target.
    const loco = locomotion(next.x - before.x, next.z - before.z, this.animSpeed, this.group.rotation.y)
    this.bodyOff += (loco.offset - this.bodyOff) * Math.min(1, dt * 8)
    this.human.group.rotation.y = this.bodyOff
    this.human.setAimYaw(-this.bodyOff)
    this.human.setDirection(loco.dir)
    this.human.setSpeed(this.animSpeed)
    this.human.setAim(Math.max(-0.5, Math.min(0.5, Math.atan2(0.35 + py, dist))))
    // Distant soldiers animate at a lower rate and stop casting shadows, which keeps big waves smooth.
    const far = dist > 48
    this.lodAcc += dt
    if (!far || this.lodAcc >= 0.06) {
      this.human.update(this.lodAcc)
      this.lodAcc = 0
    }
    if (far === this.lodShadow) {
      this.lodShadow = !far
      this.human.setShadows(!far)
    }

    this.fireCd -= dt
    this.meleeCd -= dt
    if (this.def.kind === 'rusher' && dist < 2.1 && this.meleeCd <= 0 && Math.abs(py) < 1.5) {
      this.meleeCd = 0.9
      return { enemy: this, from: this.chestCenter, hit: true, damage: this.def.damage * 1.6 }
    }
    if (los && this.sightT > 0.55 && this.fireCd <= 0 && dist < 60 && this.def.kind !== 'rusher') {
      this.fireCd = this.def.fireInterval * (0.8 + Math.random() * 0.5)
      this.muzzleT = 0.06
      this.human.flash(true)
      const chance = Math.max(0.12, 0.62 - dist * 0.02 - this.def.accuracy) * (1 + Math.min(wave, 10) * 0.025)
      const dmg = this.def.damage * (1 + Math.min(wave - 1, 10) * 0.04)
      this.human.muzzle.updateWorldMatrix(true, false)
      const from = this.human.muzzle.getWorldPosition(new THREE.Vector3())
      return { enemy: this, from, hit: Math.random() < chance, damage: dmg }
    }
    return null
  }

  dispose() {
    this.human.dispose()
    this.group.removeFromParent()
  }
}
