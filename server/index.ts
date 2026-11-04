/**
 * Referee service. It issues run sessions, checks a finished run for plausibility,
 * recomputes the score itself and signs an EIP-712 attestation the arena contract accepts.
 * The referee key only attests scores. It cannot move funds from the arena contract.
 */
import { createPublicClient, getAddress, http, isAddress, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChain } from '../src/onchain-facts'
import { arenaAbi } from '../src/lib/arenaAbi'
import { computeScore, validateTelemetry, MAX_SCORE } from '../src/game/scoring'
import type { RunTelemetry } from '../src/game/types'

const CHAIN_ID = 5042002
const COMPASS_CHAIN = 'Arc_Testnet'
const PORT = Number(process.env.REFEREE_PORT ?? 3001)
const SESSION_TTL_MS = 12 * 60 * 1000
const MAX_SESSIONS_PER_ROUND = 25

const arena = process.env.VITE_ARENA_ADDRESS as Hex | undefined
const key = process.env.REFEREE_PRIVATE_KEY as Hex | undefined
if (!arena || !isAddress(arena)) throw new Error('VITE_ARENA_ADDRESS is not set in .env')
if (!key) throw new Error('REFEREE_PRIVATE_KEY is not set in .env')

const referee = privateKeyToAccount(key)
const chain = getChain(CHAIN_ID)
if (!chain) throw new Error('Arc Testnet missing from onchain facts')

const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',')
const rpcUrl =
  process.env.RPC_PROXY_BASE_URL && proxyChains.indexOf(COMPASS_CHAIN) !== -1
    ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/${COMPASS_CHAIN}?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
    : chain.rpcUrls[0]

const client = createPublicClient({ transport: http(rpcUrl) })

interface Session {
  player: Hex
  round: bigint
  startedAt: number
  used: boolean
}
const sessions = new Map<string, Session>()
const perRound = new Map<string, number>()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function sweep() {
  const now = Date.now()
  for (const [id, s] of sessions) if (now - s.startedAt > SESSION_TTL_MS) sessions.delete(id)
}

async function startSession(body: { player?: string }) {
  if (!body.player || !isAddress(body.player)) return json({ error: 'Invalid player address.' }, 400)
  const player = getAddress(body.player)
  const round = (await client.readContract({ address: arena!, abi: arenaAbi, functionName: 'currentRound' })) as bigint
  const [entered] = (await client.readContract({
    address: arena!,
    abi: arenaAbi,
    functionName: 'getPlayer',
    args: [round, player],
  })) as readonly [boolean, number, boolean]
  if (!entered) return json({ error: 'Enter the current round before starting a ranked run.' }, 403)
  const k = `${round}:${player}`
  const n = perRound.get(k) ?? 0
  if (n >= MAX_SESSIONS_PER_ROUND) return json({ error: 'Run limit reached for this round.' }, 429)
  perRound.set(k, n + 1)
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, { player, round, startedAt: Date.now(), used: false })
  return json({ sessionId, round: round.toString() })
}

async function attest(body: { sessionId?: string; telemetry?: RunTelemetry }) {
  const s = body.sessionId ? sessions.get(body.sessionId) : undefined
  if (!s) return json({ error: 'Unknown or expired session.' }, 404)
  if (s.used) return json({ error: 'This run was already submitted.' }, 409)
  const t = body.telemetry
  if (!t || typeof t !== 'object') return json({ error: 'Missing run data.' }, 400)
  const problem = validateTelemetry(t, Date.now() - s.startedAt)
  if (problem) return json({ error: problem }, 422)
  const score = computeScore(t)
  if (score <= 0 || score > MAX_SCORE) return json({ error: 'Score out of range.' }, 422)

  const deadline = (await client.readContract({
    address: arena!,
    abi: arenaAbi,
    functionName: 'submissionDeadline',
    args: [s.round],
  })) as bigint
  if (BigInt(Math.floor(Date.now() / 1000)) >= deadline) return json({ error: 'That round has closed for scores.' }, 410)

  s.used = true
  const signature = await referee.signTypedData({
    domain: { name: 'WarzoneArena', version: '1', chainId: CHAIN_ID, verifyingContract: arena! },
    types: {
      ScoreAttestation: [
        { name: 'player', type: 'address' },
        { name: 'round', type: 'uint256' },
        { name: 'score', type: 'uint32' },
      ],
    },
    primaryType: 'ScoreAttestation',
    message: { player: s.player, round: s.round, score },
  })
  return json({ round: s.round.toString(), score, signature })
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    sweep()
    const url = new URL(req.url)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, referee: referee.address, arena })
      }
      if (req.method === 'POST' && url.pathname === '/session') return await startSession(await req.json())
      if (req.method === 'POST' && url.pathname === '/score') return await attest(await req.json())
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      console.error('referee error', err)
      return json({ error: 'Referee could not process that request.' }, 500)
    }
  },
})

console.log(`Referee listening on :${PORT} as ${referee.address}`)
