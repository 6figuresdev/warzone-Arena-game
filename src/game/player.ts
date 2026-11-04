import { ARENA, PLAYER } from './config'
import { groundHeight, resolveCircle, type Box } from './collision'
import type { Input } from './input'

export class Player {
  x = 0
  z = 0
  y = 0
  vy = 0
  yaw = 0
  pitch = 0
  health = PLAYER.maxHealth
  speed = 0
  onGround = true
  lastDamage = -100
  private vx = 0
  private vz = 0
  private stepT = 0
  bobPhase = 0
  sens = 1
  justLanded = 0
  private turnT = 0
  private uturn = 0
  moveX = 0
  moveZ = 0
  private stepNow = false
  crouchT = 0

  reset(x: number, z: number) {
    this.x = x
    this.z = z
    this.y = 0
    this.vy = 0
    this.yaw = 0
    this.pitch = 0
    this.health = PLAYER.maxHealth
    this.vx = this.vz = 0
    this.lastDamage = -100
    this.crouchT = 0
  }

  get eyeY() {
    return this.y + PLAYER.eye - this.crouchT * 0.6
  }

  get alive() {
    return this.health > 0
  }

  /** Returns true when a footstep should play. */
  update(dt: number, input: Input, boxes: Box[], ads: boolean, now: number, onJump: () => void): boolean {
    const look = input.consumeLook()
    const sens = (ads ? 0.0014 : 0.0029) * this.sens
    this.yaw -= look.x * sens
    this.pitch -= look.y * sens
    if (input.steering) {
      const dz = 0.12
      const sx = Math.abs(input.steerX) > dz ? input.steerX - Math.sign(input.steerX) * dz : 0
      const sy = Math.abs(input.steerY) > dz ? input.steerY - Math.sign(input.steerY) * dz : 0
      this.yaw -= sx * 4.8 * dt
      this.pitch -= sy * 2.6 * dt
    }
    // Turn buttons and arrow keys: quick from the start, faster the longer they are held.
    const turn = Math.max(-1, Math.min(1, (input.down('ArrowLeft') ? 1 : 0) - (input.down('ArrowRight') ? 1 : 0) + input.turn))
    const tilt = (input.down('ArrowUp') ? 1 : 0) - (input.down('ArrowDown') ? 1 : 0)
    this.turnT = turn !== 0 ? Math.min(1, this.turnT + dt * 1.3) : 0
    this.yaw += turn * (2.6 + 2.6 * this.turnT) * dt
    this.pitch += tilt * 2.2 * dt
    if (input.pressed('KeyX') && this.uturn === 0) this.uturn = Math.PI
    if (this.uturn > 0) {
      const step = Math.min(this.uturn, 11 * dt)
      this.yaw += step
      this.uturn -= step
    }
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch))

    const dead = 0.1
    const stickY = Math.abs(input.moveY) < dead ? 0 : input.moveY
    const stickX = Math.abs(input.moveX) < dead ? 0 : input.moveX
    const fwd = Math.max(-1, Math.min(1, (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0) + stickY))
    const side = Math.max(-1, Math.min(1, (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0) + stickX))
    const wantCrouch = input.down('KeyC') || input.down('ControlLeft')
    this.crouchT += ((wantCrouch ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10)
    const sprinting = input.sprintHeld() && fwd > 0 && !ads && !wantCrouch
    let target = sprinting ? PLAYER.sprint : PLAYER.walk
    if (ads) target *= PLAYER.adsMult
    target *= 1 - this.crouchT * 0.45
    const len = Math.max(1, Math.hypot(fwd, side))
    // Backpedalling is slower, like a real soldier covering ground while facing a threat.
    target *= 1 - 0.32 * (Math.max(0, -fwd) / len)
    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    // Analog stick magnitude scales speed, keys are always full speed.
    const mag = Math.min(1, Math.hypot(fwd, side))
    const wx = ((-sin * fwd + cos * side) / len) * mag
    const wz = ((-cos * fwd - sin * side) / len) * mag
    const wantsMove = mag > 0.01
    const jumpHeld = input.down('Space')

    // Fixed small steps keep collisions solid and movement smooth on slow frames.
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)))
    const h = dt / steps
    this.justLanded = 0
    for (let i = 0; i < steps; i++) {
      const accel = this.onGround ? (wantsMove ? 16 : 22) : 2.5
      const k = Math.min(1, accel * h)
      this.vx += (wx * target - this.vx) * k
      this.vz += (wz * target - this.vz) * k

      if (jumpHeld && this.onGround) {
        this.vy = PLAYER.jump
        this.onGround = false
        onJump()
      }
      const wasAir = !this.onGround
      const fallSpeed = this.vy
      this.vy -= PLAYER.gravity * h
      this.y += this.vy * h

      const pos = { x: this.x + this.vx * h, z: this.z + this.vz * h }
      resolveCircle(pos, PLAYER.radius, this.y, boxes, ARENA.half)
      resolveCircle(pos, PLAYER.radius, this.y, boxes, ARENA.half)
      this.x = pos.x
      this.z = pos.z

      const ground = groundHeight(this.x, this.z, PLAYER.radius, this.y, boxes)
      if (this.y <= ground) {
        this.y = ground
        if (wasAir && fallSpeed < -5) this.justLanded = Math.min(1, -fallSpeed / 12)
        this.vy = 0
        this.onGround = true
      } else if (this.y > ground + 0.05) {
        this.onGround = false
      }
    }

    this.speed = Math.hypot(this.vx, this.vz)
    this.moveX = this.vx
    this.moveZ = this.vz
    if (this.onGround && this.speed > 1) {
      this.bobPhase += dt * this.speed * 1.5
      this.stepT -= dt * this.speed
      if (this.stepT <= 0) {
        this.stepT = sprinting ? 3.4 : 2.6
        this.stepNow = true
      }
    }
    const step = this.stepNow
    this.stepNow = false

    if (now - this.lastDamage > PLAYER.regenDelay && this.health < PLAYER.maxHealth && this.alive) {
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenRate * dt)
    }
    return step
  }

  damage(amount: number, now: number) {
    this.health = Math.max(0, this.health - amount)
    this.lastDamage = now
  }

  heal(amount: number) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount)
  }
}
