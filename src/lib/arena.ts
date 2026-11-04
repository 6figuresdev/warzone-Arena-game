import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

export const ARENA_CHAIN_ID = arcTestnet.id

const rawArena = import.meta.env.VITE_ARENA_ADDRESS as string | undefined
export const ARENA_ADDRESS = (rawArena && /^0x[0-9a-fA-F]{40}$/.test(rawArena) ? rawArena : undefined) as `0x${string}` | undefined

const usdcFact = getUsdc(ARENA_CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')
export const USDC_ADDRESS = usdcFact.address as `0x${string}`

export function usdcText(raw: bigint | undefined, digits = 2): string {
  if (raw === undefined) return '0.00'
  return Amount.fromRaw(raw, usdcDecimalsFor(ARENA_CHAIN_ID)).toFixed(digits)
}

export function shortAddress(a?: string): string {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function parseOnchainError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return 'Transaction cancelled.'
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Not enough USDC. Use Get test USDC in the sidebar, then try again.'
  }
  if (message.includes('alreadyentered')) return 'You are already in this round.'
  if (message.includes('submissionclosed')) return 'Scores for that round are closed.'
  if (message.includes('reverted')) return 'The transaction was rejected by the contract.'
  if (message.includes('network') || message.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
