import type { RunTelemetry } from './types'

/** Shared by the browser game and the referee server so both compute the same score. */
export const RUN_TIME_LIMIT_S = 240
export const WAVE_PAUSE_MS = 4000
export const MAX_WAVE = 40
export const MAX_SCORE = 4_000_000_000

export function enemiesInWave(wave: number): number {
  return 6 + 3 * wave
}

export function cumulativeEnemies(wave: number): number {
  let total = 0
  for (let w = 1; w <= wave; w++) total += enemiesInWave(w)
  return total
}

/** Only your own kills score. Squad kills clear waves but earn nothing. */
export function computeScore(t: RunTelemetry): number {
  const waveBonus = Math.max(0, t.wave - 1) * 200
  const survival = Math.floor(t.durationMs / 1000) * 2
  return t.kills * 100 + t.headshots * 50 + waveBonus + survival
}

/** Returns an error string when the telemetry cannot be a real run, otherwise null. */
export function validateTelemetry(t: RunTelemetry, serverElapsedMs: number): string | null {
  const ints = [t.kills, t.squadKills, t.headshots, t.wave, t.durationMs, t.shotsFired, t.shotsHit, t.damageTaken]
  if (ints.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return 'Invalid numbers in run data.'
  const total = t.kills + t.squadKills
  if (t.wave < 1 || t.wave > MAX_WAVE) return 'Wave out of range.'
  if (total > cumulativeEnemies(t.wave)) return 'More kills than enemies spawned.'
  if (total < cumulativeEnemies(t.wave - 1)) return 'Wave reached without clearing earlier waves.'
  if (t.headshots > t.kills) return 'More headshots than kills.'
  if (t.shotsHit > t.shotsFired) return 'More hits than shots.'
  if (t.durationMs > RUN_TIME_LIMIT_S * 1000 + 3000) return 'Run exceeded the time limit.'
  if (t.durationMs < (t.wave - 1) * WAVE_PAUSE_MS + total * 350) return 'Run was too fast to be real.'
  if (serverElapsedMs < t.durationMs - 2500) return 'Run is longer than the session on record.'
  return null
}
