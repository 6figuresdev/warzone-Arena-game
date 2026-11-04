import type { EnemyKind, ShopItemId, WeaponId } from './types'

export interface WeaponDef {
  id: WeaponId
  name: string
  blurb: string
  auto: boolean
  damage: number
  pellets: number
  spread: number
  adsSpread: number
  rpm: number
  magSize: number
  startReserve: number
  maxReserve: number
  reloadS: number
  recoil: number
  range: number
  adsFov: number
  pump: boolean
  price: number
  ammoMult: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar: {
    id: 'ar', name: 'AR-7 Vanguard', blurb: 'Balanced assault rifle', auto: true, damage: 24, pellets: 1, spread: 0.022, adsSpread: 0.005,
    rpm: 680, magSize: 30, startReserve: 120, maxReserve: 210, reloadS: 1.9, recoil: 0.012, range: 120, adsFov: 52, pump: false, price: 0, ammoMult: 1,
  },
  smg: {
    id: 'smg', name: 'MP-9 Viper', blurb: 'Fast firing, close quarters', auto: true, damage: 17, pellets: 1, spread: 0.03, adsSpread: 0.01,
    rpm: 900, magSize: 32, startReserve: 128, maxReserve: 224, reloadS: 1.7, recoil: 0.008, range: 80, adsFov: 60, pump: false, price: 900, ammoMult: 1,
  },
  shotgun: {
    id: 'shotgun', name: 'M12 Breaker', blurb: 'Devastating up close', auto: false, damage: 13, pellets: 9, spread: 0.075, adsSpread: 0.05,
    rpm: 72, magSize: 6, startReserve: 24, maxReserve: 42, reloadS: 2.4, recoil: 0.06, range: 40, adsFov: 62, pump: true, price: 1100, ammoMult: 0.6,
  },
  lmg: {
    id: 'lmg', name: 'M60 Hammer', blurb: '100 round belt, heavy hits', auto: true, damage: 28, pellets: 1, spread: 0.035, adsSpread: 0.012,
    rpm: 560, magSize: 100, startReserve: 200, maxReserve: 300, reloadS: 4.2, recoil: 0.016, range: 130, adsFov: 56, pump: false, price: 2600, ammoMult: 0.5,
  },
  sniper: {
    id: 'sniper', name: 'KR-98 Longbow', blurb: 'One shot, long range', auto: false, damage: 125, pellets: 1, spread: 0.03, adsSpread: 0.0005,
    rpm: 48, magSize: 5, startReserve: 15, maxReserve: 25, reloadS: 2.8, recoil: 0.09, range: 220, adsFov: 18, pump: true, price: 1900, ammoMult: 0.6,
  },
  pistol: {
    id: 'pistol', name: 'P-9 Sidekick', blurb: 'Reliable sidearm', auto: false, damage: 30, pellets: 1, spread: 0.014, adsSpread: 0.003,
    rpm: 360, magSize: 12, startReserve: 60, maxReserve: 96, reloadS: 1.3, recoil: 0.02, range: 80, adsFov: 64, pump: false, price: 0, ammoMult: 1,
  },
}

export const WEAPON_ORDER: WeaponId[] = ['ar', 'smg', 'shotgun', 'lmg', 'sniper', 'pistol']
export const START_WEAPONS: WeaponId[] = ['ar', 'pistol']

export interface ShopItem {
  id: ShopItemId
  name: string
  desc: string
  price: number
  group: 'weapon' | 'supply'
}

export const SUPPLY_ITEMS: ShopItem[] = [
  { id: 'ammo', name: 'Ammo crate', desc: 'Refill reserve ammo for every weapon you own', price: 350, group: 'supply' },
  { id: 'medkit', name: 'Trauma kit', desc: 'Restore health to full', price: 300, group: 'supply' },
  { id: 'armor', name: 'Plate carrier', desc: '+100 armor, absorbs 60% of damage', price: 700, group: 'supply' },
  { id: 'frag', name: 'Frag x2', desc: 'Two more grenades, up to 5', price: 250, group: 'supply' },
]

export const SHOP_WEAPONS: ShopItem[] = WEAPON_ORDER.filter((id) => WEAPONS[id].price > 0).map((id) => ({
  id,
  name: WEAPONS[id].name,
  desc: WEAPONS[id].blurb,
  price: WEAPONS[id].price,
  group: 'weapon' as const,
}))

export const ECONOMY = {
  startCash: 800,
  killCash: { grunt: 100, rusher: 130, heavy: 350 } as Record<EnemyKind, number>,
  headshotBonus: 50,
  waveBase: 500,
  wavePerLevel: 50,
  maxGrenades: 5,
  maxArmor: 100,
  armorAbsorb: 0.6,
}

export interface EnemyDef {
  kind: EnemyKind
  health: number
  speed: number
  radius: number
  height: number
  damage: number
  fireInterval: number
  accuracy: number
  preferredRange: number
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { kind: 'grunt', health: 70, speed: 3.1, radius: 0.42, height: 1.8, damage: 6, fireInterval: 0.6, accuracy: 0.06, preferredRange: 18 },
  rusher: { kind: 'rusher', health: 45, speed: 6.2, radius: 0.4, height: 1.75, damage: 14, fireInterval: 0.7, accuracy: 0.1, preferredRange: 4 },
  heavy: { kind: 'heavy', health: 260, speed: 2.0, radius: 0.6, height: 2.05, damage: 8, fireInterval: 0.28, accuracy: 0.08, preferredRange: 14 },
}

export const ALLY = { count: 2, speed: 6.4, damage: 15, fireInterval: 0.28, range: 46, hitChance: 0.55 }

export const PLAYER = {
  radius: 0.4,
  eye: 1.65,
  walk: 5.2,
  sprint: 8.4,
  adsMult: 0.55,
  jump: 6.2,
  gravity: 18,
  maxHealth: 100,
  regenDelay: 5,
  regenRate: 14,
}

export const ARENA = { half: 42 }
export const BASE_FOV = 78
export const GRENADE = { fuse: 1.6, radius: 7, damage: 180, speed: 17, start: 2 }

export function pickEnemyKind(wave: number, rnd: number): EnemyKind {
  const heavyChance = wave >= 3 ? Math.min(0.26, 0.05 + wave * 0.02) : 0
  const rusherChance = wave >= 2 ? Math.min(0.36, 0.12 + wave * 0.03) : 0
  if (rnd < heavyChance) return 'heavy'
  if (rnd < heavyChance + rusherChance) return 'rusher'
  return 'grunt'
}
