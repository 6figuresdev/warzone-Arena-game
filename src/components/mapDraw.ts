import type { NavHud } from '@/game/types'

export interface MapInfo {
  id: string
  half: number
  /** minX, maxX, minZ, maxZ, height */
  boxes: number[][]
}

interface DrawOpts {
  size: number
  now: number
  /** Heading-up minimap (true) or north-up full map (false). */
  rotate: boolean
  /** Half the width of the area shown, in metres. */
  radius: number
  /** Amount shown under the bag, such as $500. */
  label?: string
}

const BG = 'rgba(11,22,38,0.92)'
const GREEN = '#6dffa0'

function moneyBag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, now: number, label: string) {
  const pulse = (now % 1400) / 1400
  ctx.save()
  ctx.strokeStyle = `rgba(109,255,160,${0.6 * (1 - pulse)})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y - s, s * (0.9 + pulse * 1.5), 0, Math.PI * 2)
  ctx.stroke()
  ctx.translate(x, y)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#0b1626'
  ctx.lineWidth = Math.max(1.5, s * 0.14)
  // sack body
  ctx.fillStyle = '#e8bf74'
  ctx.beginPath()
  ctx.moveTo(-s * 0.35, -s * 1.55)
  ctx.bezierCurveTo(-s * 1.25, -s * 1.05, -s * 1.15, 0, -s * 0.5, 0)
  ctx.lineTo(s * 0.5, 0)
  ctx.bezierCurveTo(s * 1.15, 0, s * 1.25, -s * 1.05, s * 0.35, -s * 1.55)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // flared top and tie
  ctx.fillStyle = '#d6a85f'
  ctx.beginPath()
  ctx.moveTo(-s * 0.55, -s * 2.05)
  ctx.lineTo(-s * 0.3, -s * 1.5)
  ctx.lineTo(s * 0.3, -s * 1.5)
  ctx.lineTo(s * 0.55, -s * 2.05)
  ctx.quadraticCurveTo(0, -s * 1.8, -s * 0.55, -s * 2.05)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#6b4a2a'
  ctx.fillRect(-s * 0.36, -s * 1.62, s * 0.72, s * 0.2)
  ctx.fillStyle = '#1d8a4f'
  ctx.font = `800 ${Math.round(s * 1.25)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('$', 0, -s * 0.72)
  // USDC tag
  const w = s * 2.2
  const h = s * 0.82
  ctx.fillStyle = '#2775ca'
  ctx.beginPath()
  ctx.roundRect(-w / 2, s * 0.3, w, h, h / 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.round(s * 0.62)}px sans-serif`
  ctx.fillText('USDC', 0, s * 0.3 + h / 2 + 0.5)
  if (label) {
    ctx.font = `800 ${Math.round(s * 0.8)}px sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = '#0b1626'
    ctx.strokeText(label, 0, s * 0.3 + h + s * 0.7)
    ctx.fillStyle = GREEN
    ctx.fillText(label, 0, s * 0.3 + h + s * 0.7)
  }
  ctx.restore()
}

/** Draws the arena top-down with the player, squad, hostiles and the money pin. */
export function drawMap(ctx: CanvasRenderingContext2D, info: MapInfo, nav: NavHud, o: DrawOpts) {
  const { size, now, rotate, radius } = o
  const c = size / 2
  const k = size / (2 * radius)
  const angle = rotate ? nav.yaw : 0
  const cx = rotate ? nav.px : 0
  const cz = rotate ? nav.pz : 0
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  if (rotate) {
    ctx.beginPath()
    ctx.arc(c, c, c - 1, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, size, size)

  const toScreen = (wx: number, wz: number) => {
    const dx = wx - cx
    const dz = wz - cz
    return { x: c + (dx * Math.cos(angle) - dz * Math.sin(angle)) * k, y: c + (dx * Math.sin(angle) + dz * Math.cos(angle)) * k }
  }

  ctx.save()
  ctx.translate(c, c)
  ctx.rotate(angle)
  ctx.scale(k, k)
  ctx.translate(-cx, -cz)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fillRect(-info.half, -info.half, info.half * 2, info.half * 2)
  ctx.strokeStyle = 'rgba(172,198,233,0.5)'
  ctx.lineWidth = 1.5 / k
  ctx.strokeRect(-info.half, -info.half, info.half * 2, info.half * 2)
  for (const [x0, x1, z0, z1, h] of info.boxes) {
    ctx.fillStyle = h > 3.2 ? 'rgba(160,176,196,0.7)' : h > 1.4 ? 'rgba(160,176,196,0.45)' : 'rgba(160,176,196,0.28)'
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0)
  }
  ctx.restore()

  const dot = (list: { x: number; z: number }[], color: string, r: number) => {
    ctx.fillStyle = color
    for (const e of list) {
      const s = toScreen(e.x, e.z)
      if (rotate && Math.hypot(s.x - c, s.y - c) > c - 4) continue
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  dot(nav.enemies, '#ff5d6c', rotate ? 3 : 4)
  dot(nav.allies, '#78c8e6', rotate ? 3.5 : 4.5)

  const me = toScreen(nav.px, nav.pz)
  if (nav.pin) {
    const target = toScreen(nav.pin.x, nav.pin.z)
    ctx.save()
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = 'rgba(109,255,160,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(me.x, me.y)
    let tx = target.x
    let ty = target.y
    const off = Math.hypot(tx - c, ty - c)
    if (rotate && off > c - 14) {
      tx = c + ((tx - c) / off) * (c - 14)
      ty = c + ((ty - c) / off) * (c - 14)
    }
    ctx.lineTo(tx, ty)
    ctx.stroke()
    ctx.restore()
    moneyBag(ctx, tx, ty + (rotate ? 2 : 6), rotate ? 6.5 : 10, now, rotate ? '' : (o.label ?? ''))
  }

  // player arrow: heading-up map points up, north-up map follows the facing direction
  ctx.save()
  ctx.translate(me.x, me.y)
  ctx.rotate(rotate ? 0 : Math.PI - nav.yaw)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#0b1626'
  ctx.lineWidth = 1.5
  const a = rotate ? 7 : 10
  ctx.beginPath()
  ctx.moveTo(0, -a * 1.2)
  ctx.lineTo(a * 0.8, a)
  ctx.lineTo(0, a * 0.5)
  ctx.lineTo(-a * 0.8, a)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  if (rotate) {
    const n = toScreen(cx, cz - radius * 0.86)
    ctx.fillStyle = '#ffd37a'
    ctx.font = '700 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('N', n.x, n.y)
  }
  ctx.restore()
}
