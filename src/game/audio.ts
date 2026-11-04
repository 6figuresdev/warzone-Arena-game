import type { WeaponId } from './types'

/** Procedural sound effects. No audio files, everything is synthesized with the Web Audio API. */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  muted = false

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private ambient: { src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null
  private ambientTimer: ReturnType<typeof setTimeout> | null = null

  /** Wind bed plus the occasional far-off burst of gunfire. */
  startAmbient() {
    if (!this.ctx || !this.master || !this.noise || this.ambient) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 340
    f.Q.value = 0.6
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.12
    const lg = this.ctx.createGain()
    lg.gain.value = 150
    lfo.connect(lg).connect(f.frequency)
    const g = this.ctx.createGain()
    g.gain.value = 0.06
    src.connect(f).connect(g).connect(this.master)
    src.start()
    lfo.start()
    this.ambient = { src, lfo }
    const tick = () => {
      const n = 2 + Math.floor(Math.random() * 5)
      for (let i = 0; i < n; i++) setTimeout(() => this.burst(0.22, 700, 0.6, 0.05 + Math.random() * 0.04, 'lowpass', 160), i * (90 + Math.random() * 60))
      this.ambientTimer = setTimeout(tick, 5000 + Math.random() * 9000)
    }
    this.ambientTimer = setTimeout(tick, 4000)
  }

  stopAmbient() {
    if (this.ambientTimer) clearTimeout(this.ambientTimer)
    this.ambientTimer = null
    if (this.ambient) {
      this.ambient.src.stop()
      this.ambient.lfo.stop()
      this.ambient = null
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.5
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'lowpass', sweepTo?: number) {
    if (!this.ctx || !this.master || !this.noise) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  shot(id: WeaponId) {
    if (id === 'ar') {
      this.burst(0.14, 3200, 0.8, 0.7, 'lowpass', 400)
      this.tone(140, 0.09, 0.5, 'square', 50)
    } else if (id === 'smg') {
      this.burst(0.09, 4200, 0.8, 0.55, 'lowpass', 700)
      this.tone(190, 0.06, 0.4, 'square', 80)
    } else if (id === 'lmg') {
      this.burst(0.2, 2600, 0.7, 0.9, 'lowpass', 260)
      this.tone(100, 0.14, 0.7, 'sawtooth', 40)
    } else if (id === 'pistol') {
      this.burst(0.12, 3800, 0.8, 0.6, 'lowpass', 600)
      this.tone(210, 0.08, 0.4, 'square', 90)
    } else if (id === 'shotgun') {
      this.burst(0.4, 2200, 0.6, 1, 'lowpass', 160)
      this.tone(90, 0.25, 0.7, 'sawtooth', 35)
    } else {
      this.burst(0.7, 4200, 0.5, 1, 'lowpass', 120)
      this.tone(70, 0.5, 0.8, 'sawtooth', 28)
    }
  }

  allyShot() {
    this.burst(0.08, 2800, 0.8, 0.14, 'lowpass', 500)
  }

  buy() {
    this.tone(1320, 0.05, 0.25, 'square')
    setTimeout(() => this.tone(1760, 0.1, 0.25, 'square'), 60)
  }

  deny() {
    this.tone(160, 0.14, 0.3, 'sawtooth', 90)
  }

  enemyShot(dist: number) {
    const vol = Math.max(0.05, 0.4 - dist / 120)
    this.burst(0.1, 2400, 0.8, vol, 'lowpass', 500)
  }

  reload() {
    this.tone(520, 0.05, 0.25, 'square')
    setTimeout(() => this.tone(340, 0.07, 0.3, 'square'), 520)
    setTimeout(() => this.tone(700, 0.04, 0.3, 'square'), 1250)
  }

  pump() {
    this.tone(260, 0.06, 0.3, 'square')
    setTimeout(() => this.tone(190, 0.08, 0.3, 'square'), 140)
  }

  empty() {
    this.tone(1200, 0.03, 0.2, 'square')
  }

  hit(head: boolean) {
    this.tone(head ? 1650 : 900, head ? 0.14 : 0.07, 0.35, 'triangle')
  }

  kill() {
    this.tone(480, 0.2, 0.3, 'triangle', 960)
  }

  hurt() {
    this.burst(0.18, 600, 1, 0.5, 'lowpass', 150)
    this.tone(120, 0.18, 0.4, 'sine', 60)
  }

  explosion() {
    this.burst(1.1, 1400, 0.5, 1.2, 'lowpass', 60)
    this.tone(55, 0.9, 1, 'sine', 25)
  }

  pickup() {
    this.tone(660, 0.08, 0.3, 'triangle')
    setTimeout(() => this.tone(990, 0.12, 0.3, 'triangle'), 80)
  }

  wave() {
    this.tone(220, 0.5, 0.35, 'sawtooth', 440)
    setTimeout(() => this.tone(330, 0.6, 0.35, 'sawtooth', 660), 220)
  }

  jump() {
    this.burst(0.08, 500, 1, 0.12, 'bandpass')
  }

  step() {
    this.burst(0.05, 380, 1, 0.1, 'lowpass')
  }
}
