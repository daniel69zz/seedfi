import plantSprite from '../../assets/brand/Plant.png'

// Measured from the actual 1254 × 1254 sheet. It has 6 columns and
// 5 unevenly spaced rows, not a uniform 600% × 500% CSS grid.
const rows = [
  { y: 70, height: 103 },
  { y: 245, height: 138 },
  { y: 435, height: 174 },
  { y: 655, height: 199 },
  { y: 880, height: 263 },
] as const

// Center each soil mound on the same axis. Every crop ends exactly
// 13 source pixels below the soil baseline, including its shadow.
const frameLeft = [
  3, 215, 421, 629, 835.5, 1042,
  4, 215, 421, 628, 835, 1042,
  4, 214.5, 420.5, 628, 835, 1041.5,
  4, 214, 420.5, 628.5, 836, 1041.5,
  5, 214.5, 420, 627.5, 834.5, 1042,
] as const

// Reading order, except poses 5 and 6: the first pose of row two
// is 4 px shorter than the last pose of row one. Keep all 30 poses.
const growthOrder = [0, 1, 2, 3, 4, 6, 5, ...Array.from({ length: 23 }, (_, index) => index + 7)]

export const PLANT_SPRITE = {
  src: plantSprite,
  imageWidth: 1254,
  imageHeight: 1254,
  columns: 6,
  rows: rows.length,
  totalFrames: growthOrder.length,
  frameWidth: 209,
  viewportHeight: 264,
} as const

export function getPlantFrame(frameIndex: number) {
  const index = Number.isFinite(frameIndex)
    ? Math.max(0, Math.min(PLANT_SPRITE.totalFrames - 1, Math.floor(frameIndex))) : 0
  const sourceIndex = growthOrder[index]
  const row = rows[Math.floor(sourceIndex / PLANT_SPRITE.columns)]
  return { x: frameLeft[sourceIndex], y: row.y, width: PLANT_SPRITE.frameWidth, height: row.height }
}

export function getProjectAnimationTiming(progress: number) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0
  const targetFrame = Math.round(value / 100 * (PLANT_SPRITE.totalFrames - 1))
  // 1.2–2.2 seconds, about 1650 ms at 46%. Quantizing the duration keeps
  // updates within the same pose from restarting its animation effect.
  const delay = 140
  return { duration: 1200 + targetFrame / (PLANT_SPRITE.totalFrames - 1) * 1000 - delay, delay }
}
