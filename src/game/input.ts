/** Keyboard and mouse input with pointer lock and a steering fallback for embedded previews. */
export class Input {
  keys = new Set<string>()
  private pressedKeys = new Set<string>()
  lookX = 0
  lookY = 0
  fire = false
  ads = false
  wheel = 0
  locked = false
  steering = false
  /** Normalised pointer offset from the canvas centre, used when pointer lock is unavailable. */
  steerX = 0
  steerY = 0
  /** On-screen controls feed these. Analog stick values run from -1 to 1. */
  moveX = 0
  moveY = 0
  virtualSprint = false
  /** -1 turns right, +1 turns left. Set by the on-screen turn buttons. */
  turn = 0
  steerEnabled = true
  private lockTimer: ReturnType<typeof setTimeout> | null = null
  private cleanup: (() => void)[] = []

  constructor(private el: HTMLElement, private onLockChange: (locked: boolean) => void) {
    const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(t, fn as EventListener)
      this.cleanup.push(() => window.removeEventListener(t, fn as EventListener))
    }
    on('keydown', (e) => {
      if (e.code === 'Escape' && this.steering) this.release()
      if (!this.locked) return
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault()
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code)
      this.keys.add(e.code)
    })
    on('keyup', (e) => this.keys.delete(e.code))
    on('blur', () => {
      this.keys.clear()
      this.fire = false
      this.ads = false
    })
    on('mousemove', (e) => {
      if (!this.locked) return
      if (document.pointerLockElement === this.el) {
        this.lookX += e.movementX
        this.lookY += e.movementY
      } else if (this.steering && this.steerEnabled) {
        const r = this.el.getBoundingClientRect()
        this.steerX = ((e.clientX - r.left) / r.width) * 2 - 1
        this.steerY = ((e.clientY - r.top) / r.height) * 2 - 1
      }
    })
    on('mousedown', (e) => {
      if (!this.locked) return
      if ((e.target as Element | null)?.closest?.('[data-touch]')) return
      if (e.button === 0) this.fire = true
      if (e.button === 2) this.ads = true
    })
    on('mouseup', (e) => {
      if (e.button === 0) this.fire = false
      if (e.button === 2) this.ads = false
    })
    on('wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY)
    })
    const ctx = (e: Event) => e.preventDefault()
    this.el.addEventListener('contextmenu', ctx)
    this.cleanup.push(() => this.el.removeEventListener('contextmenu', ctx))

    const lockChange = () => {
      const isLocked = document.pointerLockElement === this.el
      if (isLocked) {
        if (this.lockTimer) clearTimeout(this.lockTimer)
        this.steering = false
        this.setLocked(true)
      } else if (!this.steering) {
        this.setLocked(false)
      }
    }
    const lockError = () => {
      this.steering = true
      this.setLocked(true)
    }
    document.addEventListener('pointerlockchange', lockChange)
    document.addEventListener('pointerlockerror', lockError)
    this.cleanup.push(() => {
      document.removeEventListener('pointerlockchange', lockChange)
      document.removeEventListener('pointerlockerror', lockError)
    })
  }

  private setLocked(v: boolean) {
    if (this.locked === v) return
    this.locked = v
    if (!v) {
      this.keys.clear()
      this.fire = false
      this.ads = false
    }
    this.onLockChange(v)
  }

  /** Grab the mouse. Falls back to pointer-offset steering if the browser refuses. */
  requestLock() {
    this.el.focus()
    if (this.lockTimer) clearTimeout(this.lockTimer)
    // Embedded previews often block pointer lock without raising an error. Fall back to free-cursor play.
    this.lockTimer = setTimeout(() => {
      if (!this.locked) this.enterSteering()
    }, 450)
    try {
      const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => this.enterSteering())
    } catch {
      this.enterSteering()
    }
  }

  private enterSteering() {
    this.steering = true
    this.setLocked(true)
  }

  /** True while the player wants to sprint, from the keyboard or the on-screen button. */
  sprintHeld() {
    const key = (this.down('ShiftLeft') || this.down('ShiftRight')) && (this.down('KeyW') || this.moveY > 0.2)
    return key || (this.virtualSprint && this.moveY > 0.2)
  }

  addLook(dx: number, dy: number) {
    this.lookX += dx
    this.lookY += dy
  }

  /** Presses or releases a key from an on-screen button. */
  hold(code: string, on: boolean) {
    if (on) {
      if (!this.keys.has(code)) this.pressedKeys.add(code)
      this.keys.add(code)
    } else {
      this.keys.delete(code)
    }
  }

  tap(code: string) {
    this.pressedKeys.add(code)
  }

  release() {
    if (this.lockTimer) clearTimeout(this.lockTimer)
    if (document.pointerLockElement === this.el) document.exitPointerLock()
    this.steering = false
    this.setLocked(false)
  }

  down(code: string) {
    return this.keys.has(code)
  }

  /** True once per key press. */
  pressed(code: string) {
    const v = this.pressedKeys.has(code)
    this.pressedKeys.delete(code)
    return v
  }

  consumeLook() {
    const out = { x: this.lookX, y: this.lookY }
    this.lookX = 0
    this.lookY = 0
    return out
  }

  consumeWheel() {
    const w = this.wheel
    this.wheel = 0
    return w
  }

  dispose() {
    for (const c of this.cleanup) c()
    this.cleanup = []
  }
}
