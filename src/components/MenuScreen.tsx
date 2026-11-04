import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { Crosshair, Play } from 'lucide-react'
import type { Arena } from '@/hooks/useArena'
import type { CampaignSave } from '@/game/campaign'
import { ArenaPanel } from './ArenaPanel'
import { CampaignPanel } from './CampaignPanel'
import { shortAddress } from '@/lib/arena'
import { MAP_LIST, type MapId } from '@/game/maps'

interface Props {
  arena: Arena
  save: CampaignSave
  starting: boolean
  error: string | null
  onStage: (stage: number) => void
  onPractice: () => void
  onPlayRanked: () => void
  mapId: MapId
  onMap: (id: MapId) => void
}

const CONTROLS: [string, string][] = [
  ['WASD', 'Move'],
  ['Shift', 'Sprint'],
  ['C', 'Crouch'],
  ['Space', 'Jump'],
  ['Mouse', 'Aim / Fire'],
  ['Right click', 'Aim down sights'],
  ['R', 'Reload'],
  ['1-6 / Q / Wheel', 'Switch weapon'],
  ['G', 'Frag grenade'],
  ['B', 'Buy station'],
  ['V', 'Third / first person'],
  ['T', 'Squad hold / follow'],
  ['Arrows / X', 'Turn / quick turn'],
  ['Esc', 'Pause and all commands'],
]

type Tab = 'campaign' | 'endless'

export function MenuScreen({ arena, save, starting, error, onStage, onPractice, onPlayRanked, mapId, onMap }: Props) {
  const [tab, setTab] = useState<Tab>('campaign')
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[linear-gradient(180deg,rgba(13,27,47,0.55)_0%,rgba(13,27,47,0.9)_100%)]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-5 py-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair size={20} className="text-[var(--accent)]" />
              <span className="label">Warzone Arena</span>
            </div>
            <ConnectKitButton.Custom>
              {({ show, isConnected, address }) => (
                <button type="button" className="btn-ghost text-sm" onClick={show}>
                  {isConnected ? shortAddress(address) : 'Connect wallet'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>

          <h1 className="display text-balance text-5xl font-bold leading-[0.95] sm:text-6xl">
            {tab === 'campaign' ? (
              <>
                Take the money
                <br />
                <span className="text-[var(--accent)]">back.</span>
              </>
            ) : (
              <>
                Hold the line.
                <br />
                <span className="text-[var(--accent)]">Win the pot.</span>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-md text-pretty text-lg text-[var(--muted)]">
            {tab === 'campaign'
              ? 'Ten stages, ten heists. Beat the thieves, grab the stolen case and carry it out. Each stage is worth more than the last, from $500 up to $5,000.'
              : 'Endless waves with your squad. Stake USDC on a ten minute round and the best verified score takes the pot.'}
          </p>

          <div className="mt-5 inline-flex rounded-xl bg-white/10 p-1" role="tablist" aria-label="Game mode">
            {(
              [
                ['campaign', 'Campaign'],
                ['endless', 'Endless and ranked'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${tab === id ? 'bg-[var(--accent)] text-[#0d1b2f]' : 'text-[var(--muted)] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'campaign' ? (
            <div className="mt-5">
              <CampaignPanel save={save} onSelect={onStage} />
            </div>
          ) : (
            <>
              <div className="mt-5 grid max-w-xl gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Battlefield">
                {MAP_LIST.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={mapId === m.id}
                    onClick={() => onMap(m.id)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${mapId === m.id ? 'border-[var(--border-strong)] bg-white/15' : 'border-[var(--border)] bg-white/5 hover:bg-white/10'}`}
                  >
                    <p className="display text-base font-bold">{m.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--subtle)]">{m.blurb}</p>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn-primary flex items-center gap-2" onClick={onPractice}>
                  <Play size={16} />
                  Free practice
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--subtle)]">Practice needs no wallet and never touches the pot.</p>
            </>
          )}

          <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="mono text-xs font-medium text-[var(--ink)]">{k}</dt>
                <dd className="text-xs text-[var(--subtle)]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {tab === 'endless' && (
          <div className="w-full lg:max-w-sm">
            <ArenaPanel arena={arena} starting={starting} error={error} onPlayRanked={onPlayRanked} />
            <p className="mt-3 px-1 text-xs text-pretty text-[var(--subtle)]">
              Scores are checked and signed by a referee service before the contract accepts them. This is a testnet demo, not a tamper-proof anti-cheat system.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
