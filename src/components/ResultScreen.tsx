import { useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import type { Arena } from '@/hooks/useArena'
import type { RunTelemetry } from '@/game/types'
import { requestAttestation, type Attestation } from '@/lib/referee'
import { ARENA_CHAIN_ID, clock } from '@/lib/arena'
import { buildTxExplorerUrl } from '@/onchain-facts'

export interface RunResult {
  telemetry: RunTelemetry
  score: number
  sessionId: string | null
}

interface Props {
  result: RunResult
  arena: Arena
  onReplay: () => void
  onMenu: () => void
}

type AttestState = { status: 'none' } | { status: 'loading' } | { status: 'ready'; att: Attestation } | { status: 'error'; message: string }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-3">
      <p className="label">{label}</p>
      <p className="display mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function ResultScreen({ result, arena, onReplay, onMenu }: Props) {
  const { telemetry: t, score, sessionId } = result
  const [attest, setAttest] = useState<AttestState>(sessionId ? { status: 'loading' } : { status: 'none' })
  const [recorded, setRecorded] = useState(false)
  const asked = useRef(false)

  useEffect(() => {
    if (!sessionId || asked.current) return
    asked.current = true
    requestAttestation(sessionId, t)
      .then((att) => setAttest({ status: 'ready', att }))
      .catch((err: Error) => setAttest({ status: 'error', message: err.message }))
  }, [sessionId, t])

  const accuracy = t.shotsFired > 0 ? Math.round((t.shotsHit / t.shotsFired) * 100) : 0
  const submit = async () => {
    if (attest.status !== 'ready') return
    const ok = await arena.submitScore(BigInt(attest.att.round), attest.att.score, attest.att.signature)
    if (ok) setRecorded(true)
  }

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-[rgba(13,27,47,0.82)] p-5 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-[28px] p-6">
        <p className="label">{t.died ? 'Operator down' : 'Time expired'}</p>
        <p className="display mt-1 text-6xl font-bold tabular-nums leading-none">{score.toLocaleString()}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {sessionId ? 'Ranked run' : 'Practice run'}. Reached wave {t.wave}.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Kills" value={String(t.kills)} />
          <Stat label="Headshots" value={String(t.headshots)} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Survived" value={clock(t.durationMs / 1000)} />
          <Stat label="Damage" value={String(t.damageTaken)} />
          <Stat label="Shots" value={String(t.shotsFired)} />
        </div>

        {sessionId && (
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white/[0.04] p-4">
            {attest.status === 'loading' && (
              <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 size={15} className="animate-spin" />
                Referee is verifying your run
              </p>
            )}
            {attest.status === 'error' && <p className="text-sm text-[var(--danger)]">{attest.message}</p>}
            {attest.status === 'ready' && !recorded && (
              <>
                <p className="text-sm text-pretty text-[var(--muted)]">
                  Verified. Post {attest.att.score.toLocaleString()} to round {attest.att.round} so it counts toward the pot.
                </p>
                <button type="button" className="btn-primary mt-3 flex w-full items-center justify-center gap-2" onClick={() => void submit()} disabled={arena.busy === 'submit'}>
                  {arena.busy === 'submit' && <Loader2 size={16} className="animate-spin" />}
                  Lock score onchain
                </button>
              </>
            )}
            {recorded && (
              <div className="text-sm text-[var(--success)]">
                <p className="flex items-center gap-2">
                  <Check size={15} /> Score recorded for round {attest.status === 'ready' ? attest.att.round : ''}.
                </p>
                {arena.lastTx && (
                  <a className="mono mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--subtle)] hover:text-[var(--ink)]" href={buildTxExplorerUrl(ARENA_CHAIN_ID, arena.lastTx)} target="_blank" rel="noopener noreferrer">
                    View transaction <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-primary flex flex-1 items-center justify-center gap-2" onClick={onReplay}>
            <RotateCcw size={15} />
            Run it again
          </button>
          <button type="button" className="btn-ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
