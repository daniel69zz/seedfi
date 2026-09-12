import { useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CircleDollarSign, TrendingUp, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDemo } from '../../../features/demo/model/DemoContext'
import type { Investment } from '../../../shared/types/platform.types'
import { formatDate, formatPercent, formatUsd } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui/button/Button'
import { EmptyState, MetricCard, PageHeader, ProgressMeter, SectionCard, StatusBadge, Tabs } from '../../../shared/ui/platform/PlatformUI'
import './InvestorPages.css'

type InvestmentTab = 'ALL' | Investment['status']

export function InvestmentsPage() {
  const { investments } = useDemo()
  const [tab, setTab] = useState<InvestmentTab>('ALL')
  const filtered = tab === 'ALL' ? investments : investments.filter((item) => item.status === tab)
  const activeCapital = investments.filter((item) => item.status === 'ACTIVE' || item.status === 'PENDING').reduce((sum, item) => sum + item.amount, 0)
  const received = investments.reduce((sum, item) => sum + item.earningsReceived, 0)
  return <main className="app-page page-shell" id="main-content"><PageHeader eyebrow="PORTAFOLIO ACTIVO" title="Mis inversiones" description="Consulta estado, retorno, pagos y avance de cada proyecto." actions={<Button to="/opportunities">Explorar oportunidades <ArrowRight size={18} /></Button>} /><div className="metrics-grid"><MetricCard label="Capital activo" value={formatUsd(activeCapital, true)} icon={BriefcaseBusiness} /><MetricCard label="Inversiones" value={String(investments.length)} detail={`${investments.filter((item) => item.status === 'ACTIVE').length} activas`} icon={WalletCards} tone="blue" /><MetricCard label="Ganancia recibida" value={formatUsd(received, true)} icon={TrendingUp} tone="peach" /><MetricCard label="Capital recuperado" value={formatUsd(investments.reduce((sum, item) => sum + item.capitalRecovered, 0), true)} icon={CircleDollarSign} tone="lavender" /></div><SectionCard><Tabs value={tab} onChange={setTab} label="Estado de inversiones" options={[{ value: 'ALL', label: 'Todas' }, { value: 'ACTIVE', label: 'Activas' }, { value: 'PENDING', label: 'Pendientes' }, { value: 'COMPLETED', label: 'Completadas' }, { value: 'DEFAULTED', label: 'Incumplidas' }]} />{filtered.length ? <div className="investment-list">{filtered.map((investment) => <article key={investment.id}><div className="investment-list__heading"><div><span>{investment.companyName}</span><h2>{investment.projectName}</h2></div><StatusBadge status={investment.status} /></div><dl><div><dt>Monto invertido</dt><dd>{formatUsd(investment.amount, true)}</dd></div><div><dt>Retorno estimado</dt><dd>{formatPercent(investment.expectedApy)}</dd></div><div><dt>Fecha</dt><dd>{formatDate(investment.investedAt)}</dd></div><div><dt>Próximo pago</dt><dd>{formatDate(investment.nextPayment)}</dd></div></dl><ProgressMeter value={investment.projectProgress} label="Avance del proyecto" compact /><Link to={`/investor/investments/${investment.id}`}>Ver detalle <ArrowRight size={16} /></Link></article>)}</div> : <EmptyState title="Sin inversiones en este estado" description="Cambia de pestaña o explora nuevas oportunidades." actionLabel="Explorar oportunidades" actionTo="/opportunities" />}</SectionCard></main>
}
