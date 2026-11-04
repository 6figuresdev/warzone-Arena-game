import { Banknote, Check, Lock, Play } from 'lucide-react'
import { STAGES, TOTAL_FUNDS, totalRescued, type CampaignSave } from '@/game/campaign'
import { MAP_LIST } from '@/game/maps'

interface Props {
  save: CampaignSave
  onSelect: (stage: number) => void
}

const money = (n: number) => `$${n.toLocaleString()}`

/** The ten stages, how much each one is worth, and how far you have got. */
export function CampaignPanel({ save, onSelect }: Props) {
  const rescued = totalRescued(save)
  const pct = Math.round((rescued / TOTAL_FUNDS) * 100)
  return (
    <div>
      <div className="glass rounded-3xl p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">Funds rescued</p>
            <p className="display text-3xl font-bold tabular-nums">
              {money(rescued)} <span className="text-base font-medium text-[var(--subtle)]">of {money(TOTAL_FUNDS)}</span>
            </p>
          </div>
          <p className="mono text-xs text-[var(--subtle)]">{Object.keys(save.cleared).length} / 10 stages</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {STAGES.map((s) => {
          const locked = s.n > save.unlocked
          const done = !!save.cleared[s.n]
          const next = !locked && !done
          return (
            <button
              key={s.n}
              type="button"
              disabled={locked}
              onClick={() => onSelect(s.n)}
              className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                locked
                  ? 'cursor-not-allowed border-[var(--border)] bg-white/[0.03] opacity-55'
                  : next
                    ? 'border-[var(--border-strong)] bg-white/[0.12] hover:bg-white/[0.18]'
                    : 'border-[var(--border)] bg-white/[0.06] hover:bg-white/10'
              }`}
            >
              <span className="display grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/30 text-xl font-bold tabular-nums">{s.n}</span>
              <span className="min-w-0 flex-1">
                <span className="display block truncate text-sm font-bold">{s.name}</span>
                <span className="mono mt-0.5 flex items-center gap-1 text-[11px] text-[var(--success)]">
                  <Banknote size={12} /> {money(s.funds)}
                  <span className="text-[var(--subtle)]"> | {MAP_LIST.find((m) => m.id === s.map)?.name}</span>
                </span>
              </span>
              {locked ? <Lock size={16} className="text-[var(--subtle)]" /> : done ? <Check size={18} className="text-[var(--success)]" /> : <Play size={16} className="text-[var(--accent)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
