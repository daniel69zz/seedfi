import { useEffect, useSyncExternalStore } from 'react'
import { getPlantFrame, getProjectAnimationTiming, PLANT_SPRITE } from '../../../shared/config/plantSprite'
import { useProgressSprite } from '../../../shared/hooks/useProgressSprite'
import { getPlantSpriteState, preloadPlantSprite, subscribePlantSprite } from '../../../shared/lib/plantSprite'
import { normalizeProjectProgress } from '../model/projectGrowth'
import { SeedStage } from './ProjectGrowth'
import './ProjectPlantGrowth.css'

export function ProjectPlantGrowth({ progress }: { progress: number }) {
  const value = normalizeProjectProgress(progress)
  const assetState = useSyncExternalStore(subscribePlantSprite, getPlantSpriteState, () => 'idle')
  useEffect(() => { void preloadPlantSprite() }, [])
  const { currentFrame, targetFrame } = useProgressSprite({
    progress: value,
    totalFrames: PLANT_SPRITE.totalFrames,
    ...getProjectAnimationTiming(value),
    enabled: assetState === 'ready',
  })
  const frame = getPlantFrame(currentFrame)

  return (
    <div
      className="project-growth project-plant-growth"
      role="img"
      aria-label={`Crecimiento de la planta: ${Math.round(value)}% de avance de obra.`}
      data-frame={currentFrame}
      data-target-frame={targetFrame}
      data-asset-state={assetState}
    >
      {assetState === 'error' ? <SeedStage progress={0} /> : (
        <div className="project-plant-growth__viewport" aria-hidden="true">
          <div className="project-plant-growth__frame" style={{
            visibility: assetState === 'ready' ? 'visible' : 'hidden',
            height: `${frame.height / PLANT_SPRITE.viewportHeight * 100}%`,
            backgroundImage: `url("${PLANT_SPRITE.src}")`,
            backgroundSize: `${PLANT_SPRITE.imageWidth / frame.width * 100}% ${PLANT_SPRITE.imageHeight / frame.height * 100}%`,
            backgroundPosition: `${frame.x / (PLANT_SPRITE.imageWidth - frame.width) * 100}% ${frame.y / (PLANT_SPRITE.imageHeight - frame.height) * 100}%`,
          }} />
        </div>
      )}
    </div>
  )
}
