import * as THREE from 'three'
import { pbr } from './mats'

function printTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  if (g) {
    g.clearRect(0, 0, 256, 256)
    g.fillStyle = '#1d8a4f'
    g.font = '800 150px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$', 128, 100)
    g.fillStyle = '#2775ca'
    g.beginPath()
    g.roundRect(34, 168, 188, 58, 29)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = '800 38px sans-serif'
    g.fillText('USDC', 128, 198)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function tagTexture(label: string) {
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 110
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = 'rgba(11,22,38,0.9)'
    g.beginPath()
    g.roundRect(4, 4, 312, 102, 51)
    g.fill()
    g.strokeStyle = '#6dffa0'
    g.lineWidth = 4
    g.stroke()
    g.fillStyle = '#2775ca'
    g.beginPath()
    g.roundRect(18, 20, 108, 70, 35)
    g.fill()
    g.fillStyle = '#fff'
    g.font = '800 34px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('USDC', 72, 56)
    g.fillStyle = '#6dffa0'
    g.font = '800 44px sans-serif'
    g.fillText(label, 222, 56)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The stolen funds: a burlap USDC money bag with cash bundles, a tag and a light beam visible across the map. */
export class Objective {
  readonly group = new THREE.Group()
  private ring: THREE.Mesh
  private beam: THREE.Mesh
  private bag = new THREE.Group()
  private tag: THREE.Sprite
  private t = 0
  private disposables: { dispose: () => void }[] = []

  constructor(private scene: THREE.Scene, readonly x: number, readonly z: number, label: string) {
    const track = <T extends { dispose: () => void }>(o: T) => {
      this.disposables.push(o)
      return o
    }
    const burlap = track(pbr({ color: 0xb48a55, roughness: 0.95 }))
    const rope = track(pbr({ color: 0x6b4a2a, roughness: 0.9 }))
    const cash = track(pbr({ color: 0x4f9a63, roughness: 0.7 }))
    const band = track(pbr({ color: 0xe9e2c8, roughness: 0.8 }))
    const gold = track(pbr({ color: 0xe0b84a, roughness: 0.3, metalness: 0.9 }))

    const profile = [
      [0.001, 0], [0.26, 0.02], [0.4, 0.14], [0.46, 0.3], [0.42, 0.46], [0.3, 0.6],
      [0.16, 0.7], [0.12, 0.76], [0.2, 0.86], [0.27, 0.98], [0.2, 1.0],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const body = new THREE.Mesh(track(new THREE.LatheGeometry(profile, 28)), burlap)
    body.castShadow = true
    const tie = new THREE.Mesh(track(new THREE.TorusGeometry(0.135, 0.028, 8, 20)), rope)
    tie.rotation.x = Math.PI / 2
    tie.position.y = 0.74
    const printMat = track(new THREE.MeshBasicMaterial({ map: track(printTexture()), transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    for (const start of [-0.8, Math.PI - 0.8]) {
      const decal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.466, 0.466, 0.42, 20, 1, true, start, 1.6)), printMat)
      decal.position.y = 0.3
      this.bag.add(decal)
    }
    this.bag.add(body, tie)
    this.bag.scale.setScalar(1.25)

    // Cash bundles and coins around the bag.
    const bundles = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.1, 0.16)), cash)
      const strap = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.104, 0.162)), band)
      b.add(strap)
      const a = (i / 4) * Math.PI * 2 + 0.5
      b.position.set(Math.cos(a) * 0.85, 0.05 + (i % 2) * 0.1, Math.sin(a) * 0.85)
      b.rotation.y = -a + Math.PI / 2
      bundles.add(b)
    }
    for (let i = 0; i < 6; i++) {
      const coin = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16)), gold)
      const a = i * 1.7
      coin.position.set(Math.cos(a) * 0.7, 0.015, Math.sin(a) * 0.7)
      bundles.add(coin)
    }

    this.tag = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(tagTexture(label)), depthWrite: false, fog: false })))
    this.tag.scale.set(1.9, 0.65, 1)
    this.tag.position.y = 2.35

    this.beam = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.45, 0.45, 70, 20, 1, true)),
      track(new THREE.MeshBasicMaterial({ color: 0x6dffa0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })),
    )
    this.beam.position.y = 35
    this.ring = new THREE.Mesh(
      track(new THREE.RingGeometry(1.35, 1.6, 48)),
      track(new THREE.MeshBasicMaterial({ color: 0x6dffa0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false })),
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.05
    this.group.add(this.bag, bundles, this.tag, this.beam, this.ring)
    this.group.position.set(x, 0, z)
    scene.add(this.group)
  }

  update(dt: number, securing: number) {
    this.t += dt
    this.bag.rotation.y += dt * 0.8
    this.tag.position.y = 2.35 + Math.sin(this.t * 2) * 0.06
    const pulse = 1 + Math.sin(this.t * 3) * 0.06 + securing * 0.25
    this.ring.scale.setScalar(pulse)
    ;(this.beam.material as THREE.MeshBasicMaterial).opacity = 0.16 + securing * 0.25 + Math.sin(this.t * 4) * 0.03
  }

  dispose() {
    this.scene.remove(this.group)
    for (const d of this.disposables) d.dispose()
  }
}
