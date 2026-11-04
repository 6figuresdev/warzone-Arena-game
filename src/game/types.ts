export type WeaponId = 'ar' | 'smg' | 'shotgun' | 'lmg' | 'sniper' | 'pistol'
export type EnemyKind = 'grunt' | 'rusher' | 'heavy'

export interface WeaponHud {
  id: WeaponId
  name: string
  mag: number
  magSize: number
  reserve: number
  reloading: boolean
}

export interface WeaponSlot {
  id: WeaponId
  name: string
  key: number
  owned: boolean
  active: boolean
  price: number
}

export interface RadarBlip {
  x: number
  y: number
  kind: EnemyKind | 'ally'
}

export interface FeedItem {
  id: number
  text: string
  tone: 'kill' | 'head' | 'info' | 'warn'
}

export interface ObjectiveHud {
  kind: 'eliminate' | 'recover'
  text: string
  detail: string
  /** Metres to the objective, or -1 when there is no location. */
  dist: number
  /** Screen position of the waypoint, 0 to 1 from the top left. */
  sx: number
  sy: number
  onScreen: boolean
  progress: number
}

export interface NavHud {
  px: number
  pz: number
  yaw: number
  half: number
  /** Where the stolen funds are, once the case has appeared. */
  pin: { x: number; z: number } | null
  allies: { x: number; z: number }[]
  enemies: { x: number; z: number }[]
}

export interface HudState {
  nav: NavHud
  mapOpen: boolean
  mode: 'endless' | 'campaign'
  stage: number
  stageName: string
  stageWaves: number
  funds: number
  timeLimit: number
  objective: ObjectiveHud | null
  health: number
  maxHealth: number
  armor: number
  cash: number
  weapon: WeaponHud
  slots: WeaponSlot[]
  grenades: number
  wave: number
  enemiesLeft: number
  kills: number
  headshots: number
  score: number
  streak: number
  timeLeft: number
  ads: boolean
  scoped: boolean
  reload: number
  sprinting: boolean
  hitAt: number
  hitWasHead: boolean
  damagedAt: number
  damageAngle: number
  blips: RadarBlip[]
  banner: string | null
  feed: FeedItem[]
  locked: boolean
  shopOpen: boolean
  fallback: boolean
  crouching: boolean
  radio: { id: number; who: string; text: string }[]
  squadHold: boolean
  uav: number
  view: 'tps' | 'fps'
  mapName: string
  intermission: boolean
  now: number
}

export interface RunTelemetry {
  kills: number
  squadKills: number
  headshots: number
  wave: number
  durationMs: number
  shotsFired: number
  shotsHit: number
  damageTaken: number
  died: boolean
}

export type GamePhase = 'idle' | 'playing' | 'ended'

export type ShopItemId = WeaponId | 'ammo' | 'medkit' | 'frag' | 'armor'
