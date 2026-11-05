import * as THREE from 'three'
import { locomotion } from './locomotion'
import { charactersReady, createHuman, type GunKind, type Human } from './characters'
import type { ViewMotion } from './viewmodel'
import type { WeaponId } from './types'

const GUN_KIND: Record<WeaponId, GunKind> = {
  ar: 'rifle',
  smg: 'smg',
  lmg: 'lmg',
  shotgun: 'shotgun',
  sniper: 'sniper',
  pistol: 'pistol',
}

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

export interface PlayerPose {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  speed: number
  crouch: number
  vx: number
  vz: number
}

/**
 * Your operator. In first person you see your own arms and weapon, in third person the whole soldier.
 * The same rig is used for both so the animation, weapon and hands always agree.
 */
export class PlayerModel {
  private human: Human | null = null
  private gun: WeaponId = 'ar'
  private flashT = 0
  private tmpPos = new THREE.Vector3()
  private tmpQuat = new THREE.Quaternion()
  private bodyYaw: number | null = null
  private dir = 1

  constructor(private scene: THREE.Scene) {}

  private ensure() {
    if (this.human || !charactersReady()) return this.human
    this.human = createHuman({ tint: 0xb3b9a8, height: 1.8, gun: GUN_KIND[this.gun] })
    this.scene.add(this.human.group)
    return this.human
  }

  get ready() {
    return this.human !== null
  }

  setGun(id: WeaponId) {
    this.gun = id
    this.human?.setGun(GUN_KIND[id])
  }

  flash() {
    this.flashT = 0.05
    this.human?.flash(true)
  }

  muzzleWorld(target: THREE.Vector3) {
    if (!this.human) return null
    this.human.muzzle.updateWorldMatrix(true, false)
    return this.human.muzzle.getWorldPosition(target)
  }

  hide() {
    if (this.human) this.human.group.visible = false
  }

  update(dt: number, p: PlayerPose, fps: boolean, camera: THREE.Camera, motion: ViewMotion, onGround: boolean, visible: boolean) {
    const h = this.ensure()
    if (!h) return
    h.group.visible = visible
    if (!visible) return
    const sin = Math.sin(p.yaw)
    const cos = Math.cos(p.yaw)
    // In first person, shift the body forward so the shoulders sit close to the weapon.
    const shift = fps ? -0.04 : 0
    h.group.position.set(p.x - sin * shift, p.y, p.z - cos * shift)
    const aimYaw = p.yaw + Math.PI
    let facing = aimYaw
    if (!fps) {
      // Third person: the body turns toward where you run, the weapon stays on the crosshair.
      if (this.bodyYaw === null) this.bodyYaw = aimYaw
      const loco = locomotion(p.vx, p.vz, p.speed, aimYaw)
      const want = aimYaw + loco.offset
      this.dir = loco.dir
      const delta = Math.atan2(Math.sin(want - this.bodyYaw), Math.cos(want - this.bodyYaw))
      this.bodyYaw += delta * Math.min(1, dt * 9)
      facing = this.bodyYaw
    } else {
      this.bodyYaw = aimYaw
    }
    h.group.rotation.y = facing
    h.setAimYaw(Math.atan2(Math.sin(aimYaw - facing), Math.cos(aimYaw - facing)))
    h.group.scale.y = 1 - p.crouch * 0.28
    h.setDirection(fps ? 1 : this.dir)
    h.setSpeed(onGround ? p.speed : 0)
    h.setAim(p.pitch)
    h.setHeadHidden(fps)
    h.setRealHands(fps)
    if (fps) {
      camera.updateMatrixWorld(true)
      this.tmpPos.copy(motion.pos)
      camera.localToWorld(this.tmpPos)
      this.tmpQuat.copy(camera.quaternion).multiply(motion.quat).multiply(FLIP)
      h.placeGun(this.tmpPos, this.tmpQuat)
    } else {
      h.placeGun(null)
    }
    if (this.flashT > 0) {
      this.flashT -= dt
      if (this.flashT <= 0) h.flash(false)
    }
    h.update(dt)
  }

  dispose() {
    this.human?.dispose()
    this.human = null
  }
}
