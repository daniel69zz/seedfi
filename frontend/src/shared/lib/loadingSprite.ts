import { SPRITE_CONFIG } from '../config/loadingAnimation'

type SpriteState = 'idle' | 'loading' | 'ready' | 'error'
let state: SpriteState = 'idle'
let preload: Promise<boolean> | undefined
const listeners = new Set<() => void>()

function update(next: SpriteState) {
  state = next
  listeners.forEach((notify) => notify())
}

export function preloadLoadingSprite(): Promise<boolean> {
  if (preload) return preload
  update('loading')
  preload = new Promise<boolean>((resolve) => {
    const image = new Image()
    image.onload = async () => {
      try { await image.decode() } catch { /* A loaded image remains usable without decode(). */ }
      update('ready')
      resolve(true)
    }
    image.onerror = () => { update('error'); resolve(false) }
    image.src = SPRITE_CONFIG.src
  })
  return preload
}

export function getLoadingSpriteState() { return state }
export function subscribeLoadingSprite(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
