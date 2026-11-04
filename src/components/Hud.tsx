import type { HudState } from '@/game/types'
import { MiniMap, FullMap } from './MapViews'
import { MoneyBagIcon } from './MoneyBagIcon'
import type { MapInfo } from './mapDraw'
import { clock } from '@/lib/arena'
import { Crosshair, Heart, Radio, Shield, ShoppingCart, Timer, Skull, Eye } from 'lucide-react'

function Reticle({ hud, now }: { hud: HudState; now: number }) {
  const gap = hud.ads ? 3 : hud.sprinting ? 16 : 9
  const hit = now - hud.hitAt < 160
  const tick = 'absolute bg-white/90 shadow-[0_0_4px_rgba(0,0,0,0.8)]'
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <span className={`${tick} h-2.5 w-0.5`} style={{ left: -1, top: -gap - 10 }} />
      <span className={`${tick} h-2.5 w-0.5`} style={{ left: -1, top: gap }} />
      <span className={`${tick} h-0.5 w-2.5`} style={{ top: -1, left: -gap - 10 }} />
      <span className={`${tick} h-0.5 w-2.5`} style={{ top: -1, left: gap }} />
      <span className="absolute h-1 w-1 rounded-full bg-white/90" style={{ left: -2, top: -2 }} />
      {hit && (
        <svg width="34" height="34" viewBox="0 0 34 34" className="absolute -left-[17px] -top-[17px]" aria-hidden>
          <g stroke={hud.hitWasHead ? '#e86d7a' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 5l7 7M29 5l-7 7M5 29l7-7M29 29l-7-7" />
          </g>
        </svg>
      )}
    </div>
  )
}

export function Hud({ hud, map }: { hud: HudState; map: MapInfo | null }) {
  const now = hud.now
  const low = hud.health <= 35
  const dmgAge = now - hud.damagedAt
  const flash = Math.max(0, 1 - dmgAge / 450)
  const lowPulse = low ? 0.25 + 0.15 * Math.sin(now / 180) : 0
  const w = hud.weapon

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-[var(--ink)]">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
      {hud.scoped && (
        <>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 32vmin, #000 32.4vmin)' }} />
          <div className="absolute left-1/2 top-1/2 h-[64vmin] w-px -translate-x-1/2 -translate-y-1/2 bg-black/80" />
          <div className="absolute left-1/2 top-1/2 h-px w-[64vmin] -translate-x-1/2 -translate-y-1/2 bg-black/80" />
        </>
      )}
      {!hud.scoped && <Reticle hud={hud} now={now} />}

      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 160px 40px rgba(220,40,60,${Math.max(flash * 0.7, lowPulse)})` }} />
      {flash > 0 && (
        <div className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${hud.damageAngle}rad)`, opacity: flash }}>
          <div className="absolute -left-16 -top-40 h-3 w-32 rounded-full bg-[var(--danger)] blur-[2px]" />
        </div>
      )}

      <div className="absolute left-3 top-3 flex w-72 flex-col items-start gap-2 sm:left-5 sm:top-5">
        <MiniMap hud={hud} info={map} />
        <div className="flex flex-wrap gap-1.5">
          <span className="glass mono rounded-lg px-2 py-1 text-[10px] tracking-wider">{hud.mapName.toUpperCase()}</span>
          <span className="glass mono rounded-lg px-2 py-1 text-[10px] tracking-wider">SQUAD: {hud.squadHold ? 'HOLDING' : 'FOLLOWING'}</span>
          {hud.uav > 0 && (
            <span className="mono flex items-center gap-1 rounded-lg bg-[var(--amber)] px-2 py-1 text-[10px] font-bold tracking-wider text-[#0d1b2f]">
              <Eye size={11} /> UAV {Math.ceil(hud.uav)}s
            </span>
          )}
        </div>
        <div className="flex w-full flex-col gap-1">
          {hud.radio.map((l) => (
            <p key={l.id} className="hud-text flex items-start gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs">
              <Radio size={12} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span>
                <span className={`mono font-bold ${l.who === 'COMMAND' ? 'text-[var(--amber)]' : 'text-[#78c8e6]'}`}>{l.who}</span>
                <span className="text-[var(--ink-2)]">: {l.text}</span>
              </span>
            </p>
          ))}
        </div>
      </div>

      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1 sm:top-5">
        <div className="glass hud-text flex items-center gap-4 rounded-2xl px-4 py-2">
          <div className="text-center">
            <p className="label">Wave</p>
            <p className="display text-2xl font-bold tabular-nums leading-none">{hud.wave}{hud.mode === 'campaign' ? <span className="text-base text-[var(--subtle)]">/{hud.stageWaves}</span> : null}</p>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="text-center">
            <p className="label flex items-center justify-center gap-1"><Skull size={11} />Hostiles</p>
            <p className="display text-2xl font-bold tabular-nums leading-none">{hud.enemiesLeft}</p>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="text-center">
            <p className="label flex items-center justify-center gap-1"><Timer size={11} />Time</p>
            <p className={`display text-2xl font-bold tabular-nums leading-none ${hud.timeLeft < 30 ? 'text-[var(--danger)]' : ''}`}>{clock(hud.timeLeft)}</p>
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-3 text-right sm:right-5 sm:top-5">
        <div className="glass hud-text rounded-2xl px-4 py-2">
          <p className="label">{hud.mode === 'campaign' ? `Stage ${hud.stage} funds` : 'Score'}</p>
          <p className="display text-3xl font-bold tabular-nums leading-none">
            {hud.mode === 'campaign' ? `$${hud.funds.toLocaleString()}` : hud.score.toLocaleString()}
          </p>
          <p className="mono mt-1 text-[11px] text-[var(--subtle)]">{hud.kills} KILLS / {hud.headshots} HEADS</p>
        </div>
        {hud.streak >= 2 && (
          <p className="display hud-text mt-2 text-xl font-bold text-[var(--amber)]">x{hud.streak} STREAK</p>
        )}
      </div>

      <div className="absolute right-3 top-40 flex w-60 flex-col items-end gap-1 sm:right-5 sm:top-44">
        {hud.feed.map((f) => (
          <p
            key={f.id}
            className={`hud-text mono rounded-lg bg-black/35 px-2.5 py-1 text-[11px] font-medium tracking-wide ${
              f.tone === 'head' ? 'text-[var(--danger)]' : f.tone === 'info' ? 'text-[var(--amber)]' : 'text-[var(--ink-2)]'
            }`}
          >
            {f.text}
          </p>
        ))}
      </div>

      <p className="mono absolute bottom-1.5 left-1/2 hidden -translate-x-1/2 text-[10px] tracking-widest text-white/50 sm:block">
        V VIEW ({hud.view === 'tps' ? '3RD' : '1ST'})   M MAP   T SQUAD HOLD   B BUY   G FRAG
      </p>

      {hud.objective && (
        <div className="absolute left-1/2 top-[5.4rem] w-[min(92vw,22rem)] -translate-x-1/2 sm:top-[5.8rem]">
          <div className="glass hud-text rounded-2xl px-4 py-2 text-center">
            <p className="mono text-[10px] tracking-widest text-[var(--amber)]">STAGE {hud.stage}  |  {hud.stageName.toUpperCase()}</p>
            <p className="display mt-0.5 flex items-center justify-center gap-1.5 text-base font-bold">
              <MoneyBagIcon size={20} tag={false} />
              {hud.objective.text}
            </p>
            <p className="mono text-[11px] text-[var(--ink-2)]">{hud.objective.detail}</p>
            {hud.objective.kind === 'recover' && hud.objective.progress > 0 && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${hud.objective.progress * 100}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {hud.objective?.kind === 'recover' && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: `${hud.objective.sx * 100}%`, top: `${hud.objective.sy * 100}%` }}
        >
          <MoneyBagIcon size={38} className={`mx-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] ${hud.objective.onScreen ? '' : 'opacity-85'}`} />
          <p className="mono mt-0.5 text-[11px] font-bold text-[var(--success)] hud-text">{Math.round(hud.objective.dist)} m</p>
        </div>
      )}

      {hud.mapOpen && <FullMap hud={hud} info={map} />}

      {hud.banner && (
        <div key={hud.banner} className="banner-anim absolute left-1/2 top-[28%] -translate-x-1/2 text-center">
          <p className="display hud-text text-5xl font-bold tracking-[0.18em] sm:text-6xl">{hud.banner}</p>
        </div>
      )}

      <div className="absolute bottom-4 left-3 w-64 sm:bottom-6 sm:left-5">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label flex items-center gap-1.5"><Heart size={12} />Health</span>
            <span className="display text-xl font-bold tabular-nums">{hud.health}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{ width: `${(hud.health / hud.maxHealth) * 100}%`, background: low ? 'var(--danger)' : 'var(--success)' }}
            />
          </div>
          <div className="mb-1.5 mt-3 flex items-center justify-between">
            <span className="label flex items-center gap-1.5"><Shield size={12} />Armor</span>
            <span className="display text-base font-bold tabular-nums">{hud.armor}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150" style={{ width: `${hud.armor}%` }} />
          </div>
        </div>
        <div className="glass mt-2 flex items-center justify-between rounded-2xl px-4 py-2">
          <span className="label">Cash</span>
          <span className="display text-xl font-bold tabular-nums text-[var(--success)]">${hud.cash.toLocaleString()}</span>
        </div>
      </div>

      {hud.intermission && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 sm:bottom-8">
          <p className="glass hud-text mono flex items-center gap-2 rounded-xl px-3 py-2 text-xs tracking-widest">
            <ShoppingCart size={13} /> PRESS B FOR BUY STATION
          </p>
        </div>
      )}

      <div className="absolute bottom-4 right-3 w-64 sm:bottom-6 sm:right-5">
        <div className="mb-2 flex justify-end gap-1">
          {hud.slots.map((sl) => (
            <span
              key={sl.id}
              title={sl.name}
              className={`mono flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-medium ${
                sl.active ? 'bg-[var(--accent)] text-[#0d1b2f]' : sl.owned ? 'glass text-[var(--ink)]' : 'bg-black/25 text-[var(--subtle)]/50'
              }`}
            >
              {sl.key}
            </span>
          ))}
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="label">{w.name}</p>
              <p className="display mt-0.5 text-4xl font-bold tabular-nums leading-none">
                {w.mag}
                <span className="ml-1.5 text-lg font-medium text-[var(--subtle)]">/ {w.reserve}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="label flex items-center justify-end gap-1"><Crosshair size={11} />Frag</p>
              <p className="display text-2xl font-bold tabular-nums">{hud.grenades}</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${w.reloading ? hud.reload * 100 : (w.mag / w.magSize) * 100}%` }} />
          </div>
          <p className="mono mt-1.5 h-4 text-[10px] tracking-widest text-[var(--amber)]">
            {w.reloading ? 'RELOADING' : w.mag === 0 && w.reserve === 0 ? 'NO AMMO' : w.mag === 0 ? 'PRESS R' : w.mag <= Math.ceil(w.magSize / 4) ? 'LOW AMMO' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
