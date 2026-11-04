import { Banknote, Clock, Crosshair, MapPin, Skull } from 'lucide-react'
import { STAGES, stageEnemies } from '@/game/campaign'
import { MAP_LIST } from '@/game/maps'

interface Props {
  stage: number
  onDeploy: () => void
  onBack: () => void
}

/** Mission briefing shown before each stage. */
export function BriefingScreen({ stage, onDeploy, onBack }: Props) {
  const def = STAGES[stage - 1]
  if (!def) return null
  const map = MAP_LIST.find((m) => m.id === def.map)
  const thieves = Array.from({ length: def.waves }, (_, i) => stageEnemies(def, i + 1)).reduce((a, b) => a + b, 0)
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[linear-gradient(180deg,rgba(13,27,47,0.6)_0%,rgba(13,27,47,0.92)_100%)] p-5">
      <div className="glass w-full max-w-xl rounded-[28px] p-6 sm:p-8">
        <p className="label">Stage {stage} of 10</p>
        <h2 className="display mt-1 text-balance text-4xl font-bold leading-tight">{def.name}</h2>
        <p className="display mt-3 flex items-center gap-2 text-3xl font-bold text-[var(--success)]">
          <Banknote size={26} /> ${def.funds.toLocaleString()} stolen
        </p>
        <p className="mt-3 text-pretty text-[var(--muted)]">{def.blurb}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: <MapPin size={14} />, label: 'Location', value: map?.name ?? '' },
            { icon: <Skull size={14} />, label: 'Thieves', value: `${thieves} in ${def.waves} waves` },
            { icon: <Clock size={14} />, label: 'Time limit', value: `${Math.floor(def.timeS / 60)}:${String(def.timeS % 60).padStart(2, '0')}` },
            { icon: <Crosshair size={14} />, label: 'Squad', value: 'Ghost, Viper' },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl bg-white/[0.06] px-3 py-2.5">
              <p className="label flex items-center gap-1">{f.icon}{f.label}</p>
              <p className="mt-0.5 text-sm font-semibold">{f.value}</p>
            </div>
          ))}
        </div>

        <ol className="mt-5 space-y-2 text-sm text-[var(--ink-2)]">
          <li className="flex gap-3"><span className="mono text-[var(--amber)]">1</span>Eliminate every thief across {def.waves} waves. Some hide behind cover until you get close.</li>
          <li className="flex gap-3"><span className="mono text-[var(--amber)]">2</span>The money case appears with a green beam and a pin on your minimap. Press M for the full map.</li>
          <li className="flex gap-3"><span className="mono text-[var(--amber)]">3</span>Stand on the case for a few seconds to secure the funds. Reinforcements arrive while you hold.</li>
        </ol>
        <p className="mt-4 text-xs text-[var(--subtle)]">Clearing a stage pays bonus cash for the buy station and unlocks the next stage. Your guns carry over.</p>

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-primary flex-1" onClick={onDeploy}>
            Deploy
          </button>
          <button type="button" className="btn-ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
