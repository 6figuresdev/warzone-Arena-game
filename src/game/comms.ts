export interface RadioLine {
  id: number
  who: string
  text: string
  until: number
}

export type Speaker = 'GHOST' | 'VIPER' | 'COMMAND'

const VOICE: Record<Speaker, { pitch: number; rate: number }> = {
  GHOST: { pitch: 0.7, rate: 1.08 },
  VIPER: { pitch: 1.35, rate: 1.12 },
  COMMAND: { pitch: 1, rate: 0.95 },
}

/** Squad radio. Shows subtitles and speaks lines with the browser's speech synthesis when available. */
export class Comms {
  private lines: RadioLine[] = []
  private nextId = 0
  private lastSaid = new Map<string, number>()
  voice = true
  muted = false

  /** Says a line unless the same key was used within `cooldown` seconds. */
  say(who: Speaker, text: string, key = text, cooldown = 6) {
    const now = performance.now()
    const last = this.lastSaid.get(key) ?? -1e9
    if (now - last < cooldown * 1000) return
    this.lastSaid.set(key, now)
    this.lines.push({ id: this.nextId++, who, text, until: now + 4800 })
    if (this.lines.length > 4) this.lines.shift()
    this.speak(who, text)
  }

  private speak(who: Speaker, text: string) {
    if (!this.voice || this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    if (synth.pending || synth.speaking) {
      // Keep the radio snappy: drop stale chatter instead of queueing it.
      if (synth.pending) synth.cancel()
    }
    const u = new SpeechSynthesisUtterance(text)
    const v = VOICE[who]
    u.pitch = v.pitch
    u.rate = v.rate
    u.volume = 0.9
    u.lang = 'en-US'
    synth.speak(u)
  }

  current() {
    const now = performance.now()
    this.lines = this.lines.filter((l) => l.until > now)
    return this.lines.map(({ id, who, text }) => ({ id, who, text }))
  }

  reset() {
    this.lines = []
    this.lastSaid.clear()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }
}
