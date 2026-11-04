import * as THREE from 'three'
import { ALLY, ARENA, BASE_FOV, ECONOMY, GRENADE, PLAYER, SHOP_WEAPONS, SUPPLY_ITEMS, WEAPON_ORDER, pickEnemyKind } from './config'
import { worldRay, lineOfSight, faceNormal } from './collision'
import { Sfx } from './audio'
import { Input } from './input'
import { Player } from './player'
import { Arsenal } from './weapons'
import { ViewMotion } from './viewmodel'
import { loadCharacters } from './characters'
import { Effects } from './effects'
import { Enemy, type EnemyShot } from './enemies'
import { Ally } from './allies'
import { STAGES, stageEnemies, type Loadout, type StageDef, type StageResult } from './campaign'
import { Objective } from './objective'
import { Grenades, Pickups, type PickupKind } from './items'
import { buildWorld, registerRenderer, type World } from './world'
import { Comms } from './comms'
import { PlayerModel } from './playerModel'
import type { MapId } from './maps'
import { RUN_TIME_LIMIT_S, WAVE_PAUSE_MS, computeScore, enemiesInWave } from './scoring'
import type { FeedItem, GamePhase, HudState, ObjectiveHud, RadarBlip, RunTelemetry, ShopItemId } from './types'

export interface EngineEvents {
  onHud: (s: HudState) => void
  onEnd: (t: RunTelemetry, score: number) => void
  onStage: (r: StageResult) => void
}

/** Add ?lowfx to the URL to turn off antialiasing and shadows on weak machines. */
const LOW_FX = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lowfx')
const SECURE_TIME = 2.5
const RADAR_RANGE = 32
const UAV_RANGE = 90
const CALLSIGNS = ['GHOST', 'VIPER']

export class GameEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 600)
  private world: World
  private player = new Player()
  private input: Input
  private arsenal = new Arsenal()
  private viewmodel: ViewMotion
  private assets: Promise<void>
  private prevYaw = 0
  private prevPitch = 0
  private effects: Effects
  private pickups: Pickups
  private grenadesSys: Grenades
  private sfx = new Sfx()
  private enemies: Enemy[] = []
  private allies: Ally[] = []
  private raf = 0
  private last = 0
  private ro: ResizeObserver
  phase: GamePhase = 'idle'

  private sim = 0
  private wave = 0
  private queue = 0
  private spawnT = 0
  private pauseT = 0
  private clearedWave = false
  private kills = 0
  private squadKills = 0
  private cash = 0
  private armor = 0
  private shopOpen = false
  private heads = 0
  private streak = 0
  private lastKillAt = -10
  private shotsFired = 0
  private shotsHit = 0
  private dmgTaken = 0
  private grenades = 2
  private recoil = 0
  private shake = 0
  private fireHeld = false
  private ads = false
  private fov = BASE_FOV
  private hitAt = 0
  private hitHead = false
  private dmgAt = 0
  private dmgAngle = 0
  private banner: string | null = null
  private bannerUntil = 0
  private feed: (FeedItem & { until: number })[] = []
  private feedId = 0
  private hudT = 0
  private frozen = false
  private stage: StageDef | null = null
  private pendingStage: StageDef | null = null
  private pendingLoadout: Loadout | null = null
  private stageWave = 0
  private timeLimit = RUN_TIME_LIMIT_S
  private objective: Objective | null = null
  private securing = 0
  private ambushDone = false
  private mapOpen = false
  private mapCloseT = 0
  private landDip = 0
  private frameMs = 16
  private qualityT = 0
  private maxRatio = 1.5
  private ratio = 1.5
  private comms = new Comms()
  private playerModel: PlayerModel
  private viewMode: 'tps' | 'fps' = 'fps'
  private tpsActive = false
  private squadHold = false
  private uavT = 0
  private exposure = 1.1

  constructor(private canvas: HTMLCanvasElement, private events: EngineEvents) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_FX, powerPreference: 'high-performance' })
    this.maxRatio = Math.min(window.devicePixelRatio, 1.5)
    this.ratio = this.maxRatio
    this.renderer.setPixelRatio(this.ratio)
    this.renderer.shadowMap.enabled = !LOW_FX
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    registerRenderer(this.renderer)
    this.world = buildWorld(this.scene, 'ashfall')
    this.renderer.toneMappingExposure = this.world.map.theme.exposure
    this.scene.add(this.camera)
    this.viewmodel = new ViewMotion()
    this.assets = loadCharacters().catch((err) => {
      console.error('Could not load character models', err)
    })
    this.playerModel = new PlayerModel(this.scene)
    this.effects = new Effects(this.scene)
    this.pickups = new Pickups(this.scene)
    this.grenadesSys = new Grenades(this.scene)
    canvas.tabIndex = 0
    canvas.style.outline = 'none'
    this.input = new Input(canvas, (locked) => {
      if (!locked) this.fireHeld = false
      this.emitHud(true)
    })
    this.player.reset(this.world.playerStart.x, this.world.playerStart.z)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.syncCamera(0)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Must be called from a click handler so the browser allows pointer lock and audio. */
  begin(mapId?: MapId) {
    this.sfx.unlock()
    this.pendingStage = null
    this.pendingLoadout = null
    if (mapId) this.setMap(mapId)
    this.input.requestLock()
    void this.assets.then(() => {
      this.resetRun()
      this.sfx.startAmbient()
    })
  }

  /** Starts a campaign stage. Must be called from a click handler. */
  beginStage(n: number, loadout: Loadout | null) {
    const def = STAGES[n - 1]
    if (!def) return
    this.sfx.unlock()
    this.pendingStage = def
    this.pendingLoadout = loadout
    this.setMap(def.map)
    this.input.requestLock()
    void this.assets.then(() => {
      this.resetRun()
      this.sfx.startAmbient()
    })
  }

  resume() {
    this.shopOpen = false
    this.sfx.unlock()
    this.input.requestLock()
  }

  setSensitivity(v: number) {
    this.player.sens = v
  }

  /** Controls for on-screen buttons and touch screens. */
  touchApi() {
    const inp = this.input
    return {
      setActive: (on: boolean) => {
        inp.steerEnabled = !on
      },
      move: (x: number, y: number) => {
        inp.moveX = x
        inp.moveY = y
      },
      look: (dx: number, dy: number) => inp.addLook(dx, dy),
      turn: (dir: number) => {
        inp.turn = dir
      },
      fire: (on: boolean) => {
        inp.fire = on
      },
      ads: (on: boolean) => {
        inp.ads = on
      },
      sprint: (on: boolean) => {
        inp.virtualSprint = on
      },
      hold: (code: string, on: boolean) => inp.hold(code, on),
      tap: (code: string) => inp.tap(code),
    }
  }

  setMuted(m: boolean) {
    this.sfx.setMuted(m)
    this.comms.muted = m
  }

  /** Swaps the battlefield. Only valid outside an active run. */
  setMap(id: MapId) {
    if (this.world.map.id === id || this.phase === 'playing') return
    this.world.dispose()
    this.world = buildWorld(this.scene, id)
    this.renderer.toneMappingExposure = this.world.map.theme.exposure
    this.player.reset(this.world.playerStart.x, this.world.playerStart.z)
    this.syncCamera(0)
  }

  private resetRun() {
    for (const e of this.enemies) e.dispose()
    this.enemies = []
    for (const a of this.allies) a.dispose()
    this.allies = []
    this.pickups.clear()
    this.grenadesSys.clear()
    this.effects.clear()
    this.objective?.dispose()
    this.objective = null
    this.securing = 0
    this.ambushDone = false
    this.stage = this.pendingStage
    this.mapOpen = false
    this.stageWave = 0
    this.timeLimit = this.stage ? this.stage.timeS : RUN_TIME_LIMIT_S
    this.arsenal = new Arsenal()
    const kit = this.stage ? this.pendingLoadout : null
    if (kit) for (const id of kit.owned) this.arsenal.grant(id)
    this.viewmodel.setWeapon('ar')
    this.playerModel.setGun('ar')
    this.comms.reset()
    this.squadHold = false
    this.uavT = 0
    this.player.reset(this.world.playerStart.x, this.world.playerStart.z)
    this.sim = 0
    this.kills = this.heads = this.streak = this.squadKills = 0
    this.cash = this.stage && this.pendingLoadout ? this.pendingLoadout.cash : ECONOMY.startCash
    this.armor = 0
    this.shopOpen = false
    for (let i = 0; i < ALLY.count; i++) {
      const a = new Ally(i, CALLSIGNS[i] ?? `ALPHA${i}`, this.world.playerStart.x + (i === 0 ? -3 : 3), this.world.playerStart.z + 2.5)
      this.scene.add(a.group)
      this.allies.push(a)
    }
    this.shotsFired = this.shotsHit = this.dmgTaken = 0
    this.grenades = GRENADE.start
    this.recoil = this.shake = 0
    this.feed = []
    this.phase = 'playing'
    this.wave = 0
    this.startWave(1)
    if (this.stage) {
      this.comms.say('COMMAND', `Stage ${this.stage.n}. ${this.stage.name}. Thieves took $${this.stage.funds.toLocaleString()}. Take it back.`, 'start', 1)
      this.pushFeed(`STAGE ${this.stage.n}  RECOVER $${this.stage.funds.toLocaleString()}`, 'info')
    } else {
      this.comms.say('COMMAND', 'Squad, hold the line. Hostiles are closing in.', 'start', 1)
    }
  }

  private startWave(n: number) {
    if (this.stage) {
      this.stageWave = n
      // Enemy strength follows the stage and how far into it you are.
      this.wave = this.stage.n + n - 1
      this.queue = stageEnemies(this.stage, n)
    } else {
      this.wave = n
      this.queue = enemiesInWave(n)
    }
    this.spawnT = 1.5
    this.clearedWave = false
    this.showBanner(this.stage ? `WAVE ${n} OF ${this.stage.waves}` : `WAVE ${n}`, 2.6)
    this.sfx.wave()
    if (n > 1) this.comms.say('COMMAND', this.wave >= 3 ? `Wave ${n} inbound. Armored units in the mix.` : `Wave ${n} inbound. Stay sharp.`, 'wave', 2)
  }

  private showBanner(text: string, secs: number) {
    this.banner = text
    this.bannerUntil = performance.now() + secs * 1000
  }

  private pushFeed(text: string, tone: FeedItem['tone']) {
    this.feed.push({ id: this.feedId++, text, tone, until: performance.now() + 3200 })
    if (this.feed.length > 5) this.feed.shift()
  }

  private frame = (t: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const raw = (t - this.last) / 1000
    const dt = Math.min(0.05, raw)
    this.last = t
    this.adaptQuality(raw)
    this.world.update(dt)
    if (this.phase === 'playing' && this.input.locked && !this.frozen) this.step(dt)
    else {
      if (this.phase !== 'playing') {
        this.player.yaw += dt * 0.06
        this.syncCamera(dt)
      }
      this.viewmodel.update(dt, 0, 0, false, 0, false)
      if (this.phase !== 'playing') this.playerModel.hide()
    }
    this.effects.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.hudT -= dt
    if (this.hudT <= 0) this.emitHud(false)
  }

  /** Keeps the frame rate smooth by trading render resolution against load. */
  private adaptQuality(raw: number) {
    if (this.phase !== 'playing' || !this.input.locked) return
    this.frameMs += (raw * 1000 - this.frameMs) * 0.06
    this.qualityT += raw
    if (this.qualityT < 1.5) return
    this.qualityT = 0
    let next = this.ratio
    if (this.frameMs > 24 && this.ratio > 0.7) next = Math.max(0.7, this.ratio - 0.15)
    else if (this.frameMs < 15 && this.ratio < this.maxRatio) next = Math.min(this.maxRatio, this.ratio + 0.1)
    if (next !== this.ratio) {
      this.ratio = next
      this.renderer.setPixelRatio(next)
      this.resize()
    }
  }

  private step(dt: number) {
    this.sim += dt
    const inp = this.input
    const p = this.player
    const sprinting = inp.sprintHeld() && !this.ads
    this.ads = inp.ads && this.arsenal.cur.reloadLeft <= 0 && !sprinting
    if (p.update(dt, inp, this.world.boxes, this.ads, this.sim, () => this.sfx.jump())) this.sfx.step()
    if (p.justLanded > 0) {
      this.shake = Math.min(1, this.shake + p.justLanded * 0.5)
      this.sfx.step()
      this.landDip = p.justLanded
    }

    this.handleWeaponKeys()
    this.handleSquadKeys()
    this.arsenal.update(dt, {
      onReloadDone: () => this.sfx.pickup(),
      onPump: () => this.sfx.pump(),
    })
    this.handleFire()
    if (inp.pressed('KeyG') && this.grenades > 0) this.throwGrenade()

    this.recoil = Math.max(0, this.recoil - dt * (4 + this.recoil * 6))
    this.shake = Math.max(0, this.shake - dt * 2.5)
    this.syncCamera(dt)
    this.viewmodel.look(p.yaw - this.prevYaw, p.pitch - this.prevPitch)
    this.prevYaw = p.yaw
    this.prevPitch = p.pitch
    const sprintNow = p.speed > PLAYER.walk + 1.5 && !this.ads
    this.viewmodel.update(dt, p.speed, p.bobPhase, this.ads, this.arsenal.reloadProgress(), sprintNow)
    const scoped = this.ads && this.arsenal.current === 'sniper' && !this.tpsActive
    this.playerModel.update(dt, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch + this.recoil, speed: p.speed, crouch: p.crouchT, vx: p.moveX, vz: p.moveZ }, !this.tpsActive, this.camera, this.viewmodel, p.onGround, !scoped)
    this.uavT = Math.max(0, this.uavT - dt)

    this.updateEnemies(dt)
    this.updateAllies(dt)
    this.directWaves(dt)
    this.pickups.update(dt, p.x, p.z, (k) => this.collect(k))
    this.grenadesSys.update(dt, this.world.boxes, (pos) => this.explode(pos))

    if (this.sim - this.lastKillAt > 4) this.streak = 0
    if (this.mapCloseT > 0) {
      this.mapCloseT -= dt
      if (this.mapCloseT <= 0) this.mapOpen = false
    }
    this.updateObjective(dt)
    if (this.phase !== 'playing') return
    if (!p.alive) {
      if (this.stage) this.finishStage('died')
      else this.endRun(true)
    } else if (this.sim >= this.timeLimit) {
      if (this.stage) this.finishStage('timeout')
      else this.endRun(false)
    }
  }

  private handleWeaponKeys() {
    const inp = this.input
    WEAPON_ORDER.forEach((id, i) => {
      if (inp.pressed(`Digit${i + 1}`) && this.arsenal.switchTo(id)) this.onSwitched()
    })
    if (inp.pressed('KeyB')) this.openShop()
    if (inp.pressed('KeyQ') && this.arsenal.cycle(1)) this.onSwitched()
    const w = inp.consumeWheel()
    if (w !== 0 && this.arsenal.cycle(w > 0 ? 1 : -1)) this.onSwitched()
    if (inp.pressed('KeyR') && this.arsenal.startReload()) this.sfx.reload()
  }

  private handleSquadKeys() {
    const inp = this.input
    if (inp.pressed('KeyM')) {
      this.mapOpen = !this.mapOpen
      this.mapCloseT = 0
    }
    if (inp.pressed('KeyV')) this.viewMode = this.viewMode === 'tps' ? 'fps' : 'tps'
    if (inp.pressed('KeyT')) {
      this.squadHold = !this.squadHold
      for (const a of this.allies) {
        a.holdX = a.x
        a.holdZ = a.z
      }
      this.comms.say(this.squadHold ? 'GHOST' : 'VIPER', this.squadHold ? 'Copy, holding this position.' : 'Moving up, on your six.', 'cmd', 0.5)
    }
  }

  private onSwitched() {
    this.viewmodel.setWeapon(this.arsenal.current)
    this.playerModel.setGun(this.arsenal.current)
    this.sfx.pump()
  }

  private handleFire() {
    const w = this.arsenal.cur
    const pull = this.input.fire && (w.def.auto || !this.fireHeld)
    this.fireHeld = this.input.fire
    if (!pull) return
    if (w.mag === 0 && w.reloadLeft <= 0) {
      if (this.arsenal.startReload()) this.sfx.reload()
      else if (w.cooldown <= 0) {
        w.cooldown = 0.3
        this.sfx.empty()
      }
      return
    }
    if (!this.arsenal.canFire()) return
    this.arsenal.fire()
    this.fireWeapon()
  }

  private fireWeapon() {
    const def = this.arsenal.cur.def
    const cam = this.camera
    cam.updateMatrixWorld()
    const origin = cam.getWorldPosition(new THREE.Vector3())
    const fwd = cam.getWorldDirection(new THREE.Vector3())
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    const move = Math.min(1, this.player.speed / 8) * (def.id === 'sniper' ? 0.06 : 0.012)
    const air = this.player.onGround ? 0 : def.id === 'sniper' ? 0.08 : 0.03
    const spread = (this.ads ? def.adsSpread : def.spread) + (this.ads ? 0 : move) + air
    const muzzle = this.playerModel.muzzleWorld(new THREE.Vector3()) ?? cam.localToWorld(new THREE.Vector3(0.2, -0.13, -0.9))
    this.playerModel.flash()
    if (def.pellets === 1 || def.id === 'shotgun') this.effects.casing(muzzle.clone().addScaledVector(fwd, -0.55).addScaledVector(right, 0.12), right, up)
    let anyHit = false
    this.shotsFired++
    this.sfx.shot(def.id)
    this.viewmodel.fire(def.id)
    this.recoil += def.recoil
    this.player.pitch += def.recoil * 0.3
    this.player.yaw += (Math.random() - 0.5) * def.recoil * 0.4
    this.shake = Math.min(1, this.shake + def.recoil * 3)

    for (let i = 0; i < def.pellets; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * spread
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize()
      const wall = worldRay(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, this.world.boxes, def.range)
      let best: { e: Enemy; dist: number; head: boolean } | null = null
      for (const e of this.enemies) {
        const h = e.hitTest(origin, dir, wall)
        if (h && (!best || h.dist < best.dist)) best = { e, dist: h.dist, head: h.head }
      }
      const endDist = best ? best.dist : wall
      const end = origin.clone().addScaledVector(dir, endDist)
      if (def.pellets === 1 || i < 3) this.effects.tracer(muzzle, end, 0xffe2a8, def.id === 'sniper' ? 0.12 : 0.05)
      if (!best) {
        if (wall < def.range) {
          this.effects.sparks(end)
          const nrm = faceNormal(end.x, end.y, end.z, this.world.boxes)
          this.effects.decal(end, new THREE.Vector3(nrm[0], nrm[1], nrm[2]))
        }
        continue
      }
      anyHit = true
      const falloff = def.id === 'shotgun' ? Math.max(0.25, 1 - best.dist / def.range) : def.id === 'ar' ? Math.max(0.55, 1 - best.dist / 220) : 1
      const dmg = def.damage * falloff * (best.head ? 2.5 : 1)
      this.effects.blood(end, best.head)
      this.hitEnemy(best.e, dmg, best.head)
    }
    if (anyHit) this.shotsHit++
  }

  private hitEnemy(e: Enemy, dmg: number, head: boolean) {
    this.hitAt = performance.now()
    this.hitHead = head
    this.sfx.hit(head)
    if (e.damage(dmg)) this.onKill(e, head)
  }

  private onKill(e: Enemy, head: boolean) {
    this.kills++
    if (head) this.heads++
    this.streak = this.sim - this.lastKillAt < 4 ? this.streak + 1 : 1
    this.lastKillAt = this.sim
    this.sfx.kill()
    const name = e.def.kind.toUpperCase()
    const earned = ECONOMY.killCash[e.def.kind] + (head ? ECONOMY.headshotBonus : 0)
    this.cash += earned
    this.pushFeed(head ? `HEADSHOT  ${name}  +$${earned}` : `ELIMINATED  ${name}  +$${earned}`, head ? 'head' : 'kill')
    if (this.streak === 3) this.pushFeed('TRIPLE KILL', 'info')
    if (this.streak === 3) this.comms.say('GHOST', 'Nice shooting!', 'nice', 15)
    if (this.streak === 5) {
      this.pushFeed('KILLING SPREE  UAV ONLINE', 'info')
      this.uavT = 20
      this.comms.say('COMMAND', 'UAV online. Hostiles marked on your radar.', 'uav', 5)
    }
    if (this.streak > 0 && this.streak % 8 === 0) this.pushFeed('UNSTOPPABLE', 'info')
    const roll = Math.random()
    if (roll < 0.22) this.pickups.spawn('ammo', e.x, e.z)
    else if (roll < 0.34 || (e.def.kind === 'heavy' && roll < 0.7)) this.pickups.spawn('health', e.x, e.z)
  }

  private throwGrenade() {
    this.grenades--
    this.camera.updateMatrixWorld()
    const origin = this.camera.getWorldPosition(new THREE.Vector3())
    const dir = this.camera.getWorldDirection(new THREE.Vector3())
    const p = this.player
    const inherit = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)).multiplyScalar(p.speed * 0.3)
    this.grenadesSys.throwFrom(origin, dir, inherit)
    this.comms.say('VIPER', 'Frag out!', 'frag', 4)
    this.sfx.pump()
  }

  private explode(pos: THREE.Vector3) {
    this.effects.explosion(pos, GRENADE.radius)
    this.sfx.explosion()
    this.shake = 1
    const boxes = this.world.boxes
    for (const e of this.enemies) {
      if (e.dead) continue
      const c = e.chestCenter
      const d = c.distanceTo(pos)
      if (d > GRENADE.radius || !lineOfSight(pos.x, pos.y + 0.3, pos.z, c.x, c.y, c.z, boxes)) continue
      const dmg = GRENADE.damage * (1 - d / GRENADE.radius)
      this.hitAt = performance.now()
      this.hitHead = false
      if (e.damage(dmg)) {
        this.onKill(e, false)
        this.pushFeed('GRENADE KILL', 'info')
      }
    }
    const p = this.player
    const dp = Math.hypot(p.x - pos.x, p.eyeY - 0.5 - pos.y, p.z - pos.z)
    if (dp < GRENADE.radius * 0.85 && lineOfSight(pos.x, pos.y + 0.3, pos.z, p.x, p.eyeY - 0.4, p.z, boxes)) {
      this.hurtPlayer(70 * (1 - dp / (GRENADE.radius * 0.85)), pos.x, pos.z)
    }
  }

  private hurtPlayer(dmg: number, fromX: number, fromZ: number) {
    const p = this.player
    const absorbed = Math.min(this.armor, dmg * ECONOMY.armorAbsorb)
    this.armor -= absorbed
    p.damage(dmg - absorbed, this.sim)
    this.dmgTaken += dmg
    this.dmgAt = performance.now()
    const rx = fromX - p.x
    const rz = fromZ - p.z
    const fwd = rx * -Math.sin(p.yaw) + rz * -Math.cos(p.yaw)
    const rgt = rx * Math.cos(p.yaw) + rz * -Math.sin(p.yaw)
    this.dmgAngle = Math.atan2(rgt, fwd)
    this.shake = Math.min(1, this.shake + 0.35)
    this.sfx.hurt()
    if (p.health < 35) this.comms.say('VIPER', 'You are hit! Get behind cover!', 'lowhp', 12)
  }

  private updateAllies(dt: number) {
    const p = this.player
    for (const a of this.allies) {
      const shot = a.update(dt, p.x, p.z, p.yaw, this.enemies, this.world.boxes, this.squadHold)
      if (a.spotEvent) {
        this.comms.say(a.callsign === 'GHOST' ? 'GHOST' : 'VIPER', `Contact ${this.direction(a.spotEvent.x, a.spotEvent.z)}!`, `contact${a.slot}`, 8)
        a.spotEvent = null
      }
      if (a.reloadEvent) {
        this.comms.say(a.callsign === 'GHOST' ? 'GHOST' : 'VIPER', 'Reloading, cover me!', `rl${a.slot}`, 12)
        a.reloadEvent = false
      }
      if (!shot) continue
      this.effects.tracer(shot.from, shot.to, 0x78c8e6, 0.06)
      if (Math.hypot(a.x - p.x, a.z - p.z) < 40) this.sfx.allyShot()
      if (!shot.hit) continue
      this.effects.blood(shot.to)
      if (shot.target.damage(shot.damage)) this.onSquadKill(shot.target)
    }
  }

  private onSquadKill(e: Enemy) {
    this.squadKills++
    this.comms.say('VIPER', 'Tango down.', 'sk', 9)
    this.pushFeed(`SQUAD DOWNED  ${e.def.kind.toUpperCase()}`, 'info')
    if (Math.random() < 0.18) this.pickups.spawn('ammo', e.x, e.z)
  }

  /** Opens the buy station. The simulation pauses while it is open. */
  openShop() {
    if (this.phase !== 'playing') return
    this.shopOpen = true
    this.input.release()
    this.emitHud(true)
  }

  /** Returns an error message, or null when the purchase went through. */
  buy(id: ShopItemId): string | null {
    const item = [...SHOP_WEAPONS, ...SUPPLY_ITEMS].find((i) => i.id === id)
    if (!item || this.phase !== 'playing') return 'Not available'
    const p = this.player
    const fail = (msg: string) => {
      this.sfx.deny()
      return msg
    }
    if (this.cash < item.price) return fail('Not enough cash')
    if (id === 'medkit') {
      if (p.health >= PLAYER.maxHealth) return fail('Already at full health')
      p.health = PLAYER.maxHealth
    } else if (id === 'armor') {
      if (this.armor >= ECONOMY.maxArmor) return fail('Armor is full')
      this.armor = ECONOMY.maxArmor
    } else if (id === 'frag') {
      if (this.grenades >= ECONOMY.maxGrenades) return fail('Grenades maxed')
      this.grenades = Math.min(ECONOMY.maxGrenades, this.grenades + 2)
    } else if (id === 'ammo') {
      this.arsenal.refillAll()
    } else {
      if (this.arsenal.owned.has(id)) return fail('Already owned')
      this.arsenal.grant(id)
      this.arsenal.switchTo(id)
      this.viewmodel.setWeapon(id)
      this.playerModel.setGun(id)
    }
    this.cash -= item.price
    this.sfx.buy()
    this.pushFeed(`PURCHASED  ${item.name.toUpperCase()}`, 'info')
    this.emitHud(true)
    return null
  }

  private collect(k: PickupKind) {
    this.sfx.pickup()
    if (k === 'ammo') {
      this.arsenal.addAmmo(1)
      this.pushFeed('AMMO RESUPPLY', 'info')
    } else {
      this.player.heal(40)
      this.pushFeed('MEDKIT +40', 'info')
    }
  }

  /** Describes where a point is relative to where you are facing. */
  private direction(x: number, z: number) {
    const p = this.player
    const rx = x - p.x
    const rz = z - p.z
    const fwd = rx * -Math.sin(p.yaw) + rz * -Math.cos(p.yaw)
    const rgt = rx * Math.cos(p.yaw) + rz * -Math.sin(p.yaw)
    const a = Math.atan2(rgt, fwd)
    if (Math.abs(a) < 0.6) return 'ahead'
    if (Math.abs(a) > 2.3) return 'behind you'
    return a > 0 ? 'on your right' : 'on your left'
  }

  private updateEnemies(dt: number) {
    const p = this.player
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      const shot: EnemyShot | null = e.update(dt, p.x, p.z, p.y - p.crouchT * 0.6, this.world.boxes, this.enemies, this.wave)
      if (e.justAlerted) {
        e.justAlerted = false
        this.comms.say('GHOST', 'They were hiding in the cover! Watch the wrecks!', 'flush', 12)
      }
      e.marker.visible = !e.dead && (!e.hidden || this.uavT > 0) && Math.hypot(e.x - p.x, e.z - p.z) < 95
      if (e.dead && e.deathT > 3) {
        e.dispose()
        this.enemies.splice(i, 1)
        continue
      }
      if (!shot) continue
      const target = new THREE.Vector3(p.x, p.eyeY - 0.3, p.z)
      const miss = shot.hit ? 0 : 1.4
      const aim = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * miss * 2, (Math.random() - 0.3) * miss, (Math.random() - 0.5) * miss * 2))
      this.effects.tracer(shot.from, aim, 0xff6a5c, 0.07)
      this.sfx.enemyShot(shot.from.distanceTo(target))
      if (shot.hit) this.hurtPlayer(shot.damage, e.x, e.z)
    }
  }

  private directWaves(dt: number) {
    if (this.pauseT > 0) {
      this.pauseT -= dt
      if (this.pauseT <= 0) this.startWave(this.stage ? this.stageWave + 1 : this.wave + 1)
      return
    }
    const alive = this.enemies.filter((e) => !e.dead).length
    const maxAlive = Math.min(18, this.stage ? 6 + this.stage.n : 7 + this.wave)
    this.spawnT -= dt
    if (this.queue > 0 && alive < maxAlive && this.spawnT <= 0) {
      this.spawnEnemy()
      this.queue--
      this.spawnT = Math.max(0.35, 1.1 - this.wave * 0.05)
    }
    if (this.queue === 0 && alive === 0 && !this.clearedWave) {
      this.clearedWave = true
      this.arsenal.addAmmo(1.2)
      this.player.heal(35)
      this.grenades = Math.min(ECONOMY.maxGrenades, this.grenades + 1)
      const bonus = ECONOMY.waveBase + ECONOMY.wavePerLevel * this.wave
      this.cash += bonus
      this.showBanner('WAVE CLEARED', 2.4)
      this.pushFeed(`WAVE BONUS  +$${bonus}`, 'info')
      this.pushFeed('PRESS B FOR THE BUY STATION', 'info')
      this.sfx.pickup()
      if (this.stage && this.stageWave >= this.stage.waves) {
        this.beginLoot()
        return
      }
      this.comms.say('COMMAND', 'Area clear. Resupply at the buy station.', 'clear', 2)
      this.comms.say('GHOST', 'Good work. Regroup.', 'regroup', 2)
      this.pauseT = WAVE_PAUSE_MS / 1000
    }
  }

  private spawnEnemy() {
    const p = this.player
    const boxes = this.world.boxes
    const kind = pickEnemyKind(this.wave, Math.random())
    const hideSpots = this.world.ambush.filter((s) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z)
      return d > 24 && d < 75 && !lineOfSight(p.x, p.y + 1.5, p.z, s.x, 1.2, s.z, boxes)
    })
    const hide = hideSpots.length > 0 && kind !== 'rusher' && Math.random() < 0.5
    let spot: { x: number; z: number }
    if (hide) {
      spot = hideSpots[Math.floor(Math.random() * hideSpots.length)]
    } else {
      const mid = this.world.spawns.filter((s) => {
        const d = Math.hypot(s.x - p.x, s.z - p.z)
        return d > 28 && d < 70
      })
      const far = this.world.spawns.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) > 24)
      const pool = mid.length ? mid : far.length ? far : this.world.spawns
      spot = pool[Math.floor(Math.random() * pool.length)]
    }
    const e = new Enemy(kind, spot.x, spot.z, this.wave, hide)
    this.scene.add(e.group)
    this.enemies.push(e)
    if (hide) this.comms.say('GHOST', 'Eyes on the burnt cars and cover. Hostiles may be hiding.', 'ambush', 25)
    if (kind === 'heavy') this.comms.say('VIPER', 'Heavy armor on the field!', 'heavy', 15)
  }

  private syncCamera(dt: number) {
    const p = this.player
    const sh = this.shake * this.shake
    const pitch = p.pitch + this.recoil
    const scopedSniper = this.ads && this.arsenal.current === 'sniper'
    this.tpsActive = this.viewMode === 'tps' && this.phase === 'playing' && !scopedSniper
    const jx = (Math.random() - 0.5) * sh * 0.08
    const jy = (Math.random() - 0.5) * sh * 0.08
    if (this.tpsActive) {
      const cp = Math.cos(pitch)
      const fx = -Math.sin(p.yaw) * cp
      const fy = Math.sin(pitch)
      const fz = -Math.cos(p.yaw) * cp
      const rx = Math.cos(p.yaw)
      const rz = -Math.sin(p.yaw)
      const hx = p.x
      const hy = p.y + 1.6
      const hz = p.z
      const back = this.ads ? 1.9 : 3.3
      const side = this.ads ? 0.5 : 0.8
      const dx = -fx * back + rx * side
      const dy = -fy * back + 0.3
      const dz = -fz * back + rz * side
      const len = Math.hypot(dx, dy, dz)
      const t = worldRay(hx, hy, hz, dx / len, dy / len, dz / len, this.world.boxes, len)
      const k = t < len ? Math.max(0.25, t - 0.3) / len : 1
      this.camera.position.set(hx + dx * k + jx, Math.max(0.3, hy + dy * k) + jy, hz + dz * k)
    } else {
      const bobY = Math.sin(p.bobPhase * 2) * 0.03 * Math.min(1, p.speed / 5)
      this.landDip = Math.max(0, this.landDip - dt * 3.2)
      this.camera.position.set(p.x + jx, p.eyeY + bobY + jy - this.landDip * 0.22, p.z)
    }
    const lateral = p.moveX * Math.cos(p.yaw) - p.moveZ * Math.sin(p.yaw)
    this.camera.rotation.set(pitch, p.yaw, this.tpsActive ? 0 : -lateral * 0.005, 'YXZ')
    const def = this.arsenal.cur.def
    const sprint = this.player.speed > PLAYER.walk + 1.5 ? 5 : 0
    const target = this.ads ? (this.tpsActive ? def.adsFov + 14 : def.adsFov) : BASE_FOV + sprint
    this.fov += (target - this.fov) * Math.min(1, dt * 14)
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  private telemetry(died: boolean): RunTelemetry {
    return {
      kills: this.kills,
      squadKills: this.squadKills,
      headshots: this.heads,
      wave: Math.max(1, this.wave),
      durationMs: Math.round(this.sim * 1000),
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      damageTaken: Math.round(this.dmgTaken),
      died,
    }
  }

  /** Spawns the stolen-funds case once every wave of the stage is cleared. */
  /** Static layout of the current map, for the minimap and full map. */
  mapInfo() {
    return {
      id: this.world.map.id,
      half: ARENA.half,
      boxes: this.world.boxes.map((b) => [b.minX, b.maxX, b.minZ, b.maxZ, b.maxY - b.minY]),
    }
  }

  private beginLoot() {
    const stage = this.stage
    if (!stage) return
    const p = this.player
    const spots = [...this.world.ambush, ...this.world.spawns].filter((s) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z)
      return d > 24 && d < 62
    })
    const spot = spots.length ? spots[Math.floor(Math.random() * spots.length)] : (this.world.ambush[0] ?? this.world.spawns[0])
    this.objective = new Objective(this.scene, spot.x, spot.z, `$${stage.funds.toLocaleString()}`)
    this.mapOpen = true
    this.mapCloseT = 4.5
    this.securing = 0
    this.ambushDone = false
    this.showBanner('RECOVER THE FUNDS', 3.2)
    this.pushFeed(`$${stage.funds.toLocaleString()} MARKED ON YOUR HUD`, 'info')
    this.comms.say('COMMAND', 'The thieves are down. The money case is marked. Get to it and hold position.', 'loot', 1)
    this.comms.say('GHOST', 'Moving to the case. Cover the approach.', 'lootmove', 1)
  }

  private updateObjective(dt: number) {
    const o = this.objective
    const stage = this.stage
    if (!o || !stage || this.phase !== 'playing') return
    const p = this.player
    const inside = Math.hypot(o.x - p.x, o.z - p.z) < 2.4 && Math.abs(p.y) < 1.6
    if (inside) {
      this.securing += dt
      if (!this.ambushDone && this.securing > 0.25) {
        this.ambushDone = true
        const n = 2 + Math.ceil(stage.n / 2)
        for (let i = 0; i < n; i++) this.spawnEnemy()
        this.showBanner('REINFORCEMENTS', 2)
        this.comms.say('VIPER', 'More thieves incoming! Keep holding the case!', 'ambush2', 1)
      }
    } else {
      this.securing = Math.max(0, this.securing - dt * 1.5)
    }
    o.update(dt, this.securing / SECURE_TIME)
    if (this.securing >= SECURE_TIME) this.finishStage('cleared')
  }

  private objectiveHud(alive: number): ObjectiveHud | null {
    const stage = this.stage
    if (!stage) return null
    const o = this.objective
    if (!o) {
      return {
        kind: 'eliminate',
        text: 'Eliminate the thieves',
        detail: `${alive + this.queue} left  |  wave ${Math.max(1, this.stageWave)} of ${stage.waves}`,
        dist: -1,
        sx: 0.5,
        sy: 0.5,
        onScreen: false,
        progress: 0,
      }
    }
    const p = this.player
    const dist = Math.hypot(o.x - p.x, o.z - p.z)
    this.camera.updateMatrixWorld()
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert()
    const v = new THREE.Vector3(o.x, 2.6, o.z).project(this.camera)
    const behind = v.z > 1
    let sx = v.x * 0.5 + 0.5
    let sy = -v.y * 0.5 + 0.5
    if (behind) {
      sx = 1 - sx
      sy = 0.9
    }
    const onScreen = !behind && sx > 0.05 && sx < 0.95 && sy > 0.1 && sy < 0.9
    sx = Math.max(0.06, Math.min(0.94, sx))
    sy = Math.max(0.12, Math.min(0.88, sy))
    return {
      kind: 'recover',
      text: this.securing > 0 ? 'Securing the funds, hold position' : 'Recover the stolen funds',
      detail: `$${stage.funds.toLocaleString()}  |  ${Math.round(dist)} m`,
      dist,
      sx,
      sy,
      onScreen,
      progress: Math.min(1, this.securing / SECURE_TIME),
    }
  }

  private finishStage(outcome: StageResult['outcome']) {
    const stage = this.stage
    if (!stage || this.phase !== 'playing') return
    this.phase = 'ended'
    this.shopOpen = false
    this.sfx.stopAmbient()
    if (outcome === 'cleared') {
      this.sfx.pickup()
      this.comms.say('COMMAND', `Funds secured. $${stage.funds.toLocaleString()} recovered.`, 'won', 1)
    }
    this.input.release()
    this.emitHud(true)
    this.events.onStage({
      stage: stage.n,
      outcome,
      funds: stage.funds,
      kills: this.kills,
      squadKills: this.squadKills,
      headshots: this.heads,
      durationMs: Math.round(this.sim * 1000),
      accuracy: this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0,
      cash: this.cash,
      owned: [...this.arsenal.owned],
    })
  }

  private endRun(died: boolean) {
    if (this.phase !== 'playing') return
    this.phase = 'ended'
    this.sfx.stopAmbient()
    this.shopOpen = false
    const t = this.telemetry(died)
    this.input.release()
    this.emitHud(true)
    this.events.onEnd(t, computeScore(t))
  }

  private emitHud(force: boolean) {
    this.hudT = 0.05
    if (!force && this.phase === 'idle') return
    const p = this.player
    const now = performance.now()
    const blips: RadarBlip[] = []
    const range = this.uavT > 0 ? UAV_RANGE : RADAR_RANGE
    for (const e of this.enemies) {
      if (e.dead || (e.hidden && this.uavT <= 0)) continue
      const rx = e.x - p.x
      const rz = e.z - p.z
      const fwd = rx * -Math.sin(p.yaw) + rz * -Math.cos(p.yaw)
      const rgt = rx * Math.cos(p.yaw) + rz * -Math.sin(p.yaw)
      const d = Math.hypot(fwd, rgt)
      if (d > range) continue
      blips.push({ x: rgt / range, y: fwd / range, kind: e.def.kind })
    }
    for (const a of this.allies) {
      const rx = a.x - p.x
      const rz = a.z - p.z
      const fwd = rx * -Math.sin(p.yaw) + rz * -Math.cos(p.yaw)
      const rgt = rx * Math.cos(p.yaw) + rz * -Math.sin(p.yaw)
      if (Math.hypot(fwd, rgt) <= range) blips.push({ x: rgt / range, y: fwd / range, kind: 'ally' })
    }
    const alive = this.enemies.filter((e) => !e.dead).length
    const t = this.telemetry(false)
    const nav = {
      px: p.x,
      pz: p.z,
      yaw: p.yaw,
      half: ARENA.half,
      pin: this.objective ? { x: this.objective.x, z: this.objective.z } : null,
      allies: this.allies.map((a) => ({ x: a.x, z: a.z })),
      enemies: this.enemies
        .filter((e) => !e.dead && (!e.hidden || this.uavT > 0) && Math.hypot(e.x - p.x, e.z - p.z) < (this.uavT > 0 ? UAV_RANGE : 46))
        .map((e) => ({ x: e.x, z: e.z })),
    }
    this.events.onHud({
      nav,
      mapOpen: this.mapOpen,
      health: Math.ceil(p.health),
      maxHealth: PLAYER.maxHealth,
      armor: Math.ceil(this.armor),
      cash: this.cash,
      slots: this.arsenal.slots(),
      shopOpen: this.shopOpen,
      fallback: this.input.steering,
      crouching: p.crouchT > 0.5,
      radio: this.comms.current(),
      squadHold: this.squadHold,
      uav: this.uavT,
      view: this.viewMode,
      mapName: this.world.map.name,
      intermission: this.pauseT > 0,
      weapon: this.arsenal.hud(),
      grenades: this.grenades,
      wave: this.stage ? Math.max(1, this.stageWave) : Math.max(1, this.wave),
      enemiesLeft: alive + this.queue,
      kills: this.kills,
      headshots: this.heads,
      score: computeScore(t),
      streak: this.streak,
      timeLeft: Math.max(0, this.timeLimit - this.sim),
      timeLimit: this.timeLimit,
      mode: this.stage ? 'campaign' : 'endless',
      stage: this.stage?.n ?? 0,
      stageName: this.stage?.name ?? '',
      stageWaves: this.stage?.waves ?? 0,
      funds: this.stage?.funds ?? 0,
      objective: this.objectiveHud(alive),
      ads: this.ads,
      scoped: this.ads && this.arsenal.current === 'sniper',
      reload: this.arsenal.reloadProgress(),
      sprinting: p.speed > PLAYER.walk + 1.5,
      hitAt: this.hitAt,
      hitWasHead: this.hitHead,
      damagedAt: this.dmgAt,
      damageAngle: this.dmgAngle,
      blips,
      banner: this.banner && now < this.bannerUntil ? this.banner : null,
      feed: this.feed.filter((f) => f.until > now).map(({ id, text, tone }) => ({ id, text, tone })),
      locked: this.input.locked,
      now,
    })
  }

  /** Test hooks, only wired up when the page is opened with ?debug. */
  debugApi() {
    return {
      view: (v: 'tps' | 'fps') => {
        this.viewMode = v
      },
      tp: (x: number, z: number, yaw: number, pitch = 0) => {
        this.player.x = x
        this.player.z = z
        this.player.yaw = yaw
        this.player.pitch = pitch
      },
      spawn: (kind: 'grunt' | 'rusher' | 'heavy', x: number, z: number, hidden = false) => {
        const e = new Enemy(kind, x, z, 1, hidden)
        this.scene.add(e.group)
        this.enemies.push(e)
      },
      ads: (on: boolean) => {
        this.input.ads = on
      },
      fire: (on: boolean) => {
        this.input.fire = on
      },
      weapon: (n: number) => {
        const id = WEAPON_ORDER[n]
        if (id) {
          this.arsenal.grant(id)
          if (this.arsenal.switchTo(id)) this.onSwitched()
        }
      },
      touch: () => this.touchApi(),
      killAll: () => {
        this.queue = 0
        for (const e of this.enemies) if (!e.dead && e.damage(99999)) this.onSquadKill(e)
      },
      objective: () => (this.objective ? { x: this.objective.x, z: this.objective.z } : null),
      hud: () => ({ stage: this.stage?.n, wave: this.stageWave, text: this.objectiveHud(0)?.text, detail: this.objectiveHud(0)?.detail, dist: this.objectiveHud(0)?.dist, onScreen: this.objectiveHud(0)?.onScreen }),
      freeze: (on: boolean) => {
        this.frozen = on
      },
      info: () => ({ x: this.player.x, z: this.player.z, yaw: this.player.yaw, fallback: this.input.steering, locked: this.input.locked, enemies: this.enemies.length, allies: this.allies.length, phase: this.phase, wave: this.wave }),
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.input.dispose()
    for (const e of this.enemies) e.dispose()
    for (const a of this.allies) a.dispose()
    this.objective?.dispose()
    this.playerModel.dispose()
    this.sfx.stopAmbient()
    this.comms.reset()
    this.effects.dispose()
    this.pickups.dispose()
    this.grenadesSys.dispose()
    this.world.dispose()
    this.renderer.dispose()
  }
}
