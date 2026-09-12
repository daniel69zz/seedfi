import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CircleDollarSign, Sprout, TrendingUp } from 'lucide-react'
import investmentsHero from '../../../assets/illustrations/investments-hero.svg'
import { InvestmentCard } from '../../../entities/investment/ui/InvestmentCard'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { formatUsd } from '../../../shared/lib/format'
import type { Investment } from '../../../shared/types/platform.types'
import { Button } from '../../../shared/ui/button/Button'
import { EmptyState, MetricCard, SectionCard, Tabs } from '../../../shared/ui/platform/PlatformUI'
import './MyInvestmentsPage.css'

type InvestmentTab = 'ALL' | Investment['status']

const investmentTabs: Array<{ value: InvestmentTab; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'DEFAULTED', label: 'Incumplidas' },
]

export function InvestmentsPage() {
  const { investments } = useDemo()
  const [tab, setTab] = useState<InvestmentTab>('ALL')
  const filtered = tab === 'ALL' ? investments : investments.filter((item) => item.status === tab)
  const investedCapital = investments
    .filter((item) => item.status === 'ACTIVE' || item.status === 'PENDING')
    .reduce((sum, item) => sum + item.amount, 0)
  const earningsReceived = investments.reduce((sum, item) => sum + item.earningsReceived, 0)
  const recoveredCapital = investments.reduce((sum, item) => sum + item.capitalRecovered, 0)

  return (
    <main className="app-page page-shell my-investments" id="main-content">
      <header className="my-investments__hero">
        <img className="my-investments__illustration" src={investmentsHero} alt="" aria-hidden="true" />
        <h1>Mis inversiones</h1>
        <p>Tu capital impulsa un futuro más verde.</p>
        <div className="my-investments__explore">
          <Button to="/opportunities">Explorar oportunidades <ArrowRight size={21} aria-hidden="true" /></Button>
        </div>
      </header>

      <section className="metrics-grid my-investments__metrics" aria-label="Resumen de mis inversiones">
        <MetricCard label="Capital invertido" value={formatUsd(investedCapital, true)} icon={BriefcaseBusiness} />
        <MetricCard label="Inversiones" value={String(investments.length)} icon={Sprout} tone="blue" />
        <MetricCard label="Ganancia recibida" value={formatUsd(earningsReceived, true)} icon={TrendingUp} tone="peach" />
        <MetricCard label="Capital recuperado" value={formatUsd(recoveredCapital, true)} icon={CircleDollarSign} tone="lavender" />
      </section>

      <SectionCard className="my-investments__collection">
        <Tabs value={tab} onChange={setTab} label="Estado de inversiones" options={investmentTabs} />
        {filtered.length ? (
          <div className="my-investments__grid">
            {filtered.map((investment) => <InvestmentCard key={investment.id} investment={investment} />)}
          </div>
        ) : (
          <EmptyState
            title="Sin inversiones en este estado"
            description="Cambia de pestaña o explora nuevas oportunidades."
            actionLabel="Explorar oportunidades"
            actionTo="/opportunities"
          />
        )}
      </SectionCard>
    </main>
  )
}
