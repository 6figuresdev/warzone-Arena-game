import type { MapId } from './maps'
import type { WeaponId } from './types'

export const STAGE_COUNT = 10

export interface StageDef {
  n: number
  name: string
  blurb: string
  /** Stolen funds to recover, in dollars. Stage n is worth n x $500. */
  funds: number
  map: MapId
  waves: number
  /** Seconds before the thieves escape with the money. */
  timeS: number
}

const NAMES = [
  'Corner Store Heist',
  'Armored Van Ambush',
  'Pawn Shop Vault',
  'Harbor Payroll',
  'Container Cache',
  'Dockside Ledger',
  'Desert Courier',
  'Outpost Strongbox',
  'Warlord Treasury',
  'The Syndicate Vault',
]

const BLURBS = [
  'A crew hit a local store and fled with the day takings. Clear them out and bring the cash back.',
  'Thieves ran an armored van off the road. The money case is still somewhere in the wreckage.',
  'A gang cracked a pawn shop vault. They are holed up in the burnt-out blocks.',
  'The harbor payroll never reached the workers. The thieves are digging in at the docks.',
  'Stolen funds were stashed inside the container yard. Expect ambushes between the stacks.',
  'A dockside ledger ring is moving cash through the yard. Shut it down and take the money.',
  'A courier crew carrying stolen funds was spotted at the desert fort.',
  'A heavily guarded strongbox sits inside the outpost walls. Armored guards are on watch.',
  'A warlord hoards cash taken from three towns. Everything he has is between you and the vault.',
  'The syndicate behind every theft is defending its vault. Recover the final haul and end it.',
]

const MAPS: MapId[] = ['ashfall', 'ashfall', 'ashfall', 'harbor', 'harbor', 'harbor', 'outpost', 'outpost', 'outpost', 'ashfall']
const WAVES = [2, 2, 3, 3, 3, 4, 4, 4, 5, 5]

export const STAGES: StageDef[] = NAMES.map((name, i) => ({
  n: i + 1,
  name,
  blurb: BLURBS[i],
  funds: (i + 1) * 500,
  map: MAPS[i],
  waves: WAVES[i],
  timeS: 360 + 30 * (i + 1),
}))

export const TOTAL_FUNDS = STAGES.reduce((sum, s) => sum + s.funds, 0)

/** Thieves in one wave of a stage. */
export function stageEnemies(stage: StageDef, wave: number): number {
  return Math.min(30, 4 + 2 * stage.n + 2 * (wave - 1))
}

export interface StageResult {
  stage: number
  outcome: 'cleared' | 'died' | 'timeout'
  funds: number
  kills: number
  squadKills: number
  headshots: number
  durationMs: number
  accuracy: number
  cash: number
  owned: WeaponId[]
}

export interface Loadout {
  cash: number
  owned: WeaponId[]
}

export interface CampaignSave {
  /** Highest stage the player may start. */
  unlocked: number
  cleared: Record<number, { timeMs: number; kills: number }>
  loadout: Loadout | null
}

const KEY = 'arc.campaign.v1'

export function loadCampaign(): CampaignSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as CampaignSave
      if (typeof s.unlocked === 'number' && s.cleared) return { unlocked: Math.min(STAGE_COUNT, Math.max(1, s.unlocked)), cleared: s.cleared, loadout: s.loadout ?? null }
    }
  } catch {
    // fall through to a fresh save
  }
  return { unlocked: 1, cleared: {}, loadout: null }
}

export function saveCampaign(save: CampaignSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    // storage may be unavailable; progress then lasts for this session only
  }
}

/** Folds a finished stage into the save. Only a cleared stage unlocks the next one. */
export function recordResult(save: CampaignSave, r: StageResult): CampaignSave {
  if (r.outcome !== 'cleared') return save
  const prev = save.cleared[r.stage]
  const best = !prev || r.durationMs < prev.timeMs ? { timeMs: r.durationMs, kills: r.kills } : prev
  return {
    unlocked: Math.min(STAGE_COUNT, Math.max(save.unlocked, r.stage + 1)),
    cleared: { ...save.cleared, [r.stage]: best },
    loadout: { cash: r.cash + Math.round(r.funds / 2), owned: r.owned },
  }
}

export function totalRescued(save: CampaignSave): number {
  return STAGES.filter((s) => save.cleared[s.n]).reduce((sum, s) => sum + s.funds, 0)
}
