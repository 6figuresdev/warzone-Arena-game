import * as THREE from 'three'

interface Particle {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  max: number
  gravity: number
  base: number
}

interface Timed {
  mesh: THREE.Mesh
  life: number
  max: number
  kind: 'tracer' | 'blast'
  radius?: number
  mat?: THREE.MeshBasicMaterial
}

/** Tracers, sparks, blood and explosions. Everything is pooled by shared geometry. */
interface Casing {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: THREE.Vector3
  life: number
}

export class Effects {
  private decals: THREE.Mesh[] = []
  private decalIdx = 0
  private decalGeo = new THREE.PlaneGeometry(0.16, 0.16)
  private decalMat: THREE.MeshBasicMaterial
  private casings: Casing[] = []
  private casingGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6)
  private casingMat = new THREE.MeshBasicMaterial({ color: 0xc9a24a })
  private particles: Particle[] = []
  private timed: Timed[] = []
  private mats = new Map<number, THREE.MeshBasicMaterial>()
  private cubeGeo = new THREE.BoxGeometry(1, 1, 1)
  private tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5)
  private blastGeo = new THREE.SphereGeometry(1, 16, 12)
  private up = new THREE.Vector3(0, 1, 0)

  constructor(private scene: THREE.Scene) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30)
      grad.addColorStop(0, 'rgba(8,8,8,0.95)')
      grad.addColorStop(0.3, 'rgba(18,16,14,0.8)')
      grad.addColorStop(1, 'rgba(30,26,22,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      g.strokeStyle = 'rgba(20,18,16,0.6)'
      g.lineWidth = 1.5
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * 6.28
        g.beginPath()
        g.moveTo(32, 32)
        g.lineTo(32 + Math.cos(a) * (14 + Math.random() * 16), 32 + Math.sin(a) * (14 + Math.random() * 16))
        g.stroke()
      }
    }
    this.decalMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  }

  /** Leaves a bullet hole on a surface. The newest 70 stay, older ones are recycled. */
  decal(point: THREE.Vector3, normal: THREE.Vector3) {
    let m = this.decals[this.decalIdx]
    if (!m) {
      m = new THREE.Mesh(this.decalGeo, this.decalMat)
      this.scene.add(m)
      this.decals[this.decalIdx] = m
    }
    this.decalIdx = (this.decalIdx + 1) % 70
    m.position.copy(point).addScaledVector(normal, 0.012)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    m.rotateZ(Math.random() * 6.28)
    m.scale.setScalar(0.7 + Math.random() * 0.7)
  }

  /** Ejects a spent brass casing. */
  casing(pos: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) {
    if (this.casings.length > 36) {
      const old = this.casings.shift()
      if (old) this.scene.remove(old.mesh)
    }
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat)
    mesh.position.copy(pos)
    this.scene.add(mesh)
    const vel = right.clone().multiplyScalar(2 + Math.random()).addScaledVector(up, 1.6 + Math.random() * 0.8)
    this.casings.push({ mesh, vel, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20), life: 2.2 })
  }

  private mat(color: number) {
    let m = this.mats.get(color)
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
      this.mats.set(color, m)
    }
    return m
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe2a8, life = 0.06) {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    if (len < 0.01) return
    const mesh = new THREE.Mesh(this.tracerGeo, this.mat(color))
    mesh.position.copy(from).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(this.up, dir.normalize())
    mesh.scale.set(1, len, 1)
    this.scene.add(mesh)
    this.timed.push({ mesh, life, max: life, kind: 'tracer' })
  }

  burst(pos: THREE.Vector3, color: number, count: number, speed: number, size = 0.07, life = 0.5, gravity = 14, spread?: THREE.Vector3) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, this.mat(color))
      mesh.position.copy(pos)
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8))
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()))
      if (spread) v.addScaledVector(spread, 1.5)
      this.scene.add(mesh)
      this.particles.push({ mesh, vel: v, life: life * (0.6 + Math.random() * 0.6), max: life, gravity, base: mesh.scale.x })
    }
  }

  sparks(pos: THREE.Vector3) {
    this.burst(pos, 0xffc866, 6, 4, 0.05, 0.35)
    this.burst(pos, 0x9aa0a8, 4, 2.5, 0.09, 0.5, 6)
  }

  blood(pos: THREE.Vector3, big = false) {
    this.burst(pos, 0xb3262f, big ? 14 : 7, big ? 5 : 3, 0.07, 0.6, 12)
  }

  explosion(pos: THREE.Vector3, radius: number) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 0.85, depthWrite: false })
    const mesh = new THREE.Mesh(this.blastGeo, mat)
    mesh.position.copy(pos)
    mesh.scale.setScalar(0.3)
    this.scene.add(mesh)
    this.timed.push({ mesh, life: 0.45, max: 0.45, kind: 'blast', radius, mat })
    this.burst(pos, 0xffb347, 26, 11, 0.16, 0.8, 8)
    this.burst(pos, 0x3a3a3f, 18, 5, 0.34, 1.4, -1.5)
  }

  update(dt: number) {
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i]
      c.life -= dt
      if (c.life <= 0) {
        this.scene.remove(c.mesh)
        this.casings.splice(i, 1)
        continue
      }
      c.vel.y -= 14 * dt
      c.mesh.position.addScaledVector(c.vel, dt)
      c.mesh.rotation.x += c.spin.x * dt
      c.mesh.rotation.z += c.spin.z * dt
      if (c.mesh.position.y < 0.02) {
        c.mesh.position.y = 0.02
        c.vel.y = Math.abs(c.vel.y) * 0.35
        c.vel.x *= 0.5
        c.vel.z *= 0.5
        c.spin.multiplyScalar(0.4)
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        this.particles.splice(i, 1)
        continue
      }
      p.vel.y -= p.gravity * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      if (p.mesh.position.y < 0.03) {
        p.mesh.position.y = 0.03
        p.vel.multiplyScalar(0.3)
        p.vel.y = Math.abs(p.vel.y) * 0.3
      }
      p.mesh.scale.setScalar(Math.max(0.001, p.base * (p.life / p.max)))
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i]
      t.life -= dt
      if (t.life <= 0) {
        this.scene.remove(t.mesh)
        t.mat?.dispose()
        this.timed.splice(i, 1)
        continue
      }
      if (t.kind === 'blast' && t.mat && t.radius) {
        const k = 1 - t.life / t.max
        t.mesh.scale.setScalar(0.3 + k * t.radius * 0.7)
        t.mat.opacity = 0.85 * (1 - k)
      }
    }
  }

  clear() {
    for (const d of this.decals) d.visible = false
    for (const c of this.casings) this.scene.remove(c.mesh)
    this.casings = []
    for (const p of this.particles) this.scene.remove(p.mesh)
    for (const t of this.timed) {
      this.scene.remove(t.mesh)
      t.mat?.dispose()
    }
    this.particles = []
    this.timed = []
  }

  dispose() {
    this.clear()
    this.decalGeo.dispose()
    this.decalMat.dispose()
    this.casingGeo.dispose()
    this.casingMat.dispose()
    this.cubeGeo.dispose()
    this.tracerGeo.dispose()
    this.blastGeo.dispose()
    for (const m of this.mats.values()) m.dispose()
  }
}
