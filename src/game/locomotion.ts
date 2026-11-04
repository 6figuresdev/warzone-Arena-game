/**
 * Decides how a soldier's body should turn and which way the leg animation plays,
 * so strafing and backpedalling look natural instead of running forward while sliding.
 */
export interface Loco {
  /** Body yaw relative to the aim direction, in radians (positive turns left). */
  offset: number
  /** 1 plays the run or walk forward, -1 plays it in reverse for backpedalling. */
  dir: number
}

const FORWARD = { offset: 0, dir: 1 } satisfies Loco

/**
 * @param mx movement direction x (any length)
 * @param mz movement direction z (any length)
 * @param speed movement speed in metres per second
 * @param facing aim yaw in model convention (forward is sin, cos)
 */
export function locomotion(mx: number, mz: number, speed: number, facing: number): Loco {
  if (speed < 0.8) return FORWARD
  const len = Math.hypot(mx, mz)
  if (len < 1e-4) return FORWARD
  const dx = mx / len
  const dz = mz / len
  const fw = dx * Math.sin(facing) + dz * Math.cos(facing)
  const rg = dx * -Math.cos(facing) + dz * Math.sin(facing)
  const a = Math.atan2(rg, fw)
  if (Math.abs(a) <= 1.75) {
    // Forward and strafing: turn the hips toward the travel direction.
    return { offset: Math.max(-0.95, Math.min(0.95, -a)), dir: 1 }
  }
  // Backpedalling: keep facing the threat and play the stride backwards.
  const b = a > 0 ? a - Math.PI : a + Math.PI
  return { offset: Math.max(-0.6, Math.min(0.6, -b)), dir: -1 }
}
