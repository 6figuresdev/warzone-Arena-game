import { useCallback, useEffect, useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from 'wagmi'
import { arenaAbi } from '@/lib/arenaAbi'
import { ARENA_ADDRESS, ARENA_CHAIN_ID, USDC_ADDRESS, parseOnchainError } from '@/lib/arena'
import { toast } from 'sonner'

export interface RoundInfo {
  pot: bigint
  entrants: bigint
  topScore: number
  topPlayer: `0x${string}`
  claimed: boolean
  endsAt: bigint
  deadline: bigint
}

export interface PlayerInfo {
  entered: boolean
  bestScore: number
  refunded: boolean
}

export type ArenaAction = 'approve' | 'enter' | 'claim' | 'refund' | 'submit'

const base = { address: ARENA_ADDRESS as `0x${string}`, abi: arenaAbi, chainId: ARENA_CHAIN_ID } as const
const ZERO = '0x0000000000000000000000000000000000000000'
const EMPTY_PLAYER: PlayerInfo = { entered: false, bestScore: 0, refunded: false }

export function useArena() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient({ chainId: ARENA_CHAIN_ID })
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [busy, setBusy] = useState<ArenaAction | null>(null)
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const me = (address ?? ZERO)

  const head = useReadContracts({
    allowFailure: false,
    query: { enabled: !!ARENA_ADDRESS, refetchInterval: 5000 },
    contracts: [
      { ...base, functionName: 'currentRound' },
      { ...base, functionName: 'entryFee' },
      { ...base, functionName: 'CLAIM_GRACE' },
    ],
  })
  const round = head.data?.[0]
  const entryFee = head.data?.[1]
  const grace = head.data?.[2]
  const prevRound = round !== undefined && round > 0n ? round - 1n : undefined

  const detail = useReadContracts({
    allowFailure: false,
    query: { enabled: !!ARENA_ADDRESS && round !== undefined, refetchInterval: 5000 },
    contracts: [
      { ...base, functionName: 'getRound', args: [round ?? 0n] },
      { ...base, functionName: 'getPlayer', args: [round ?? 0n, me] },
      { ...base, functionName: 'getRound', args: [prevRound ?? 0n] },
      { ...base, functionName: 'getPlayer', args: [prevRound ?? 0n, me] },
      { address: USDC_ADDRESS, abi: erc20Abi, chainId: ARENA_CHAIN_ID, functionName: 'balanceOf', args: [me] },
      { address: USDC_ADDRESS, abi: erc20Abi, chainId: ARENA_CHAIN_ID, functionName: 'allowance', args: [me, ARENA_ADDRESS ?? ZERO] },
    ],
  })

  const roundInfo = detail.data?.[0]
  const player = (detail.data?.[1] as PlayerInfo | undefined) ?? EMPTY_PLAYER
  const prevInfo = prevRound !== undefined ? (detail.data?.[2]) : undefined
  const prevPlayer = prevRound !== undefined ? ((detail.data?.[3] as PlayerInfo | undefined) ?? EMPTY_PLAYER) : EMPTY_PLAYER
  const balance = detail.data?.[4]
  const allowance = detail.data?.[5]

  const prev = useMemo(() => {
    if (!prevInfo || prevRound === undefined || !grace) return null
    const n = BigInt(now)
    const isWinner = !!address && prevInfo.topPlayer.toLowerCase() === address.toLowerCase()
    const hasWinner = prevInfo.topPlayer !== ZERO
    const claimable = isWinner && !prevInfo.claimed && n >= prevInfo.deadline && n < prevInfo.deadline + grace
    const refundable =
      prevPlayer.entered && !prevPlayer.refunded && !prevInfo.claimed && n >= prevInfo.deadline && (!hasWinner || n >= prevInfo.deadline + grace)
    return { round: prevRound, info: prevInfo, player: prevPlayer, claimable, refundable, settling: n < prevInfo.deadline }
  }, [prevInfo, prevRound, prevPlayer, grace, now, address])

  const secondsLeft = roundInfo ? Math.max(0, Number(roundInfo.endsAt) - now) : 0
  const wrongChain = isConnected && chainId !== ARENA_CHAIN_ID
  const needsApproval = entryFee !== undefined && (allowance ?? 0n) < entryFee
  const refresh = useCallback(() => {
    void head.refetch()
    void detail.refetch()
  }, [head, detail])

  const run = useCallback(
    async (action: ArenaAction, fn: () => Promise<`0x${string}`>, success: string) => {
      if (!client) return false
      setBusy(action)
      try {
        if (chainId !== ARENA_CHAIN_ID) await switchChainAsync({ chainId: ARENA_CHAIN_ID })
        const hash = await fn()
        setLastTx(hash)
        const receipt = await client.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('reverted')
        toast.success(success)
        refresh()
        return true
      } catch (err) {
        const msg = parseOnchainError(err)
        if (msg !== 'Transaction cancelled.') toast.error(msg)
        return false
      } finally {
        setBusy(null)
      }
    },
    [client, chainId, switchChainAsync, refresh],
  )

  const approve = useCallback(
    () =>
      entryFee === undefined || !ARENA_ADDRESS
        ? Promise.resolve(false)
        : run('approve', () => writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, chainId: ARENA_CHAIN_ID, functionName: 'approve', args: [base.address, entryFee] }), 'USDC approved'),
    [entryFee, run, writeContractAsync],
  )
  const enter = useCallback(
    () => run('enter', () => writeContractAsync({ ...base, functionName: 'enter' }), 'You are in. Good luck.'),
    [run, writeContractAsync],
  )
  const claim = useCallback(
    (r: bigint) => run('claim', () => writeContractAsync({ ...base, functionName: 'claim', args: [r] }), 'Pot claimed'),
    [run, writeContractAsync],
  )
  const refund = useCallback(
    (r: bigint) => run('refund', () => writeContractAsync({ ...base, functionName: 'refund', args: [r] }), 'Entry refunded'),
    [run, writeContractAsync],
  )
  const submitScore = useCallback(
    (r: bigint, score: number, signature: `0x${string}`) =>
      run('submit', () => writeContractAsync({ ...base, functionName: 'submitScore', args: [r, score, signature] }), 'Score locked in onchain'),
    [run, writeContractAsync],
  )

  return {
    configured: !!ARENA_ADDRESS,
    address,
    isConnected,
    wrongChain,
    round,
    entryFee,
    roundInfo,
    player,
    prev,
    balance,
    needsApproval,
    secondsLeft,
    busy,
    lastTx,
    loading: head.isLoading || detail.isLoading,
    approve,
    enter,
    claim,
    refund,
    submitScore,
    refresh,
  }
}

export type Arena = ReturnType<typeof useArena>
