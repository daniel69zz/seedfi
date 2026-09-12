export type ProjectGrowthStage =
  | 'seed'
  | 'sprout'
  | 'small'
  | 'medium'
  | 'large'
  | 'nearly-complete'
  | 'complete'

export function normalizeProjectProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0
}

/** Stages describe construction progress; they never determine investment returns. */
export function getProjectGrowthStage(progress: number): ProjectGrowthStage {
  const value = normalizeProjectProgress(progress)
  if (value <= 15) return 'seed'
  if (value <= 30) return 'sprout'
  if (value <= 50) return 'small'
  if (value <= 70) return 'medium'
  if (value <= 90) return 'large'
  if (value < 100) return 'nearly-complete'
  return 'complete'
}
