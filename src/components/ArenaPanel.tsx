import { ConnectKitButton } from 'connectkit'
import { ExternalLink, Loader2, Trophy, Wallet } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import type { Arena } from '@/hooks/useArena'
import { ARENA_ADDRESS, ARENA_CHAIN_ID, clock, shortAddress, usdcText } from '@/lib/arena'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'

interface Props {
  arena: Arena
  starting: boolean
  error: string | null
  onPlayRanked: () => void
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2.5">
      <p className="label">{label}</p>
      <p className="display mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mono text-[10px] text-[var(--subtle)]">{sub}</p>}
    </div>
  )
}

function Action({ children, onClick, busy, disabled }: { children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className="btn-primary flex w-full items-center justify-center gap-2" onClick={onClick} disabled={busy || disabled}>
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function ArenaPanel({ arena, starting, error, onPlayRanked }: Props) {
  const { roundInfo, player, entryFee, busy, prev } = arena
  const fee = usdcText(entryFee)
  const broke = arena.balance !== undefined && entryFee !== undefined && arena.balance < entryFee

  let action: React.ReactNode
  if (!arena.configured) {
    action = <p className="text-sm text-[var(--danger)]">Arena contract address is missing from the app config.</p>
  } else if (!arena.isConnected) {
    action = (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <button type="button" className="btn-primary flex w-full items-center justify-center gap-2" onClick={show}>
            <Wallet size={16} />
            Connect wallet to play ranked
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  } else if (player.entered) {
    action = (
      <Action onClick={onPlayRanked} busy={starting} disabled={arena.wrongChain}>
        Deploy ranked run
      </Action>
    )
  } else if (arena.needsApproval) {
    action = (
      <Action onClick={() => void arena.approve()} busy={busy === 'approve'} disabled={broke}>
        {broke ? 'Need test USDC' : `Step 1 of 2: Approve ${fee} USDC`}
      </Action>
    )
  } else {
    action = (
      <Action onClick={() => void arena.enter()} busy={busy === 'enter'} disabled={broke}>
        {broke ? 'Need test USDC' : `Enter round for ${fee} USDC`}
      </Action>
    )
  }

  return (
    <section className="glass w-full rounded-[28px] p-5" aria-label="Ranked arena">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[var(--amber)]" />
          <h2 className="display text-lg font-bold">Prize pot</h2>
        </div>
        {arena.round !== undefined && <span className="label">Round {arena.round.toString()}</span>}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <TokenUSDC variant="branded" size={30} />
        <p className="display text-5xl font-bold leading-none tabular-nums">{roundInfo ? usdcText(roundInfo.pot) : '--'}</p>
        <p className="label mb-1">USDC</p>
      </div>
      <p className="mt-1 text-sm text-pretty text-[var(--muted)]">Highest verified score takes the whole pot. No score, everyone is refunded.</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Closes in" value={clock(arena.secondsLeft)} />
        <Stat label="Operators" value={roundInfo ? roundInfo.entrants.toString() : '--'} />
        <Stat
          label="Top score"
          value={roundInfo && roundInfo.topScore > 0 ? roundInfo.topScore.toLocaleString() : '--'}
          sub={roundInfo && roundInfo.topScore > 0 ? shortAddress(roundInfo.topPlayer) : undefined}
        />
      </div>

      {player.entered && (
        <p className="mt-3 rounded-xl bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
          You are in this round{player.bestScore > 0 ? `. Your best: ${player.bestScore.toLocaleString()}` : '. Post a score to compete.'}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {arena.wrongChain && (
          <p className="text-sm text-[var(--amber)]">Your wallet is on another network. The first action will ask to switch to Arc Testnet.</p>
        )}
        {action}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {arena.isConnected && (
          <p className="mono text-[11px] text-[var(--subtle)]">
            Balance {usdcText(arena.balance)} USDC. Entry {fee} USDC.
          </p>
        )}
      </div>

      {prev && (prev.claimable || prev.refundable || (prev.player.entered && prev.settling)) && (
        <div className="mt-4 rounded-2xl border border-[var(--border-strong)] bg-white/[0.06] p-3">
          <p className="label">Round {prev.round.toString()} settlement</p>
          {prev.settling && <p className="mt-1 text-sm text-[var(--muted)]">Scores are still being accepted for this round.</p>}
          {prev.claimable && (
            <div className="mt-2">
              <Action onClick={() => void arena.claim(prev.round)} busy={busy === 'claim'}>
                You won. Claim {usdcText(prev.info.pot)} USDC
              </Action>
            </div>
          )}
          {prev.refundable && (
            <div className="mt-2">
              <Action onClick={() => void arena.refund(prev.round)} busy={busy === 'refund'}>
                Refund my {fee} USDC entry
              </Action>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {ARENA_ADDRESS && (
          <a
            className="mono inline-flex items-center gap-1 text-[11px] text-[var(--subtle)] hover:text-[var(--ink)]"
            href={buildAddressExplorerUrl(ARENA_CHAIN_ID, ARENA_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contract {shortAddress(ARENA_ADDRESS)} <ExternalLink size={11} />
          </a>
        )}
        {arena.lastTx && (
          <a
            className="mono inline-flex items-center gap-1 text-[11px] text-[var(--subtle)] hover:text-[var(--ink)]"
            href={buildTxExplorerUrl(ARENA_CHAIN_ID, arena.lastTx)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Last transaction <ExternalLink size={11} />
          </a>
        )}
      </div>
    </section>
  )
}
