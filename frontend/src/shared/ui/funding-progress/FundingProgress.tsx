interface FundingProgressProps {
  percentage: number
}

import './FundingProgress.css'

export function FundingProgress({ percentage }: FundingProgressProps) {
  const safePercentage = Math.min(100, Math.max(0, percentage))

  return (
    <div className="funding-progress">
      <div className="funding-progress__labels">
        <span>Progreso de financiación</span>
        <strong>{safePercentage}% financiado</strong>
      </div>
      <div
        className="funding-progress__track"
        role="progressbar"
        aria-label="Progreso de financiación"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercentage}
      >
        <span style={{ width: `${safePercentage}%` }} />
      </div>
    </div>
  )
}
