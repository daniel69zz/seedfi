import { useMemo, useState } from 'react'
import { ArrowLeft, Blocks, Building2, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, FileText, Landmark, MapPin, SearchX, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { InvestmentFlow } from '../../../features/invest-opportunity/ui/InvestmentFlow'
import { useToast } from '../../../features/toast/model/ToastContext'
import { OpportunityBadges } from '../../../entities/opportunity/ui/OpportunityCard'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { proposalToOpportunity } from '../../../shared/data/proposalToOpportunity'
import { formatDate, formatPercent, formatUsd } from '../../../shared/lib/format'
import { BusinessImage } from '../../../shared/ui/business-image/BusinessImage'
import { Button } from '../../../shared/ui/button/Button'
import { Breadcrumbs, DocumentCard, InfoGrid, ProgressMeter, SectionCard, StatusBadge } from '../../../shared/ui/platform/PlatformUI'
import './OpportunityDetailPage.css'

const riskLabels = { low: 'Bajo', medium: 'Medio', high: 'Alto' } as const

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { proposals } = useDemo()
  const { notify } = useToast()
  const opportunity = useMemo(() => opportunities.find((item) => item.id === id) ?? proposals.filter((proposal) => proposal.status === 'PUBLISHED').map(proposalToOpportunity).find((item) => item.id === id), [id, proposals])
  const [simulationAmount, setSimulationAmount] = useState(opportunity?.minimumInvestment ?? 1000)

  if (!opportunity) {
    return <main className="section-placeholder page-shell" id="main-content"><section className="section-placeholder__card"><span className="section-placeholder__icon"><SearchX /></span><p className="section-placeholder__eyebrow">OPORTUNIDAD</p><h1>Proyecto no encontrado</h1><p className="section-placeholder__description">La oportunidad no existe o dejó de estar publicada.</p><Button to="/opportunities"><ArrowLeft size={18} /> Ver oportunidades</Button></section></main>
  }

  const remaining = opportunity.fundingRequested - opportunity.fundedAmount
  const estimatedReturn = simulationAmount * opportunity.expectedApy / 100 * opportunity.durationMonths / 12

  return (
    <main className="opportunity-detail page-shell" id="main-content">
      <Breadcrumbs items={[{ label: 'Oportunidades', to: '/opportunities' }, { label: opportunity.category, to: `/opportunities?category=${encodeURIComponent(opportunity.category)}` }, { label: opportunity.projectName }]} />

      <section className="opportunity-detail__hero">
        <div className="opportunity-detail__identity">
          <OpportunityBadges opportunity={opportunity} />
          <div className="opportunity-detail__business"><BusinessImage business={opportunity.business} size="detail" /><div><p>{opportunity.business.name}</p><h1>{opportunity.projectName}</h1><span><MapPin size={16} /> {opportunity.location} · {opportunity.projectType}</span></div></div>
          <p className="opportunity-detail__description">{opportunity.description}</p>
          <div className="opportunity-detail__quick"><span><CheckCircle2 /> Información verificada</span><span><Users /> {opportunity.investorCount} inversionistas</span><span><ShieldCheck /> Riesgo {riskLabels[opportunity.risk]}</span></div>
        </div>
        <aside className="opportunity-detail__funding">
          <div className="opportunity-detail__amount"><span>Capital recaudado</span><strong>{formatUsd(opportunity.fundedAmount, true)}</strong><small>de {formatUsd(opportunity.fundingRequested, true)}</small></div>
          <ProgressMeter value={opportunity.fundedPercentage} label={`${formatUsd(remaining, true)} restantes`} />
          <div className="opportunity-detail__stats"><p><TrendingUp /><span>APY estimado<strong>{formatPercent(opportunity.expectedApy)}</strong></span></p><p><Clock3 /><span>Duración<strong>{opportunity.durationMonths} meses</strong></span></p><p><CircleDollarSign /><span>Inversión mínima<strong>{formatUsd(opportunity.minimumInvestment, true)}</strong></span></p></div>
          <InvestmentFlow opportunity={opportunity} />
        </aside>
      </section>

      <nav className="opportunity-detail__nav" aria-label="Secciones de la oportunidad"><a href="#resumen">Resumen</a><a href="#empresa">Empresa</a><a href="#fondos">Uso de fondos</a><a href="#cronograma">Cronograma</a><a href="#garantias">Garantías</a><a href="#documentos">Documentos</a><a href="#riesgos">Riesgos</a><a href="#blockchain">Blockchain</a></nav>

      <div className="opportunity-detail__layout">
        <div className="stack">
          <SectionCard title="Objetivo del proyecto" description="Por qué existe y qué busca financiar" className="detail-anchor" ><div id="resumen" className="detail-anchor__target" /><p className="detail-body">{opportunity.story}</p><InfoGrid items={[{ label: 'Estado', value: <StatusBadge status={opportunity.status} /> }, { label: 'Inicio estimado', value: formatDate(opportunity.startDate) }, { label: 'Devolución estimada', value: formatDate(opportunity.expectedReturnDate) }, { label: 'Capital faltante', value: formatUsd(remaining, true) }, { label: 'Inversionistas', value: opportunity.investorCount }, { label: 'Riesgo general', value: riskLabels[opportunity.risk] }]} /></SectionCard>

          <SectionCard title="Sobre la empresa" description="Información principal de la solicitante" className="detail-anchor"><div id="empresa" className="detail-anchor__target" /><div className="company-summary"><span><Building2 size={28} /></span><div><h3>{opportunity.business.name}</h3><p>Empresa boliviana ficticia con experiencia en {opportunity.category.toLocaleLowerCase('es')}. La información empresarial y documental se presenta con fines de demostración.</p></div><StatusBadge status={opportunity.verified ? 'VERIFIED' : 'UNDER_REVIEW'} label={opportunity.verified ? 'Empresa verificada' : 'En revisión'} /></div><InfoGrid items={[{ label: 'Sector', value: opportunity.category }, { label: 'Ciudad', value: opportunity.location }, { label: 'Proyecto', value: opportunity.projectType }]} /></SectionCard>

          <SectionCard title="Uso de los fondos" description="Distribución declarada del capital solicitado" className="detail-anchor"><div id="fondos" className="detail-anchor__target" /><div className="fund-use-list">{opportunity.fundUse.map((item) => <div key={item.label}><p><span>{item.label}</span><strong>{item.percentage}% · {formatUsd(opportunity.fundingRequested * item.percentage / 100, true)}</strong></p><ProgressMeter value={item.percentage} compact /></div>)}</div></SectionCard>

          <SectionCard title="Cronograma y avance" description="Los milestones sirven para seguimiento y transparencia" className="detail-anchor"><div id="cronograma" className="detail-anchor__target" /><div className="milestone-list">{opportunity.milestones.map((milestone, index) => <article key={milestone.id}><span className="milestone-list__line" /><span className={`milestone-list__dot milestone-list__dot--${milestone.status.toLowerCase().replace(' ', '-')}`}>{index + 1}</span><div><header><h3>{milestone.title}</h3><StatusBadge status={milestone.status} /></header><p>{milestone.description}</p><small><CalendarDays size={13} /> {formatDate(milestone.date)}</small><ProgressMeter value={milestone.progress} compact /></div></article>)}</div></SectionCard>

          <SectionCard title="Garantías" description="Respaldos declarados y estado de validación" className="detail-anchor"><div id="garantias" className="detail-anchor__target" /><div className="guarantee-grid">{opportunity.guarantees.map((guarantee) => <article key={guarantee.id}><span><Landmark size={23} /></span><header><h3>{guarantee.type}</h3><StatusBadge status={guarantee.status} /></header><p>{guarantee.description}</p><dl><div><dt>Valor declarado</dt><dd>{formatUsd(guarantee.declaredValue, true)}</dd></div><div><dt>Documento</dt><dd>{guarantee.documentName}</dd></div></dl><button type="button" onClick={() => notify(`Vista mock abierta: ${guarantee.documentName}`)}><FileText size={15} /> Ver respaldo</button></article>)}</div></SectionCard>

          <SectionCard title="Documentación" description="Archivos revisados para la publicación" className="detail-anchor"><div id="documentos" className="detail-anchor__target" /><div className="document-list">{opportunity.documents.map((document) => <DocumentCard key={document.id} {...document} onView={() => notify(`Vista mock abierta: ${document.name}`)} onDownload={() => notify(`Descarga mock preparada: ${document.name}`)} />)}</div></SectionCard>

          <SectionCard title="Riesgos" description={`Riesgo general: ${riskLabels[opportunity.risk]}`} className="detail-anchor"><div id="riesgos" className="detail-anchor__target" /><div className="risk-summary"><ShieldCheck size={28} /><div><strong>¿Por qué tiene este nivel?</strong><p>{opportunity.riskRationale}</p></div></div><div className="risk-list">{opportunity.riskFactors.map((factor) => <article key={factor.label}><header><h3>{factor.label}</h3><StatusBadge status={factor.level} label={riskLabels[factor.level]} /></header><p>{factor.explanation}</p></article>)}</div><p className="risk-disclaimer">Consulta toda la documentación antes de invertir. Ningún proyecto está libre de riesgo.</p></SectionCard>

          <SectionCard title="Vault y transparencia blockchain" description="Infraestructura mock explicada sin tecnicismos" className="detail-anchor"><div id="blockchain" className="detail-anchor__target" /><div className="vault-heading"><span><Blocks size={29} /></span><div><h3>{opportunity.vault.status}</h3><p>El vault representa el registro de fondos y condiciones del proyecto.</p></div><StatusBadge status={opportunity.vault.status} /></div><InfoGrid items={[{ label: 'Red', value: opportunity.vault.network }, { label: 'Contrato', value: <code>{opportunity.vault.address}</code> }, { label: 'Fondos bloqueados', value: formatUsd(opportunity.vault.lockedFunds, true) }, { label: 'Fondos liberados', value: formatUsd(opportunity.vault.releasedFunds, true) }, { label: 'Inversiones registradas', value: opportunity.vault.transactionCount }, { label: 'Último hash', value: <code>{opportunity.vault.transactionHash}</code> }]} /><Button variant="secondary" onClick={() => notify('Explorador blockchain mock abierto')}>Ver en explorador <Blocks size={17} /></Button></SectionCard>
        </div>

        <aside className="opportunity-detail__aside stack">
          <SectionCard title="Simula tu retorno" description="Cálculo orientativo, no garantizado"><label className="field"><span>Si inviertes</span><div className="simulator-input"><input type="number" min={opportunity.minimumInvestment} max={opportunity.maximumInvestment} value={simulationAmount} onChange={(event) => setSimulationAmount(Number(event.target.value))} /><b>USDT</b></div></label><dl className="simulator-result"><div><dt>Capital</dt><dd>{formatUsd(simulationAmount, true)}</dd></div><div><dt>Retorno estimado</dt><dd>{formatUsd(estimatedReturn, true)}</dd></div><div><dt>Total estimado</dt><dd>{formatUsd(simulationAmount + estimatedReturn, true)}</dd></div></dl><p className="simulator-note">Estimación calculada con {formatPercent(opportunity.expectedApy)} durante {opportunity.durationMonths} meses.</p></SectionCard>
          <SectionCard title="Última actualización"><div className="project-update"><span><CheckCircle2 size={19} /></span><div><strong>Avance de estructura reportado</strong><p>La empresa registró evidencia y actualizó el progreso del proyecto.</p><small>8 de septiembre de 2026</small></div></div><ProgressMeter value={46} label="Avance físico" /></SectionCard>
          <SectionCard title="Información clave"><InfoGrid items={[{ label: 'Retorno', value: formatPercent(opportunity.expectedApy) }, { label: 'Duración', value: `${opportunity.durationMonths} meses` }, { label: 'Mínimo', value: formatUsd(opportunity.minimumInvestment, true) }, { label: 'Estado', value: opportunity.status }]} /></SectionCard>
        </aside>
      </div>
    </main>
  )
}
