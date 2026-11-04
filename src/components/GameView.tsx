import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { GameEngine, type EngineEvents } from '@/game/engine'
import type { HudState } from '@/game/types'
import { Hud } from './Hud'
import type { MapInfo } from './mapDraw'
import { ShopOverlay } from './ShopOverlay'
import { ControlsGuide } from './ControlsGuide'
import { TouchControls, type TouchApi } from './TouchControls'

interface Props {
  events: EngineEvents
  onReady: (engine: GameEngine) => void
  playing: boolean
  hud: HudState | null
  onResume: () => void
}

export function GameView({ events, onReady, playing, hud, onResume }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const eventsRef = useRef(events)
  const readyRef = useRef(onReady)
  const [muted, setMuted] = useState(false)
  const [api, setApi] = useState<TouchApi | null>(null)
  const [mapInfo, setMapInfo] = useState<MapInfo | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [touchPref, setTouchPref] = useState<boolean | null>(() => {
    const v = localStorage.getItem('arc.touch')
    return v === null ? null : v === '1'
  })
  const [sens, setSens] = useState(() => Number(localStorage.getItem('arc.sens') ?? '1') || 1)

  useEffect(() => {
    eventsRef.current = events
    readyRef.current = onReady
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let engine: GameEngine
    try {
      engine = new GameEngine(canvas, {
        onHud: (s) => eventsRef.current.onHud(s),
        onEnd: (t, score) => eventsRef.current.onEnd(t, score),
        onStage: (r) => eventsRef.current.onStage(r),
        onError: (m) => setFatal(m),
      })
    } catch (err) {
      console.error(err)
      queueMicrotask(() => setFatal('This browser or device cannot run 3D graphics (WebGL). Try Chrome, Edge or Firefox on a computer with hardware acceleration turned on.'))
      return
    }
    engineRef.current = engine
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __arc: unknown }).__arc = engine.debugApi()
    readyRef.current(engine)
    queueMicrotask(() => setApi(engine.touchApi()))
  return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const started = hud !== null && hud.timeLimit - hud.timeLeft > 0.2
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const showTouch = touchPref ?? (coarse || hud?.fallback === true)

  useEffect(() => {
    api?.setActive(showTouch)
  }, [api, showTouch])

  useEffect(() => {
    engineRef.current?.setSensitivity(sens)
    localStorage.setItem('arc.sens', String(sens))
  }, [sens, api])

  const shopOpen = playing && hud !== null && hud.shopOpen
  const paused = playing && hud !== null && !hud.locked && !shopOpen

  const mapName = hud?.mapName
  useEffect(() => {
    if (mapName) setMapInfo(engineRef.current?.mapInfo() ?? null)
  }, [mapName])

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" style={{ filter: 'contrast(1.08) saturate(1.12)' }} />
      {fatal && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[#0b1626]/95 p-6 text-center">
          <div className="glass max-w-md rounded-3xl p-7">
            <p className="label text-[var(--danger)]">Cannot start the game</p>
            <p className="mt-2 text-pretty text-[var(--ink-2)]">{fatal}</p>
            <button type="button" className="btn-primary mt-5" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )}
      {playing && hud && <Hud hud={hud} map={mapInfo} />}
      {playing && hud && hud.locked && !shopOpen && showTouch && api && <TouchControls api={api} />}
      {shopOpen && hud && (
        <ShopOverlay hud={hud} onBuy={(id) => engineRef.current?.buy(id) ?? 'Unavailable'} onClose={onResume} />
      )}
      {playing && hud && hud.locked && !shopOpen && started && hud.timeLimit - hud.timeLeft < 25 && (
        <p className="glass hud-text absolute left-1/2 top-24 z-20 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-xs text-[var(--ink-2)]">
          {showTouch
            ? 'Drag on the left to move, drag on the right to look, hold FIRE to shoot. Every button is labelled.'
            : 'W A S D to move, mouse to look, left click to fire, right click to aim, R to reload, B to buy. Press Esc to see every command.'}
        </p>
      )}
      {(paused || (playing && !hud)) && (
        <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-[rgba(13,27,47,0.72)] p-4 backdrop-blur-[2px]">
          <div className="glass w-full max-w-3xl rounded-[28px] p-5 sm:p-6">
            <div className="grid gap-5 md:grid-cols-[15rem_1fr]">
              <div className="text-center md:text-left">
                <p className="label">{started ? 'Paused' : 'Ready to deploy'}</p>
                <p className="display mt-1 text-2xl font-bold">{started ? 'Resume the fight' : 'Click Deploy'}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {hud?.fallback
                    ? 'Your browser keeps the cursor free, so use WASD or the on-screen controls.'
                    : 'Your mouse is captured while you play. Press Esc to pause.'}
                </p>
                <button type="button" className="btn-primary mt-4 w-full" onClick={onResume}>
                  {started ? 'Resume' : 'Deploy'}
                </button>
                <label className="mt-4 block text-left text-xs text-[var(--muted)]">
                  Look sensitivity {sens.toFixed(1)}x
                  <input type="range" min={0.4} max={2.5} step={0.1} value={sens} onChange={(e) => setSens(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
                </label>
                <button
                  type="button"
                  className="btn-ghost mt-2 w-full text-sm"
                  onClick={() => {
                    const next = !showTouch
                    setTouchPref(next)
                    localStorage.setItem('arc.touch', next ? '1' : '0')
                  }}
                >
                  On-screen buttons: {showTouch ? 'On' : 'Off'}
                </button>
                {started && (
                  <button type="button" className="btn-ghost mt-2 w-full text-sm" onClick={() => engineRef.current?.openShop()}>
                    Buy station
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost mt-2 flex w-full items-center justify-center gap-2 text-sm"
                  onClick={() => {
                    engineRef.current?.setMuted(!muted)
                    setMuted(!muted)
                  }}
                >
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  {muted ? 'Sound off' : 'Sound on'}
                </button>
              </div>
              <ControlsGuide initial={showTouch ? 'touch' : 'keys'} key={showTouch ? 'touch' : 'keys'} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
