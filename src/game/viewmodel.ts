import * as THREE from 'three'
import type { WeaponId } from './types'

/** Where each weapon sits in front of the camera when held at the hip and when aiming down sights. */
const HIP = new THREE.Vector3(0.2, -0.22, -0.5)
const ADS_Y: Record<WeaponId, number> = { ar: -0.158, smg: -0.158, lmg: -0.158, shotgun: -0.158, sniper: -0.185, pistol: -0.095 }
const ADS_Z: Record<WeaponId, number> = { ar: -0.36, smg: -0.32, lmg: -0.36, shotgun: -0.36, sniper: -0.34, pistol: -0.38 }

/** Computes the weapon pose relative to the camera: sway, bob, recoil, reload, sprint and ADS. */
export class ViewMotion {
  readonly pos = new THREE.Vector3()
  readonly quat = new THREE.Quaternion()
  private kick = 0
  private kickRoll = 0
  private swap = 0
  private current: WeaponId = 'ar'
  private adsT = 0
  private sprintT = 0
  private lookX = 0
  private lookY = 0
  private euler = new THREE.Euler()

  setWeapon(id: WeaponId) {
    this.current = id
    this.swap = 1
  }

  fire(id: WeaponId) {
    this.kick = id === 'sniper' ? 1.4 : id === 'shotgun' ? 1.2 : id === 'lmg' ? 0.8 : id === 'pistol' ? 0.9 : 0.55
    this.kickRoll = (Math.random() - 0.5) * 0.6
  }

  /** Feed in the camera's turn this frame so the weapon lags behind like a real one. */
  look(dyaw: number, dpitch: number) {
    this.lookX += (dyaw - this.lookX) * 0.35
    this.lookY += (dpitch - this.lookY) * 0.35
  }

  get scoped() {
    return this.current === 'sniper' && this.adsT > 0.85
  }

  update(dt: number, speed: number, bob: number, ads: boolean, reload: number, sprinting: boolean) {
    this.adsT += ((ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 12)
    this.sprintT += ((sprinting ? 1 : 0) - this.sprintT) * Math.min(1, dt * 8)
    this.kick = Math.max(0, this.kick - dt * 7)
    this.swap = Math.max(0, this.swap - dt * 3.5)
    const a = this.adsT
    const moving = Math.min(1, speed / 6)
    const sway = (1 - a * 0.9) * moving
    const dip = reload > 0 ? Math.sin(reload * Math.PI) : 0
    const adsPos = new THREE.Vector3(0, ADS_Y[this.current], ADS_Z[this.current])
    this.pos.copy(HIP).lerp(adsPos, a)
    this.pos.x += Math.sin(bob) * 0.012 * sway - this.lookX * 0.5 + this.sprintT * 0.02
    this.pos.y += Math.abs(Math.cos(bob)) * 0.016 * sway - dip * 0.16 - this.swap * 0.3 - this.lookY * 0.4 - this.sprintT * 0.05
    this.pos.z += this.kick * 0.05 + this.sprintT * 0.02
    this.euler.set(
      this.kick * 0.06 + dip * 0.5 + this.swap * 0.7 - this.sprintT * 0.22 + this.lookY * 0.6,
      this.sprintT * 0.3 + this.lookX * 0.8 + (1 - a) * 0.1,
      this.kickRoll * this.kick * 0.08 - dip * 0.35 + this.sprintT * 0.12,
      'YXZ',
    )
    this.quat.setFromEuler(this.euler)
  }
}
