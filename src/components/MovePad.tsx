import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Zap } from 'lucide-react'
import type { HudState } from '@/game/types'
import type { TouchApi } from './TouchControls'

function Key({ code, label, icon, lit, api, className = '' }: { code: string; label: string; icon: ReactNode; lit: boolean; api: TouchApi; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`pointer-events-auto grid h-10 w-10 touch-none select-none place-items-center rounded-xl border text-white transition-colors ${
        lit ? 'border-[var(--accent)] bg-[var(--accent)]/70 text-[#0d1b2f]' : 'border-white/20 bg-black/35'
      } ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        api.hold(code, true)
      }}
      onPointerUp={() => api.hold(code, false)}
      onPointerCancel={() => api.hold(code, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
    </button>
  )
}

/**
 * Move pad that works the same on laptops and phones: click or tap and hold an arrow to walk.
 * It also lights up when W, A, S or D is pressed, so you can see the keyboard is working.
 */
export function MovePad({ hud, api, sprint, onSprint }: { hud: HudState; api: TouchApi; sprint: boolean; onSprint: () => void }) {
  const k = hud.moveKeys
  return (
    <div data-touch className="pointer-events-none absolute bottom-[11rem] left-3 z-30 opacity-85 sm:left-5">
      <div className="grid grid-cols-3 gap-1">
        <span />
        <Key code="KeyW" label="Walk forward (W)" icon={<ArrowUp size={17} />} lit={k.w} api={api} />
        <span />
        <Key code="KeyA" label="Step left (A)" icon={<ArrowLeft size={17} />} lit={k.a} api={api} />
        <Key code="KeyS" label="Walk back (S)" icon={<ArrowDown size={17} />} lit={k.s} api={api} />
        <Key code="KeyD" label="Step right (D)" icon={<ArrowRight size={17} />} lit={k.d} api={api} />
      </div>
      <button
        type="button"
        aria-label="Toggle sprint"
        title="Toggle sprint (hold Shift on the keyboard)"
        className={`pointer-events-auto mt-1 flex h-7 w-full touch-none items-center justify-center gap-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${
          sprint ? 'border-[var(--accent)] bg-[var(--accent)]/70 text-[#0d1b2f]' : 'border-white/20 bg-black/35 text-white'
        }`}
        onPointerDown={(e) => {
          e.preventDefault()
          onSprint()
        }}
      >
        <Zap size={11} /> Run
      </button>
    </div>
  )
}
