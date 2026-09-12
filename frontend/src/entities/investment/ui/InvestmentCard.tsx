import { Link } from 'react-router-dom'
import { appAssets } from '../../../assets/assets'
import residentialThumbnail from '../../../assets/illustrations/investment-residential.svg'
import solarThumbnail from '../../../assets/illustrations/investment-solar.svg'
import { formatUsd } from '../../../shared/lib/format'
import type { Investment } from '../../../shared/types/platform.types'
import { ProgressMeter, StatusBadge } from '../../../shared/ui/platform/PlatformUI'
import './InvestmentCard.css'

const statusLabels: Record<Investment['status'], string> = {
  ACTIVE: 'ACTIVA',
  PENDING: 'PENDIENTE',
  COMPLETED: 'COMPLETADA',
  DEFAULTED: 'INCUMPLIDA',
}

const projectThumbnails: Record<string, string> = {
  'residencial-mirador-valle': residentialThumbnail,
  'andes-solar-expansion': solarThumbnail,
  'altiplano-quinoa-exporta': appAssets.businesses.altiplanoQuinoa,
}

export function InvestmentCard({ investment }: { investment: Investment }) {
  const progress = Math.max(0, Math.min(100, investment.projectProgress))

  return (
    <Link className="investment-card" to={`/mis-inversiones/${investment.id}`} aria-label={`Ver inversión en ${investment.projectName}`}>
      <img
        className="investment-card__thumbnail"
        src={projectThumbnails[investment.opportunityId] ?? appAssets.businesses.fallback}
        alt=""
        loading="lazy"
      />
      <div className="investment-card__body">
        <div className="investment-card__heading">
          <div className="investment-card__identity">
            <h2>{investment.projectName}</h2>
            <p>{investment.companyName}</p>
          </div>
          <StatusBadge status={investment.status} label={statusLabels[investment.status]} />
        </div>
        <div className="investment-card__numbers">
          <strong>{formatUsd(investment.amount, true)}</strong>
          <span aria-label={`Avance del proyecto: ${progress}%`}>{progress}%</span>
        </div>
        <ProgressMeter value={progress} />
      </div>
    </Link>
  )
}
