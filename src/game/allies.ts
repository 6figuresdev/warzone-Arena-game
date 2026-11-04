import * as THREE from 'three'
import { locomotion } from './locomotion'
import { ALLY, ARENA } from './config'
import { lineOfSight, resolveCircle, type Box } from './collision'
import { createHuman, type Human } from './characters'
import type { Enemy } from './enemies'

export interface AllyShot {
  from: THREE.Vector3
  to: THREE.Vector3
  target: Enemy
  hit: boolean
  head: boolean
  damage: number
}

/** A friendly squadmate. Follows you, takes cover fire positions loosely and shoots the nearest hostile. */
export class Ally {
  readonly group = new THREE.Group()
  x: number
  z: number
  private human: Human
  private animSpeed = 0
  private bodyOff = 0
  private muzzleT = 0
  private fireCd = Math.random() * 0.4
  private yaw = 0

  holdX = 0
  holdZ = 0
  spotEvent: Enemy | null = null
  reloadEvent = false
  private sinceSpot = 10
  private hadTarget = false
  private shots = 0

  constructor(public readonly slot: number, public readonly callsign: string, x: number, z: number) {
    this.human = createHuman({ tint: slot === 0 ? 0x9db4cc : 0xa7c0a0, height: 1.82, gun: 'rifle' })
    this.group.add(this.human.group)
    this.x = x
    this.z = z
    this.group.position.set(x, 0, z)
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = 'rgba(8,16,28,0.7)'
      g.beginPath()
      g.roundRect(4, 8, 248, 48, 14)
      g.fill()
      g.fillStyle = '#78c8e6'
      g.font = '700 30px "Space Grotesk", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(callsign, 128, 33)
    }
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true, fog: false }))
    tag.scale.set(1.5, 0.375, 1)
    tag.position.y = 2.25
    tag.renderOrder = 20
    this.group.add(tag)
  }

  update(dt: number, px: number, pz: number, pyaw: number, enemies: Enemy[], boxes: Box[], hold: boolean): AllyShot | null {
    // Station on either side, a little behind the player's facing.
    const side = this.slot % 2 === 0 ? -1 : 1
    const back = 2.2 + this.slot * 0.8
    const sx = Math.cos(pyaw) * side * 3.2 + Math.sin(pyaw) * back
    const sz = -Math.sin(pyaw) * side * 3.2 + Math.cos(pyaw) * back
    const gx = hold ? this.holdX : px + sx
    const gz = hold ? this.holdZ : pz + sz
    const dxg = gx - this.x
    const dzg = gz - this.z
    const dg = Math.hypot(dxg, dzg)

    let moved = 0
    if (dg > 1.2) {
      const speed = Math.min(ALLY.speed, 2 + dg * 1.4)
      const next = { x: this.x + (dxg / dg) * speed * dt, z: this.z + (dzg / dg) * speed * dt }
      resolveCircle(next, 0.4, 0, boxes, ARENA.half)
      moved = Math.hypot(next.x - this.x, next.z - this.z)
      this.x = next.x
      this.z = next.z
    }

    let target: Enemy | null = null
    let best = ALLY.range
    for (const e of enemies) {
      if (e.dead) continue
      const d = Math.hypot(e.x - this.x, e.z - this.z)
      if (d >= best) continue
      if (!lineOfSight(this.x, 1.5, this.z, e.x, e.def.height * 0.65, e.z, boxes)) continue
      best = d
      target = e
    }

    this.sinceSpot += dt
    if (target && !this.hadTarget && this.sinceSpot > 7) {
      this.spotEvent = target
      this.sinceSpot = 0
    }
    this.hadTarget = !!target
    const desiredYaw = target ? Math.atan2(target.x - this.x, target.z - this.z) : moved > 0.001 ? Math.atan2(dxg, dzg) : Math.atan2(-Math.sin(pyaw), -Math.cos(pyaw))
    let diff = desiredYaw - this.yaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.yaw += diff * Math.min(1, dt * 10)
    this.group.rotation.y = this.yaw
    this.group.position.set(this.x, 0, this.z)

    this.animSpeed += (moved / Math.max(dt, 0.001) - this.animSpeed) * Math.min(1, dt * 8)
    const loco = locomotion(dxg, dzg, moved > 0.001 ? this.animSpeed : 0, this.yaw)
    this.bodyOff += (loco.offset - this.bodyOff) * Math.min(1, dt * 8)
    this.human.group.rotation.y = this.bodyOff
    this.human.setAimYaw(-this.bodyOff)
    this.human.setDirection(loco.dir)
    this.human.setSpeed(this.animSpeed)
    this.human.setAim(target ? Math.max(-0.4, Math.min(0.4, Math.atan2(0.2, best))) : 0.05)
    this.human.update(dt)
    if (this.muzzleT > 0) {
      this.muzzleT -= dt
      if (this.muzzleT <= 0) this.human.flash(false)
    }

    this.fireCd -= dt
    if (!target || this.fireCd > 0) return null
    this.fireCd = ALLY.fireInterval * (0.8 + Math.random() * 0.5)
    this.muzzleT = 0.05
    this.human.flash(true)
    this.shots++
    if (this.shots % 36 === 0) this.reloadEvent = true
    const hit = Math.random() < ALLY.hitChance
    const head = hit && Math.random() < 0.12
    this.human.muzzle.updateWorldMatrix(true, false)
    const from = this.human.muzzle.getWorldPosition(new THREE.Vector3())
    const aim = new THREE.Vector3(target.x, target.def.height * 0.65, target.z)
    if (!hit) aim.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2))
    return { from, to: aim, target, hit, head, damage: ALLY.damage * (head ? 2.5 : 1) }
  }

  dispose() {
    this.human.dispose()
    this.group.removeFromParent()
  }
}
