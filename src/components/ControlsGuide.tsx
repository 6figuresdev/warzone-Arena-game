import { useState } from 'react'
import { Keyboard, Smartphone } from 'lucide-react'

type Row = [keys: string, action: string]

const KEYBOARD: { title: string; rows: Row[] }[] = [
  {
    title: 'Move and look',
    rows: [
      ['W A S D', 'Walk forward, left, back, right'],
      ['Mouse', 'Look around'],
      ['Left / Right arrows', 'Turn left or right (hold to turn faster)'],
      ['X', 'Quick turn 180 degrees'],
      ['Shift (hold)', 'Sprint while moving forward'],
      ['Space', 'Jump over low cover'],
      ['C', 'Crouch behind cover'],
    ],
  },
  {
    title: 'Fight',
    rows: [
      ['Left click', 'Fire your weapon'],
      ['Right click', 'Aim down sights for accuracy'],
      ['R', 'Reload'],
      ['G', 'Throw a frag grenade'],
      ['1-6, Q or wheel', 'Switch weapon'],
    ],
  },
  {
    title: 'Team and gear',
    rows: [
      ['B', 'Buy station: guns, ammo, armor'],
      ['M', 'Open the big map with the money pin'],
      ['T', 'Order squad: hold or follow you'],
      ['V', 'Switch first or third person'],
      ['Esc', 'Pause'],
    ],
  },
]

const TOUCH: { title: string; rows: Row[] }[] = [
  {
    title: 'Move and look',
    rows: [
      ['Left side', 'Touch and drag to walk. Push to the edge to run'],
      ['Right side', 'Drag to look around. Quick flicks turn further'],
      ['TURN LEFT / TURN RIGHT', 'Hold to turn, faster the longer you hold'],
      ['U-TURN', 'Spin 180 degrees to face behind you'],
      ['JUMP', 'Jump over low cover'],
      ['CROUCH', 'Hold to crouch behind cover'],
      ['RUN', 'Toggle sprint while moving'],
    ],
  },
  {
    title: 'Fight',
    rows: [
      ['FIRE', 'Hold to shoot'],
      ['AIM', 'Hold to aim down sights'],
      ['RELOAD', 'Small button above FIRE: reload'],
      ['GRENADE', 'Actions menu: throw a frag grenade'],
      ['WEAPON', 'Actions menu: next weapon'],
    ],
  },
  {
    title: 'Team and gear',
    rows: [
      ['ACTIONS', 'Tap the Actions button at the bottom to open the full menu'],
      ['SHOP / MAP', 'Actions menu: buy station and the big map with the USDC bag'],
      ['SQUAD / VIEW', 'Actions menu: squad hold or follow, first or third person'],
      ['U-TURN / RUN / CROUCH', 'Actions menu'],
    ],
  },
]

/** Plain-language command reference with a tab for each way of playing. */
export function ControlsGuide({ initial }: { initial: 'keys' | 'touch' }) {
  const [tab, setTab] = useState<'keys' | 'touch'>(initial)
  const groups = tab === 'keys' ? KEYBOARD : TOUCH
  return (
    <div className="text-left">
      <div className="mb-3 inline-flex rounded-xl bg-white/10 p-1" role="tablist" aria-label="Control scheme">
        {(
          [
            ['keys', 'Keyboard and mouse', Keyboard],
            ['touch', 'On-screen buttons', Smartphone],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-[var(--accent)] text-[#0d1b2f]' : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="label mb-1.5">{g.title}</p>
            <ul className="space-y-1.5">
              {g.rows.map(([keys, action]) => (
                <li key={keys} className="flex items-start gap-2 text-xs leading-snug">
                  <span className="mono min-w-[4.6rem] shrink-0 rounded-md bg-white/12 px-1.5 py-0.5 text-center text-[10px] font-semibold text-[var(--ink)]">
                    {keys}
                  </span>
                  <span className="text-[var(--muted)]">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
