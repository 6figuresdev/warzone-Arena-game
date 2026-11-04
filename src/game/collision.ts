export interface Box {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export function boxFrom(cx: number, cz: number, w: number, d: number, h: number, y = 0): Box {
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: y, maxY: y + h, minZ: cz - d / 2, maxZ: cz + d / 2 }
}

/** Top surface height under a circle, only counting surfaces the feet can step up onto. */
export function groundHeight(x: number, z: number, r: number, feetY: number, boxes: Box[]): number {
  let best = 0
  for (const b of boxes) {
    if (x + r * 0.6 < b.minX || x - r * 0.6 > b.maxX || z + r * 0.6 < b.minZ || z - r * 0.6 > b.maxZ) continue
    if (b.maxY <= feetY + 0.45 && b.maxY > best) best = b.maxY
  }
  return best
}

/** Pushes a circle out of every box it overlaps at its current height. Mutates pos. */
export function resolveCircle(pos: { x: number; z: number }, r: number, feetY: number, boxes: Box[], half: number): void {
  for (const b of boxes) {
    if (feetY >= b.maxY - 0.05 || feetY + 1.6 <= b.minY) continue
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ))
    let dx = pos.x - cx
    let dz = pos.z - cz
    const d2 = dx * dx + dz * dz
    if (d2 >= r * r) continue
    if (d2 < 1e-8) {
      const l = pos.x - b.minX
      const rr = b.maxX - pos.x
      const t = pos.z - b.minZ
      const bt = b.maxZ - pos.z
      const m = Math.min(l, rr, t, bt)
      if (m === l) pos.x = b.minX - r
      else if (m === rr) pos.x = b.maxX + r
      else if (m === t) pos.z = b.minZ - r
      else pos.z = b.maxZ + r
      continue
    }
    const d = Math.sqrt(d2)
    dx /= d
    dz /= d
    pos.x = cx + dx * r
    pos.z = cz + dz * r
  }
  const lim = half - r
  pos.x = Math.max(-lim, Math.min(lim, pos.x))
  pos.z = Math.max(-lim, Math.min(lim, pos.z))
}

/** Distance along a ray to a box, or Infinity when it misses. */
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  let tmin = 0
  let tmax = Infinity
  const o = [ox, oy, oz]
  const d = [dx, dy, dz]
  const lo = [b.minX, b.minY, b.minZ]
  const hi = [b.maxX, b.maxY, b.maxZ]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return Infinity
    } else {
      let t1 = (lo[i] - o[i]) / d[i]
      let t2 = (hi[i] - o[i]) / d[i]
      if (t1 > t2) [t1, t2] = [t2, t1]
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) return Infinity
    }
  }
  return tmin
}

/** Distance along a normalised ray to a sphere, or Infinity. */
export function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number {
  const lx = cx - ox
  const ly = cy - oy
  const lz = cz - oz
  const tca = lx * dx + ly * dy + lz * dz
  if (tca < 0) return Infinity
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca
  if (d2 > r * r) return Infinity
  return tca - Math.sqrt(r * r - d2)
}

/** Nearest wall hit distance along a normalised ray. */
export function worldRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, boxes: Box[], max: number): number {
  let best = max
  for (const b of boxes) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b)
    if (t < best) best = t
  }
  if (dy < 0) {
    const t = -oy / dy
    if (t > 0 && t < best) best = t
  }
  return best
}

export function lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number, boxes: Box[]): boolean {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const len = Math.hypot(dx, dy, dz)
  if (len < 0.001) return true
  return worldRay(ax, ay, az, dx / len, dy / len, dz / len, boxes, len) >= len - 0.01
}

/** Surface normal at a point on a wall or the floor. Used to orient bullet holes. */
export function faceNormal(x: number, y: number, z: number, boxes: Box[]): [number, number, number] {
  if (y < 0.06) return [0, 1, 0]
  let best = 0.12
  let n: [number, number, number] = [0, 1, 0]
  for (const b of boxes) {
    if (x < b.minX - 0.1 || x > b.maxX + 0.1 || y < b.minY - 0.1 || y > b.maxY + 0.1 || z < b.minZ - 0.1 || z > b.maxZ + 0.1) continue
    const faces: [number, [number, number, number]][] = [
      [Math.abs(x - b.minX), [-1, 0, 0]], [Math.abs(x - b.maxX), [1, 0, 0]],
      [Math.abs(y - b.maxY), [0, 1, 0]], [Math.abs(y - b.minY), [0, -1, 0]],
      [Math.abs(z - b.minZ), [0, 0, -1]], [Math.abs(z - b.maxZ), [0, 0, 1]],
    ]
    for (const [d, normal] of faces) {
      if (d < best) {
        best = d
        n = normal
      }
    }
  }
  return n
}
