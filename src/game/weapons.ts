import { START_WEAPONS, WEAPONS, WEAPON_ORDER, type WeaponDef } from './config'
import type { WeaponHud, WeaponId, WeaponSlot } from './types'

export class WeaponState {
  mag: number
  reserve: number
  cooldown = 0
  reloadLeft = 0

  constructor(public def: WeaponDef) {
    this.mag = def.magSize
    this.reserve = def.startReserve
  }
}

export interface ArsenalHooks {
  onReloadDone: () => void
  onPump: () => void
}

export class Arsenal {
  states = Object.fromEntries(WEAPON_ORDER.map((id) => [id, new WeaponState(WEAPONS[id])])) as Record<WeaponId, WeaponState>
  owned = new Set<WeaponId>(START_WEAPONS)
  current: WeaponId = 'ar'
  private pumpPending = false

  get cur() {
    return this.states[this.current]
  }

  switchTo(id: WeaponId) {
    if (id === this.current || !this.owned.has(id)) return false
    this.cur.reloadLeft = 0
    this.pumpPending = false
    this.current = id
    this.cur.cooldown = Math.max(this.cur.cooldown, 0.3)
    return true
  }

  cycle(dir: number) {
    const list = WEAPON_ORDER.filter((id) => this.owned.has(id))
    const i = list.indexOf(this.current)
    return this.switchTo(list[(i + dir + list.length) % list.length])
  }

  /** Adds a weapon with a full magazine and its starting reserve. */
  grant(id: WeaponId) {
    this.owned.add(id)
    this.states[id] = new WeaponState(WEAPONS[id])
  }

  update(dt: number, hooks: ArsenalHooks) {
    const w = this.cur
    if (w.cooldown > 0) {
      w.cooldown -= dt
      if (this.pumpPending && w.cooldown < (60 / w.def.rpm) * 0.55) {
        this.pumpPending = false
        hooks.onPump()
      }
    }
    if (w.reloadLeft > 0) {
      w.reloadLeft -= dt
      if (w.reloadLeft <= 0) {
        w.reloadLeft = 0
        const take = Math.min(w.def.magSize - w.mag, w.reserve)
        w.mag += take
        w.reserve -= take
        hooks.onReloadDone()
      }
    }
  }

  canFire() {
    const w = this.cur
    return w.cooldown <= 0 && w.reloadLeft <= 0 && w.mag > 0
  }

  fire() {
    const w = this.cur
    w.mag -= 1
    w.cooldown = 60 / w.def.rpm
    this.pumpPending = w.def.pump
  }

  startReload() {
    const w = this.cur
    if (w.reloadLeft > 0 || w.mag >= w.def.magSize || w.reserve <= 0) return false
    w.reloadLeft = w.def.reloadS
    return true
  }

  addAmmo(fraction: number) {
    for (const id of this.owned) {
      const s = this.states[id]
      s.reserve = Math.min(s.def.maxReserve, s.reserve + Math.ceil(s.def.magSize * fraction * s.def.ammoMult))
    }
  }

  refillAll() {
    for (const id of this.owned) this.states[id].reserve = this.states[id].def.maxReserve
  }

  hud(): WeaponHud {
    const w = this.cur
    return { id: w.def.id, name: w.def.name, mag: w.mag, magSize: w.def.magSize, reserve: w.reserve, reloading: w.reloadLeft > 0 }
  }

  slots(): WeaponSlot[] {
    return WEAPON_ORDER.map((id, i) => ({
      id,
      name: WEAPONS[id].name,
      key: i + 1,
      owned: this.owned.has(id),
      active: this.current === id,
      price: WEAPONS[id].price,
    }))
  }

  reloadProgress() {
    const w = this.cur
    return w.reloadLeft > 0 ? 1 - w.reloadLeft / w.def.reloadS : 0
  }
}
