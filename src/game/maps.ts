import type { Prop } from './props'

export type MapId = 'ashfall' | 'harbor' | 'outpost'

export interface MapTheme {
  skyTop: string
  skyMid: string
  skyLow: string
  fog: number
  fogDensity: number
  ground: string
  groundLine: string
  wall: string
  brick: boolean
  sun: number
  sunPower: number
  sunPos: [number, number, number]
  hemiSky: number
  hemiGround: number
  hemiPower: number
  exposure: number
  smoke: number
  groundTex: string
  groundBoost: number
  hdr: string
}

export interface MapDef {
  id: MapId
  name: string
  blurb: string
  half: number
  theme: MapTheme
  start: { x: number; z: number }
  props: Prop[]
}

/** Small deterministic random generator so every load builds the same map. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Opening = { at: number; w: number; type: 'door' | 'window' }

class Builder {
  props: Prop[] = []

  constructor(private rand: () => number, private noGo: { x: number; z: number; r: number }[]) {}

  private free(x: number, z: number, hw: number, hd: number) {
    for (const p of this.props) {
      if (Math.abs(p.x - x) < p.w / 2 + hw + 1.2 && Math.abs(p.z - z) < p.d / 2 + hd + 1.2) return false
    }
    return !this.noGo.some((n) => Math.hypot(n.x - x, n.z - z) < n.r + Math.max(hw, hd))
  }

  push(p: Prop) {
    this.props.push(p)
  }

  /** Places a prop only if the spot is free. Returns whether it was placed. */
  tryPlace(p: Prop) {
    if (!this.free(p.x, p.z, p.w / 2, p.d / 2)) return false
    this.props.push(p)
    return true
  }

  car(x: number, z: number, across: boolean, fire = false, color?: number) {
    return this.tryPlace({ kind: 'car', x, z, w: across ? 1.9 : 4.5, d: across ? 4.5 : 1.9, h: 1.5, fire, color })
  }

  crate(x: number, z: number, s = 2, h = s) {
    return this.tryPlace({ kind: 'crate', x, z, w: s, d: s, h })
  }

  barrel(x: number, z: number) {
    return this.tryPlace({ kind: 'barrel', x, z, w: 0.8, d: 0.8, h: 1.1 })
  }

  rubble(x: number, z: number) {
    return this.tryPlace({ kind: 'rubble', x, z, w: 2.6, d: 2.2, h: 0.8 })
  }

  sandbags(x: number, z: number, len: number, across = false) {
    return this.tryPlace({ kind: 'sandbag', x, z, w: across ? 0.9 : len, d: across ? len : 0.9, h: 1.1 })
  }

  barrier(x: number, z: number, len: number, across = false) {
    return this.tryPlace({ kind: 'barrier', x, z, w: across ? 1 : len, d: across ? len : 1, h: 1.3 })
  }

  container(x: number, z: number, across: boolean, color: number, tier = 0) {
    const p: Prop = { kind: 'container', x, z, w: across ? 2.5 : 6.1, d: across ? 6.1 : 2.5, h: 2.6, y: tier * 2.6, color }
    if (tier > 0) {
      this.props.push(p)
      return true
    }
    return this.tryPlace(p)
  }

  pillar(x: number, z: number, w: number, h: number) {
    this.props.push({ kind: 'wall', x, z, w, d: w, h })
  }

  /** A wall along one axis with doors and windows cut into it. */
  run(axis: 'x' | 'z', fixed: number, from: number, to: number, h: number, ops: Opening[], thick = 0.6) {
    const seg = (a: number, b: number, y: number, hh: number) => {
      if (b - a < 0.05 || hh < 0.05) return
      const mid = (a + b) / 2
      this.props.push(axis === 'x' ? { kind: 'wall', x: mid, z: fixed, w: b - a, d: thick, h: hh, y } : { kind: 'wall', x: fixed, z: mid, w: thick, d: b - a, h: hh, y })
    }
    let cur = from
    for (const o of [...ops].sort((a, b) => a.at - b.at)) {
      const a = o.at - o.w / 2
      const b = o.at + o.w / 2
      seg(cur, a, 0, h)
      if (o.type === 'window') seg(a, b, 0, 1)
      const top = o.type === 'window' ? 2.5 : 2.7
      seg(a, b, top, h - top)
      cur = b
    }
    seg(cur, to, 0, h)
  }

  /** A ruined building shell with entrances, windows and a partial roof. */
  building(cx: number, cz: number, w: number, d: number, h: number, roof = true) {
    const r = this.rand
    const x0 = cx - w / 2
    const x1 = cx + w / 2
    const z0 = cz - d / 2
    const z1 = cz + d / 2
    const ops = (len: number, doors: number): Opening[] => {
      const list: Opening[] = []
      const slots = Math.floor(len / 4.2)
      for (let i = 0; i < slots; i++) {
        const at = -len / 2 + (i + 0.5) * (len / slots)
        const type = i < doors ? 'door' : r() < 0.7 ? 'window' : null
        if (type) list.push({ at, w: type === 'door' ? 2.6 : 1.9, type })
      }
      return list.sort(() => r() - 0.5)
    }
    const shift = (list: Opening[], c: number) => list.map((o) => ({ ...o, at: o.at + c }))
    this.run('x', z0, x0, x1, h, shift(ops(w, 1), cx))
    this.run('x', z1, x0, x1, h, shift(ops(w, 1), cx))
    this.run('z', x0, z0, z1, h, shift(ops(d, 0), cz))
    this.run('z', x1, z0, z1, h, shift(ops(d, 1), cz))
    if (roof) this.props.push({ kind: 'roof', x: cx + (r() < 0.5 ? -w / 4 : w / 4), z: cz, w: w / 2 - 0.4, d: d - 0.4, h: 0.3, y: h - 0.3 })
    if (w > 8) this.run('z', cx, z0 + 0.5, z1 - 0.5, 3.2, [{ at: cz, w: 2.4, type: 'door' }], 0.4)
    this.crate(cx - w / 4, cz + d / 4, 1.6, 1.2)
    this.barrel(cx + w / 4, cz - d / 4)
    this.noGo.push({ x: cx, z: cz, r: Math.max(w, d) / 2 + 1.5 })
  }
}

function ashfall(): MapDef {
  const rand = rng(7)
  const b = new Builder(rand, [{ x: 0, z: 54, r: 9 }])
  const rows: [number, number, number, number, number][] = [
    [-42, -44, 15, 11, 5.4], [-15, -46, 13, 10, 4.8], [16, -44, 16, 12, 5.6], [44, -42, 12, 11, 5],
    [-44, -14, 12, 15, 5.2], [44, -12, 12, 14, 5.2], [-44, 18, 13, 12, 4.8], [43, 20, 14, 13, 5.4],
    [-26, 30, 12, 10, 4.6], [26, 34, 13, 10, 4.8], [-22, -20, 10, 9, 4.4], [24, -22, 10, 9, 4.6],
  ]
  for (const r of rows) b.building(...r)
  for (let z = -52; z <= 50; z += 8) {
    const lane = rand() < 0.5 ? -1 : 1
    b.car(lane * (3 + rand() * 4.5), z + rand() * 3, rand() < 0.28, rand() < 0.3)
  }
  for (let i = 0; i < 10; i++) b.car((rand() - 0.5) * 100, (rand() - 0.5) * 110, rand() < 0.5, rand() < 0.25)
  for (const z of [-12, 16, 38]) {
    b.sandbags(-6, z, 8)
    b.sandbags(7, z + 1.5, 7)
    b.barrier(0, z + 3, 5)
  }
  for (let i = 0; i < 18; i++) b.rubble((rand() - 0.5) * 112, (rand() - 0.5) * 112)
  for (let i = 0; i < 16; i++) b.barrel((rand() - 0.5) * 110, (rand() - 0.5) * 110)
  for (let i = 0; i < 14; i++) b.crate((rand() - 0.5) * 110, (rand() - 0.5) * 110, 1.6 + rand() * 1.2)
  return {
    id: 'ashfall',
    name: 'Ashfall',
    blurb: 'A burnt-out town. Wrecked cars, shattered windows, ambushes around every corner.',
    half: 64,
    start: { x: 0, z: 54 },
    props: b.props,
    theme: {
      skyTop: '#1b2433', skyMid: '#5a4a50', skyLow: '#e0905a', fog: 0x7a6a66, fogDensity: 0.011, ground: '#4a4642', groundLine: 'rgba(255,255,255,0.05)',
      wall: '#8c8478', brick: true, sun: 0xffc48a, sunPower: 2.3, sunPos: [-40, 55, 30], hemiSky: 0xbcc8e0, hemiGround: 0x4a3b2e, hemiPower: 1.0, exposure: 1.2, smoke: 0x2a2826, groundTex: 'asphalt_02', groundBoost: 1.15, hdr: 'qwantani_dusk_2_puresky',
    },
  }
}

function harbor(): MapDef {
  const rand = rng(21)
  const b = new Builder(rand, [{ x: 0, z: 62, r: 10 }])
  const colors = [0x8a3b2e, 0x2f5a7a, 0x3d6b4a, 0xb08a2e, 0x6b3a5a, 0x7a7d82]
  for (const z of [-52, -38, -24, -10, 8, 22, 36]) {
    for (let x = -60; x <= 60; x += 9) {
      if (rand() < 0.38 || (Math.abs(x) < 7 && z > 0)) continue
      const c = colors[Math.floor(rand() * colors.length)]
      b.container(x, z, false, c)
      if (rand() < 0.3) b.container(x, z, false, colors[Math.floor(rand() * colors.length)], 1)
    }
  }
  b.building(-52, 52, 24, 16, 7, true)
  b.building(54, 54, 20, 14, 6.4, true)
  b.building(0, -64, 22, 8, 6, false)
  for (const [x, z] of [[-24, 2], [24, 2], [-62, -20], [62, -20]]) b.pillar(x, z, 1.4, 15)
  for (const [x, z, r] of [[48, -56, 5], [58, -44, 4.5], [-56, -56, 5]]) b.props.push({ kind: 'tank', x, z, w: r * 2, d: r * 2, h: 6 })
  for (let i = 0; i < 12; i++) b.car((rand() - 0.5) * 120, (rand() - 0.5) * 120, rand() < 0.5, rand() < 0.3, 0x7d8590)
  for (let i = 0; i < 22; i++) b.barrel((rand() - 0.5) * 124, (rand() - 0.5) * 124)
  for (let i = 0; i < 20; i++) b.crate((rand() - 0.5) * 124, (rand() - 0.5) * 124, 1.8 + rand())
  for (const z of [26, 44]) b.barrier(0, z, 10)
  for (let i = 0; i < 10; i++) b.rubble((rand() - 0.5) * 120, (rand() - 0.5) * 120)
  return {
    id: 'harbor',
    name: 'Dockyard 9',
    blurb: 'A container port at dawn. Tight corridors, stacked steel, enemies behind every box.',
    half: 72,
    start: { x: 0, z: 62 },
    props: b.props,
    theme: {
      skyTop: '#0d1b2f', skyMid: '#3d5a7a', skyLow: '#b9c9d6', fog: 0x8fa3b3, fogDensity: 0.009, ground: '#3a4048', groundLine: 'rgba(255,255,255,0.06)',
      wall: '#7d848c', brick: false, sun: 0xcfe0ff, sunPower: 2.0, sunPos: [50, 60, -20], hemiSky: 0xaec4e6, hemiGround: 0x2f3a46, hemiPower: 1.1, exposure: 1.25, smoke: 0x303338, groundTex: 'concrete_floor_worn_001', groundBoost: 2.1, hdr: 'kiara_1_dawn',
    },
  }
}

function outpost(): MapDef {
  const rand = rng(99)
  const b = new Builder(rand, [{ x: 0, z: 48, r: 8 }])
  const s = 22
  b.run('x', -s, -s, s, 4.2, [{ at: 0, w: 6, type: 'door' }], 1)
  b.run('x', s, -s, s, 4.2, [{ at: 0, w: 6, type: 'door' }], 1)
  b.run('z', -s, -s, s, 4.2, [{ at: 0, w: 6, type: 'door' }], 1)
  b.run('z', s, -s, s, 4.2, [{ at: 0, w: 6, type: 'door' }], 1)
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    b.pillar(x, z, 3, 8.5)
    b.props.push({ kind: 'roof', x, z, w: 6, d: 6, h: 0.4, y: 8.5 })
  }
  b.building(-11, -10, 11, 9, 4.6)
  b.building(11, 10, 10, 9, 4.2)
  b.sandbags(-8, 10, 8)
  b.sandbags(8, -8, 8)
  b.sandbags(0, 0, 6, true)
  b.sandbags(-14, 14, 6, true)
  b.sandbags(14, -14, 6, true)
  for (let i = 0; i < 14; i++) b.car((rand() - 0.5) * 100, (rand() - 0.5) * 100, rand() < 0.5, rand() < 0.3, 0x9a8468)
  for (let i = 0; i < 6; i++) b.building((rand() - 0.5) * 90, (rand() - 0.5) * 90, 7 + rand() * 4, 6 + rand() * 3, 3.6, false)
  for (let i = 0; i < 20; i++) b.rubble((rand() - 0.5) * 104, (rand() - 0.5) * 104)
  for (let i = 0; i < 18; i++) b.barrel((rand() - 0.5) * 104, (rand() - 0.5) * 104)
  for (let i = 0; i < 14; i++) b.crate((rand() - 0.5) * 104, (rand() - 0.5) * 104, 1.6 + rand() * 1.4)
  return {
    id: 'outpost',
    name: 'Dune Outpost',
    blurb: 'A fortified desert compound with watchtowers, sandbag nests and wrecked convoys outside the walls.',
    half: 56,
    start: { x: 0, z: 48 },
    props: b.props,
    theme: {
      skyTop: '#3a6ea5', skyMid: '#9ec3d9', skyLow: '#f1dcb2', fog: 0xd9c7a0, fogDensity: 0.008, ground: '#b59d72', groundLine: 'rgba(0,0,0,0.05)',
      wall: '#b8a782', brick: false, sun: 0xfff1d0, sunPower: 2.8, sunPos: [-20, 80, 40], hemiSky: 0xcfe3f5, hemiGround: 0x9a8560, hemiPower: 1.15, exposure: 1.05, smoke: 0x3a3632, groundTex: 'sandy_gravel_02', groundBoost: 1, hdr: 'kloppenheim_06_puresky',
    },
  }
}

const cache = new Map<MapId, MapDef>()
const makers: Record<MapId, () => MapDef> = { ashfall, harbor, outpost }

export function getMap(id: MapId): MapDef {
  let m = cache.get(id)
  if (!m) {
    m = makers[id]()
    cache.set(id, m)
  }
  return m
}

export const MAP_LIST: { id: MapId; name: string; blurb: string }[] = [
  { id: 'ashfall', name: 'Ashfall', blurb: 'Burnt-out town. Wrecked cars, shattered windows, ambushes around every corner.' },
  { id: 'harbor', name: 'Dockyard 9', blurb: 'Container port at dawn. Tight corridors and stacked steel.' },
  { id: 'outpost', name: 'Dune Outpost', blurb: 'Fortified desert compound with watchtowers and sandbag nests.' },
]
