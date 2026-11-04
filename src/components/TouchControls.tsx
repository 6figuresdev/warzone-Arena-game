import { useRef, useState, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { ArrowUpFromLine, Bomb, RotateCcw, RotateCw, Undo2, ChevronsUp, Crosshair, Eye, Flame, Map as MapIcon, Menu, RefreshCw, Repeat, ShoppingCart, Shrink, Users, Zap } from 'lucide-react'
import type { GameEngine } from '@/game/engine'

export type TouchApi = ReturnType<GameEngine['touchApi']>

const STICK_RADIUS = 58

interface PadProps {
  label: string
  icon: ReactNode
  onDown: () => void
  onUp?: () => void
  /** Diameter in pixels. */
  px?: number
  tone?: 'fire' | 'normal'
  active?: boolean
  hint?: string
  /** Show the caption under the icon (used in the compact menu). */
  caption?: boolean
}

/** A compact on-screen button. Hover or long-press shows what it does. */
function Pad({ label, icon, onDown, onUp, px = 42, tone = 'normal', active, hint, caption }: PadProps) {
  return (
    <button
      type="button"
      aria-label={hint ?? label}
      title={hint ?? label}
      style={caption ? { width: px + 14, height: px + 8 } : { width: px, height: px }}
      className={`pointer-events-auto flex touch-none select-none flex-col items-center justify-center gap-px text-white transition-transform active:scale-90 ${
        caption ? 'rounded-xl' : 'rounded-full'
      } border ${
        tone === 'fire' ? 'border-red-300/50 bg-red-500/40' : 'border-white/20 bg-black/35'
      } ${active ? '!border-[var(--accent)] !bg-[var(--accent)]/70 !text-[#0d1b2f]' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        onDown()
      }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
      {caption && <span className="text-[8px] font-bold uppercase tracking-wider">{label}</span>}
    </button>
  )
}

export function TouchControls({ api }: { api: TouchApi }) {
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null)
  const [dragged, setDragged] = useState(false)
  const [running, setRunning] = useState(false)
  const [more, setMore] = useState(false)
  const [moved, setMoved] = useState(false)
  const lookPt = useRef<{ id: number; x: number; y: number } | null>(null)
  const stickId = useRef<number | null>(null)

  const moveStick = (e: RPointerEvent<HTMLDivElement>) => {
    if (stickId.current !== e.pointerId || !stick) return
    let dx = e.clientX - stick.ox
    let dy = e.clientY - stick.oy
    const len = Math.hypot(dx, dy)
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS
      dy = (dy / len) * STICK_RADIUS
    }
    setStick({ ...stick, x: dx, y: dy })
    api.move(dx / STICK_RADIUS, -dy / STICK_RADIUS)
    api.sprint(len > STICK_RADIUS * 1.15)
  }
  const endStick = (e: RPointerEvent<HTMLDivElement>) => {
    if (stickId.current !== e.pointerId) return
    stickId.current = null
    setStick(null)
    api.move(0, 0)
    api.sprint(false)
  }

  return (
    <div data-touch className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* Look area: drag anywhere on the right half. */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-[78%] w-[55%] touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          lookPt.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          const l = lookPt.current
          if (!l || l.id !== e.pointerId) return
          const dx = e.clientX - l.x
          const dy = e.clientY - l.y
          // Quick flicks turn further than slow drags.
          const gain = 2.4 * (1 + Math.min(1, Math.hypot(dx, dy) / 30))
          api.look(dx * gain, dy * gain)
          lookPt.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
          if (!dragged) setDragged(true)
        }}
        onPointerUp={() => (lookPt.current = null)}
        onPointerCancel={() => (lookPt.current = null)}
      />
      {!dragged && (
        <p className="mono absolute right-[22%] top-[40%] rounded-md bg-black/30 px-2 py-1 text-[9px] tracking-widest text-white/60">
          DRAG TO LOOK
        </p>
      )}

      {/* Move area: touch anywhere on the left and drag. */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-[62%] w-[42%] touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          stickId.current = e.pointerId
          setStick({ ox: e.clientX, oy: e.clientY, x: 0, y: 0 })
          setMoved(true)
        }}
        onPointerMove={moveStick}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      />
      {stick ? (
        <div className="absolute" style={{ left: stick.ox - 70, top: stick.oy - 70, width: 140, height: 140 }}>
          <div className="absolute inset-0 rounded-full border-2 border-white/35 bg-white/10" />
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/40"
            style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }}
          />
        </div>
      ) : (
        !moved && (
          <div className="absolute bottom-[11rem] left-8 flex h-20 w-20 flex-col items-center justify-center rounded-full border border-dashed border-white/30 bg-white/5 text-white/70">
            <ArrowUpFromLine size={14} />
            <span className="mono mt-0.5 text-[8px] tracking-widest">MOVE</span>
          </div>
        )
      )}

      {/* Combat cluster under the right thumb. */}
      <div className="absolute bottom-[10.5rem] right-3 h-[132px] w-[150px] opacity-85">
        <div className="absolute bottom-0 right-0">
          <Pad px={64} tone="fire" label="Fire" hint="Fire weapon" icon={<Flame size={24} />} onDown={() => api.fire(true)} onUp={() => api.fire(false)} />
        </div>
        <div className="absolute bottom-1 right-[74px]">
          <Pad px={44} label="Aim" hint="Aim down sights" icon={<Crosshair size={17} />} onDown={() => api.ads(true)} onUp={() => api.ads(false)} />
        </div>
        <div className="absolute bottom-[72px] right-1">
          <Pad px={44} label="Jump" hint="Jump" icon={<ChevronsUp size={17} />} onDown={() => api.hold('Space', true)} onUp={() => api.hold('Space', false)} />
        </div>
        <div className="absolute bottom-[78px] right-[62px]">
          <Pad px={38} label="Reload" hint="Reload weapon" icon={<RefreshCw size={15} />} onDown={() => api.tap('KeyR')} />
        </div>
      </div>

      {/* More actions, tucked away until needed. */}
      {more && (
        <div className="pointer-events-auto absolute bottom-14 left-1/2 grid -translate-x-1/2 grid-cols-3 gap-1.5 rounded-2xl border border-white/15 bg-[#0b1626]/85 p-2">
          <Pad caption px={40} label="Weapon" hint="Switch to next weapon" icon={<Repeat size={15} />} onDown={() => api.tap('KeyQ')} />
          <Pad caption px={40} label="Grenade" hint="Throw grenade" icon={<Bomb size={15} />} onDown={() => api.tap('KeyG')} />
          <Pad caption px={40} label="Crouch" hint="Crouch for cover" icon={<Shrink size={15} />} onDown={() => api.hold('KeyC', true)} onUp={() => api.hold('KeyC', false)} />
          <Pad caption px={40} label="Shop" hint="Open the buy station" icon={<ShoppingCart size={15} />} onDown={() => { api.tap('KeyB'); setMore(false) }} />
          <Pad caption px={40} label="Map" hint="Open the map and money bag" icon={<MapIcon size={15} />} onDown={() => { api.tap('KeyM'); setMore(false) }} />
          <Pad caption px={40} label="View" hint="Switch first or third person" icon={<Eye size={15} />} onDown={() => api.tap('KeyV')} />
          <Pad caption px={40} label="Squad" hint="Squad hold or follow" icon={<Users size={15} />} onDown={() => api.tap('KeyT')} />
          <Pad caption px={40} label="U-turn" hint="Spin around 180 degrees" icon={<Undo2 size={15} />} onDown={() => { api.tap('KeyX'); setMore(false) }} />
          <Pad
            caption
            px={40}
            label="Run"
            hint="Toggle sprint"
            icon={<Zap size={15} />}
            active={running}
            onDown={() => {
              setRunning((r) => {
                api.sprint(!r)
                return !r
              })
            }}
          />
        </div>
      )}

      {/* Slim bottom bar: turn left, menu, turn right. */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 opacity-80">
        <Pad px={40} label="Turn left" hint="Hold to turn left, faster the longer you hold" icon={<RotateCcw size={16} />} onDown={() => api.turn(1)} onUp={() => api.turn(0)} />
        <button
          type="button"
          aria-label="More actions"
          title="More actions: weapon, grenade, crouch, shop, map, view, squad, u-turn, run"
          className={`pointer-events-auto flex h-8 touch-none items-center gap-1 rounded-full border px-3 text-[10px] font-bold uppercase tracking-widest text-white ${
            more ? 'border-[var(--accent)] bg-[var(--accent)]/70 text-[#0d1b2f]' : 'border-white/20 bg-black/35'
          }`}
          onPointerDown={(e) => {
            e.preventDefault()
            setMore((m) => !m)
          }}
        >
          <Menu size={13} /> Actions
        </button>
        <Pad px={40} label="Turn right" hint="Hold to turn right, faster the longer you hold" icon={<RotateCw size={16} />} onDown={() => api.turn(-1)} onUp={() => api.turn(0)} />
      </div>
    </div>
  )
}
