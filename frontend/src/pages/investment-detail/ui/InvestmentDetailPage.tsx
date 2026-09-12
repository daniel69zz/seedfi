import { CircleDollarSign, Clock3, ReceiptText, TrendingUp } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useParams } from 'react-router-dom'
import type { InvestmentDetail } from '../../../entities/investment/model/investment.types'
import { useInvestmentDetail } from '../../../entities/investment/model/useInvestmentDetail'
import { AnimatedMetric } from '../../../entities/investment/ui/AnimatedMetric'
import { BlockchainCard } from '../../../entities/investment/ui/BlockchainCard'
import { DocumentationCard } from '../../../entities/investment/ui/DocumentationCard'
import { InvestmentHero } from '../../../entities/investment/ui/InvestmentHero'
import { PaymentScheduleCard } from '../../../entities/investment/ui/PaymentScheduleCard'
import { ProjectProgress } from '../../../entities/investment/ui/ProjectProgress'
import { useAnimatedProgress } from '../../../shared/hooks/useAnimatedProgress'
import { getProjectAnimationTiming } from '../../../shared/config/plantSprite'
import { getPlantSpriteState, preloadPlantSprite, subscribePlantSprite } from '../../../shared/lib/plantSprite'
import { Breadcrumbs, EmptyState } from '../../../shared/ui/platform/PlatformUI'
import { LOADING_MESSAGES } from '../../../shared/config/loadingAnimation'
import { LoadingBoundary } from '../../../shared/ui/loading/LoadingBoundary'
import './InvestmentDetailPage.css'

function InvestmentDetailContent({ investment }: { investment: InvestmentDetail }) {
  const timing = getProjectAnimationTiming(investment.project.progress)
  // This content is keyed by investment.id. Construction updates must not
  // restart unchanged financial counters after their entrance animation.
  const [entryTiming] = useState(timing)
  const progress = useAnimatedProgress(investment.project.progress, timing)
  const amounts = investment.investment

  return (
    <>
      <Breadcrumbs items={[{ label: 'Mis inversiones', to: '/mis-inversiones' }, { label: investment.projectName }]} />
      <header className="investment-detail__heading">
        <h1>{investment.projectName}</h1>
        <p>{investment.company.name}</p>
      </header>
      <InvestmentHero company={investment.company} progress={investment.project.progress} />
      <div className="metrics-grid investment-detail__metrics">
        <AnimatedMetric label="Monto original" value={amounts.originalAmount} icon={CircleDollarSign} {...entryTiming} />
        <AnimatedMetric label="Retorno estimado" value={amounts.estimatedReturn} icon={TrendingUp} tone="blue" {...entryTiming} />
        <AnimatedMetric label="Total estimado" value={amounts.estimatedTotal} icon={ReceiptText} tone="peach" {...entryTiming} />
        <AnimatedMetric label="Pendiente" value={amounts.pendingAmount} icon={Clock3} tone="lavender" {...entryTiming} />
      </div>
      <div className="investment-detail__progress-row">
        <ProjectProgress progress={progress} />
        <BlockchainCard blockchain={investment.blockchain} />
      </div>
      <div className="investment-detail__information-row">
        <PaymentScheduleCard nextPayment={investment.nextPayment} payments={investment.paymentSchedule} />
        <DocumentationCard investment={investment} />
      </div>
    </>
  )
}

export function InvestmentDetailPage() {
  const { investmentId, id } = useParams()
  const { investment, isLoading, error } = useInvestmentDetail(investmentId ?? id ?? '')
  const plantAsset = useSyncExternalStore(subscribePlantSprite, getPlantSpriteState, () => 'idle')
  // Decode while the beaver loader is visible, so the first growth frame and
  // the existing counters start together when the detail content mounts.
  useEffect(() => { void preloadPlantSprite() }, [])

  return (
    <LoadingBoundary isLoading={isLoading || plantAsset === 'idle' || plantAsset === 'loading'} message={LOADING_MESSAGES.investment}>
      <main className="app-page page-shell investment-detail" id="main-content">
        {error ? <EmptyState title="No pudimos cargar la inversión" description={error} actionLabel="Volver a mis inversiones" actionTo="/mis-inversiones" />
          : investment ? <InvestmentDetailContent key={investment.id} investment={investment} />
            : <EmptyState title="Inversión no encontrada" description="No existe una inversión con este identificador." actionLabel="Volver a mis inversiones" actionTo="/mis-inversiones" />}
      </main>
    </LoadingBoundary>
  )
}
