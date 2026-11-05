import * as THREE from 'three'
import { assetUrl } from './assets'

/** `?safe` swaps PBR materials for simple lit ones. Used for screenshots on software renderers. */
export const SAFE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('safe')

export function pbr(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  if (!SAFE) return new THREE.MeshStandardMaterial(params)
  const { color, map, emissive, normalMap, transparent, opacity, side } = params
  return new THREE.MeshLambertMaterial({ color, map, emissive, normalMap, transparent, opacity, side }) as unknown as THREE.MeshStandardMaterial
}

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

/** Loads a tiling texture from /assets/tex. Colour maps are sRGB, data maps are linear. */
export function loadTex(name: string, srgb: boolean, repeat: [number, number] = [1, 1]): THREE.Texture {
  const key = `${name}:${srgb}`
  let t = cache.get(key)
  if (!t) {
    t = loader.load(assetUrl(`tex/${name}.jpg`))
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 8
    cache.set(key, t)
  }
  const c = t.clone()
  c.needsUpdate = true
  c.repeat.set(repeat[0], repeat[1])
  return c
}
