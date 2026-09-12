import { useEffect, useSyncExternalStore } from 'react'
import { SPRITE_CONFIG, getLoadingFrame } from '../../config/loadingAnimation'
import { useSpriteAnimation } from '../../hooks/useSpriteAnimation'
import { getLoadingSpriteState, preloadLoadingSprite, subscribeLoadingSprite } from '../../lib/loadingSprite'
import './LoadingScreen.css'

export function BeaverLoader({ speed = SPRITE_CONFIG.frameDuration }: { speed?: number }) {
  const assetState = useSyncExternalStore(subscribeLoadingSprite, getLoadingSpriteState, () => 'idle')
  useEffect(() => { void preloadLoadingSprite() }, [])
  const { currentFrame } = useSpriteAnimation({
    totalFrames: SPRITE_CONFIG.totalFrames,
    frameDuration: speed,
    loop: true,
    enabled: assetState === 'ready',
    reducedMotionFrame: SPRITE_CONFIG.reducedMotionFrame,
  })
  const frame = getLoadingFrame(currentFrame)

  return (
    <div className="beaver-loader" aria-hidden="true" data-frame={currentFrame} data-asset-state={assetState}>
      <div className="beaver-loader__frame" style={{
        visibility: assetState === 'ready' ? 'visible' : 'hidden',
        width: `${frame.width / SPRITE_CONFIG.viewportWidth * 100}%`,
        height: `${frame.height / SPRITE_CONFIG.viewportHeight * 100}%`,
        backgroundImage: `url("${SPRITE_CONFIG.src}")`,
        backgroundSize: `${SPRITE_CONFIG.imageWidth / frame.width * 100}% ${SPRITE_CONFIG.imageHeight / frame.height * 100}%`,
        backgroundPosition: `${frame.x / (SPRITE_CONFIG.imageWidth - frame.width) * 100}% ${frame.y / (SPRITE_CONFIG.imageHeight - frame.height) * 100}%`,
      }} />
    </div>
  )
}
