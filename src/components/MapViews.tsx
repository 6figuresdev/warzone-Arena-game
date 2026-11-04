import { useEffect, useRef } from 'react'
import { MoneyBagIcon } from './MoneyBagIcon'
import type { HudState } from '@/game/types'
import { drawMap, type MapInfo } from './mapDraw'

function useMapCanvas(hud: HudState, info: MapInfo | null, size: number, rotate: boolean, radius: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !info) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (cv.width !== size * dpr) {
      cv.width = size * dpr
      cv.height = size * dpr
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawMap(ctx, info, hud.nav, { size, now: hud.now, rotate, radius, label: hud.funds > 0 ? `$${hud.funds.toLocaleString()}` : '' })
  }, [hud, info, size, rotate, radius])
  return ref
}

/** Round heading-up minimap with the money pin. */
export function MiniMap({ hud, info }: { hud: HudState; info: MapInfo | null }) {
  const size = 176
  const ref = useMapCanvas(hud, info, size, true, hud.uav > 0 ? 64 : 42)
  const pin = hud.nav.pin
  const dist = pin ? Math.round(Math.hypot(pin.x - hud.nav.px, pin.z - hud.nav.pz)) : null
  return (
    <div className="relative">
      <div className="glass overflow-hidden rounded-full p-0.5" style={{ width: size + 4, height: size + 4 }}>
        <canvas ref={ref} style={{ width: size, height: size }} className="rounded-full" aria-label="Minimap" />
      </div>
      {dist !== null && (
        <p className="mono absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#0b1626] px-2.5 py-1 text-[11px] font-bold text-[#6dffa0] ring-1 ring-[#6dffa0]/50">
          <MoneyBagIcon size={14} tag={false} /> USDC BAG {dist} m
        </p>
      )}
    </div>
  )
}

/** Full north-up tactical map, opened with M. */
export function FullMap({ hud, info }: { hud: HudState; info: MapInfo | null }) {
  const size = Math.max(280, Math.min(560, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.74)))
  const ref = useMapCanvas(hud, info, size, false, info ? info.half * 1.04 : 60)
  const pin = hud.nav.pin
  const dist = pin ? Math.round(Math.hypot(pin.x - hud.nav.px, pin.z - hud.nav.pz)) : null
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]">
      <div className="glass rounded-[28px] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-6">
          <div>
            <p className="label">Tactical map</p>
            <p className="display text-xl font-bold">{hud.mapName}</p>
          </div>
          <p className="mono text-right text-[11px] text-[var(--ink-2)]">
            {dist !== null ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#6dffa0]"><MoneyBagIcon size={18} tag={false} /> USDC BAG {dist} m</span>
            ) : (
              <span>The USDC bag is marked once every wave is cleared</span>
            )}
            <br />
            PRESS M TO CLOSE
          </p>
        </div>
        <canvas ref={ref} style={{ width: size, height: size }} className="rounded-2xl" aria-label="Full map" />
        <div className="mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--ink-2)]">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-white" />You</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#78c8e6]" />Squad</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ff5d6c]" />Thieves</span>
          <span><MoneyBagIcon size={13} tag={false} className="mr-1 inline-block align-[-3px]" />USDC bag (stolen funds)</span>
        </div>
      </div>
    </div>
  )
}
