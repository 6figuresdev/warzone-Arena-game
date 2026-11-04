import type { RunTelemetry } from '@/game/types'

export interface SessionInfo {
  sessionId: string
  round: string
}

export interface Attestation {
  round: string
  score: number
  signature: `0x${string}`
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('The referee service is unreachable. Try again in a moment.')
  }
  const data = (await res.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!data) {
    throw new Error('Ranked rounds need the referee service, which is not running for this site. Free practice and the campaign work without it.')
  }
  if (!res.ok) throw new Error(data.error ?? 'The referee rejected that request.')
  return data
}

export const startSession = (player: string) => post<SessionInfo>('/session', { player })

export const requestAttestation = (sessionId: string, telemetry: RunTelemetry) =>
  post<Attestation>('/score', { sessionId, telemetry })
