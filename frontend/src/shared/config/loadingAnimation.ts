import loadingSprite from '../../assets/brand/carga.png'

// Measured from carga.png (1374 × 1145), in reading order.
// The drawn panel outlines are 1–3 px thick, with 8–11 px gutters.
// Row four is shorter; dividing the entire sheet into equal cells clips frames.
const columns = [
  { start: 8, size: 218 },
  { start: 234, size: 220 },
  { start: 462, size: 220 },
  { start: 690, size: 220 },
  { start: 918, size: 219 },
  { start: 1146, size: 218 },
] as const
const rows = [
  { start: 9, size: 218 },
  { start: 236, size: 218 },
  { start: 463, size: 218 },
  { start: 690, size: 201 },
  { start: 900, size: 227 },
] as const

export const SPRITE_CONFIG = {
  src: loadingSprite,
  imageWidth: 1374,
  imageHeight: 1145,
  columns: columns.length,
  rows: rows.length,
  totalFrames: columns.length * rows.length,
  // One fixed canvas and scale for all frames; the shorter row sits at its base.
  viewportWidth: 220,
  viewportHeight: 224,
  frameDuration: 90,
  reducedMotionFrame: 28,
  inset: 3,
} as const

export function getLoadingFrame(frameIndex: number) {
  const index = Number.isFinite(frameIndex)
    ? Math.max(0, Math.min(SPRITE_CONFIG.totalFrames - 1, Math.floor(frameIndex))) : 0
  const column = columns[index % SPRITE_CONFIG.columns]
  const row = rows[Math.floor(index / SPRITE_CONFIG.columns)]
  return {
    x: column.start + SPRITE_CONFIG.inset,
    y: row.start + SPRITE_CONFIG.inset,
    width: column.size - SPRITE_CONFIG.inset * 2,
    height: row.size - SPRITE_CONFIG.inset * 2,
  }
}

export const LOADING_TIMING = {
  simulatedDuration: 1400,
  showDelay: 200,
  minimumVisibleTime: 600,
} as const

export const LOADING_MESSAGES = {
  investments: 'Cargando tus inversiones...',
  investment: 'Preparando tu inversión...',
  opportunities: 'Buscando oportunidades...',
  portfolio: 'Preparando tu portafolio...',
  blockchain: 'Consultando la red...',
  documentation: 'Cargando documentos...',
} as const
