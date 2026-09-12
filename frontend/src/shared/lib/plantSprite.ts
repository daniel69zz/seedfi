import { PLANT_SPRITE } from '../config/plantSprite'

type PlantSpriteState = 'idle' | 'loading' | 'ready' | 'error'
let state: PlantSpriteState = 'idle'
let preload: Promise<boolean> | undefined
const listeners = new Set<() => void>()

function update(next: PlantSpriteState) {
  state = next
  listeners.forEach((notify) => notify())
}

export function preloadPlantSprite(): Promise<boolean> {
  if (preload) return preload
  update('loading')
  preload = new Promise<boolean>((resolve) => {
    const image = new Image()
    image.onload = async () => {
      try { await image.decode() } catch { /* Loaded images also work without decode(). */ }
      update('ready')
      resolve(true)
    }
    image.onerror = () => { update('error'); resolve(false) }
    image.src = PLANT_SPRITE.src
  })
  return preload
}

export function getPlantSpriteState() { return state }
export function subscribePlantSprite(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
