import { useState } from 'react'
import { Check, Crosshair, ShoppingCart } from 'lucide-react'
import { SHOP_WEAPONS, SUPPLY_ITEMS, WEAPONS, type ShopItem } from '@/game/config'
import type { HudState, ShopItemId } from '@/game/types'

interface Props {
  hud: HudState
  onBuy: (id: ShopItemId) => string | null
  onClose: () => void
}

function Row({ item, hud, onBuy }: { item: ShopItem; hud: HudState; onBuy: (id: ShopItemId) => void }) {
  const owned = item.group === 'weapon' && hud.slots.some((s) => s.id === item.id && s.owned)
  const afford = hud.cash >= item.price
  const def = item.group === 'weapon' ? WEAPONS[item.id as keyof typeof WEAPONS] : null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="display truncate text-base font-bold">{item.name}</p>
        <p className="truncate text-xs text-[var(--subtle)]">{item.desc}</p>
        {def && (
          <p className="mono mt-1 text-[10px] text-[var(--muted)]">
            DMG {def.damage}
            {def.pellets > 1 ? `x${def.pellets}` : ''} / RPM {def.rpm} / MAG {def.magSize}
          </p>
        )}
      </div>
      {owned ? (
        <span className="mono flex items-center gap-1 text-xs text-[var(--success)]">
          <Check size={13} /> OWNED
        </span>
      ) : (
        <button
          type="button"
          className="btn-primary min-h-11 shrink-0 px-4 text-sm"
          disabled={!afford}
          onClick={() => onBuy(item.id)}
        >
          ${item.price.toLocaleString()}
        </button>
      )}
    </div>
  )
}

export function ShopOverlay({ hud, onBuy, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const buy = (id: ShopItemId) => setMsg(onBuy(id))

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[rgba(13,27,47,0.8)] p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-3xl rounded-[28px] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label flex items-center gap-1.5"><ShoppingCart size={12} />Buy station</p>
            <h2 className="display mt-1 text-3xl font-bold">Gear up</h2>
          </div>
          <div className="text-right">
            <p className="label">Cash</p>
            <p className="display text-3xl font-bold tabular-nums text-[var(--success)]">${hud.cash.toLocaleString()}</p>
          </div>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">Earn cash from kills and wave bonuses. Cash is in-game only and never touches your USDC.</p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="label mb-2">Weapons</p>
            <div className="space-y-2">
              {SHOP_WEAPONS.map((it) => (
                <Row key={it.id} item={it} hud={hud} onBuy={buy} />
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">Supplies</p>
            <div className="space-y-2">
              {SUPPLY_ITEMS.map((it) => (
                <Row key={it.id} item={it} hud={hud} onBuy={buy} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="min-h-5 text-sm text-[var(--amber)]" role="status">{msg}</p>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={onClose}>
            <Crosshair size={16} />
            Back to the fight
          </button>
        </div>
      </div>
    </div>
  )
}
