import { Banknote, Trophy } from 'lucide-react'
import { STAGE_COUNT, TOTAL_FUNDS, STAGES, totalRescued, type CampaignSave, type StageResult } from '@/game/campaign'
import { clock } from '@/lib/arena'

interface Props {
  result: StageResult
  save: CampaignSave
  onNext: () => void
  onRetry: () => void
  onMenu: () => void
}

const money = (n: number) => `$${n.toLocaleString()}`

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-3">
      <p className="label">{label}</p>
      <p className="display mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

/** End of a campaign stage: funds recovered or lost, and what comes next. */
export function StageResultScreen({ result: r, save, onNext, onRetry, onMenu }: Props) {
  const cleared = r.outcome === 'cleared'
  const finale = cleared && r.stage >= STAGE_COUNT
  const def = STAGES[r.stage - 1]
  const rescued = totalRescued(save)
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[rgba(13,27,47,0.86)] p-5 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-[28px] p-6 sm:p-8">
        {finale ? (
          <>
            <p className="label flex items-center gap-1.5 text-[var(--amber)]"><Trophy size={13} /> Campaign complete</p>
            <h2 className="display mt-1 text-balance text-4xl font-bold">Every dollar is back.</h2>
            <p className="mt-2 text-[var(--muted)]">
              You took down the syndicate and recovered {money(TOTAL_FUNDS)} across all ten stages.
            </p>
          </>
        ) : cleared ? (
          <>
            <p className="label text-[var(--success)]">Stage {r.stage} cleared</p>
            <h2 className="display mt-1 text-balance text-4xl font-bold">{money(r.funds)} rescued</h2>
            <p className="mt-2 text-[var(--muted)]">{def?.name}: the funds are secure. Bonus cash of {money(Math.round(r.funds / 2))} is waiting at the buy station.</p>
          </>
        ) : (
          <>
            <p className="label text-[var(--danger)]">{r.outcome === 'died' ? 'Operator down' : 'Time expired'}</p>
            <h2 className="display mt-1 text-balance text-4xl font-bold">The thieves got away.</h2>
            <p className="mt-2 text-[var(--muted)]">
              {money(r.funds)} is still out there. {r.outcome === 'died' ? 'Regroup and try the stage again.' : 'Move faster next time.'}
            </p>
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Kills" value={String(r.kills)} />
          <Stat label="Headshots" value={String(r.headshots)} />
          <Stat label="Accuracy" value={`${r.accuracy}%`} />
          <Stat label="Time" value={clock(r.durationMs / 1000)} />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3">
          <span className="label flex items-center gap-1.5"><Banknote size={13} /> Total rescued</span>
          <span className="display text-xl font-bold tabular-nums text-[var(--success)]">
            {money(rescued)} <span className="text-sm font-medium text-[var(--subtle)]">of {money(TOTAL_FUNDS)}</span>
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {cleared && !finale && (
            <button type="button" className="btn-primary flex-1" onClick={onNext}>
              Next stage
            </button>
          )}
          {!cleared && (
            <button type="button" className="btn-primary flex-1" onClick={onRetry}>
              Retry stage {r.stage}
            </button>
          )}
          {finale && (
            <button type="button" className="btn-primary flex-1" onClick={onRetry}>
              Replay stage 10
            </button>
          )}
          <button type="button" className="btn-ghost flex-1" onClick={onMenu}>
            {finale ? 'Back to menu' : 'Stage select'}
          </button>
        </div>
      </div>
    </div>
  )
}
