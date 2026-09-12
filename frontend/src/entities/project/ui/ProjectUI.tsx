import type { ReactNode } from 'react'
import { ArrowRight, Check, CheckCircle2, ChevronDown, Circle, Clock3, Copy, FileCheck2, ShieldCheck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EvidenceViewModel, MilestoneViewModel, ProjectActivityViewModel, ProjectViewModel } from '../model/project.types'
import { PROJECT_STATUS_LABELS } from '../model/projectStatus'
import { formatBps, formatDate, formatUSDT } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui/button/Button'
import { FundingProgress } from '../../../shared/ui/funding-progress/FundingProgress'
import { StatusBadge } from '../../../shared/ui/platform/PlatformUI'
import './ProjectUI.css'

export function ProjectStatusBadge({ status }: { status: ProjectViewModel['status'] }) {
  return <StatusBadge status={status} label={PROJECT_STATUS_LABELS[status]} />
}

export function MoneyDisplay({ value, label, emphasis = false }: { value: string; label?: string; emphasis?: boolean }) {
  return <div className={emphasis ? 'money-display money-display--emphasis' : 'money-display'}>{label && <span>{label}</span>}<strong>{formatUSDT(value)}</strong></div>
}

function projectAction(project: ProjectViewModel) {
  if (project.status === 'DRAFT') return 'Continuar'
  if (project.status === 'CHANGES_REQUESTED') return 'Resolver cambios'
  if (['SUBMITTED', 'UNDER_REVIEW'].includes(project.status)) return 'Ver revisión'
  return 'Ver proyecto'
}

export function ProjectCard({ project }: { project: ProjectViewModel }) {
  const nextMilestone = project.milestones.find((milestone) => milestone.status !== 'COMPLETED')
  return (
    <article className="project-card">
      <header><div><h2>{project.name}</h2><p>{project.location}</p></div><ProjectStatusBadge status={project.status} /></header>
      {project.status === 'DRAFT' ? (
        <div className="project-card__draft"><span>Propuesta en preparación</span><strong>{project.completionPercentage} % completado</strong><FundingProgress percentage={project.completionPercentage} label="Completitud" /></div>
      ) : ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(project.status) ? (
        <div className="project-card__review"><span>{project.status === 'CHANGES_REQUESTED' ? 'Hay observaciones pendientes' : 'Propuesta enviada'}</span><strong>{formatDate(project.submittedAt)}</strong></div>
      ) : (
        <div className="project-card__funding"><p><strong>{formatUSDT(project.funding.raised)}</strong><span> de {formatUSDT(project.funding.target)}</span></p><FundingProgress percentage={project.funding.percentage} valueLabel={`${project.funding.percentage} % financiado`} /></div>
      )}
      {nextMilestone && project.status !== 'DRAFT' && <div className="project-card__milestone"><span>Próximo hito</span><strong>{nextMilestone.title}</strong></div>}
      <Link className="project-card__action" to={`/company/projects/${project.id}`}>{projectAction(project)} <ArrowRight /></Link>
    </article>
  )
}

const milestoneLabels: Record<MilestoneViewModel['status'], string> = {
  COMPLETED: 'Completado', UNDER_REVIEW: 'En revisión', ACTIVE: 'En curso', PENDING: 'Pendiente', REJECTED: 'Rechazado',
}

export function EvidenceList({ evidence, onUpload, onView }: { evidence: EvidenceViewModel[]; onUpload?: () => void; onView?: (evidence: EvidenceViewModel) => void }) {
  const complete = evidence.filter((item) => item.status === 'COMPLETE').length
  return (
    <div className="evidence-list">
      <div className="evidence-list__heading"><div><strong>Evidencia requerida</strong><span>{complete} de {evidence.length} documentos completos</span></div>{onUpload && complete < evidence.length && <Button variant="secondary" onClick={onUpload}>Subir evidencia</Button>}</div>
      <div className="evidence-list__items">{evidence.map((item) => <button type="button" key={item.id} disabled={!onView} onClick={() => onView?.(item)}>{item.status === 'COMPLETE' ? <Check /> : <Circle />}<span><strong>{item.name}</strong><small>{item.kind}{item.uploadedAt ? ` · ${formatDate(item.uploadedAt)}` : ''}</small></span>{item.status === 'COMPLETE' && onView && <b>Ver</b>}</button>)}</div>
    </div>
  )
}

export function MilestoneCard({ milestone, isLast, onUpload, onView }: { milestone: MilestoneViewModel; isLast?: boolean; onUpload?: () => void; onView?: (evidence: EvidenceViewModel) => void }) {
  return (
    <article className={`milestone-card milestone-card--${milestone.status.toLowerCase()}`}>
      <div className="milestone-card__rail"><span>{milestone.status === 'COMPLETED' ? <Check /> : milestone.status === 'UNDER_REVIEW' || milestone.status === 'ACTIVE' ? <Circle /> : <Circle />}</span>{!isLast && <i />}</div>
      <div className="milestone-card__content">
        <header><div><h3>{milestone.title}</h3><p>{milestone.description}</p></div><StatusBadge status={milestone.status} label={milestoneLabels[milestone.status]} /></header>
        <div className="milestone-card__meta"><span>Fecha límite <strong>{formatDate(milestone.dueDate)}</strong></span><span>{milestone.status === 'COMPLETED' ? 'Liberado' : 'Asignado al hito'} <strong>{formatUSDT(milestone.releaseAmount)}</strong></span></div>
        <EvidenceList evidence={milestone.evidence} onUpload={milestone.status === 'UNDER_REVIEW' || milestone.status === 'ACTIVE' ? onUpload : undefined} onView={onView} />
      </div>
    </article>
  )
}

export function MilestoneTimeline({ milestones, onUpload, onView }: { milestones: MilestoneViewModel[]; onUpload?: (milestone: MilestoneViewModel) => void; onView?: (evidence: EvidenceViewModel) => void }) {
  return <div className="milestone-timeline">{milestones.map((milestone, index) => <MilestoneCard key={milestone.id} milestone={milestone} isLast={index === milestones.length - 1} onUpload={() => onUpload?.(milestone)} onView={onView} />)}</div>
}

export function ActivityTimeline({ items }: { items: ProjectActivityViewModel[] }) {
  return <div className="activity-timeline">{items.map((item) => <article key={item.id}><span className={`activity-timeline__dot activity-timeline__dot--${item.tone ?? 'neutral'}`} /><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{formatDate(item.date)}</time></article>)}</div>
}

export function VerificationStatus({ status, title = 'Verificación empresarial' }: { status: string; title?: string }) {
  const verified = status === 'VERIFIED'
  return <div className="verification-status"><span>{verified ? <ShieldCheck /> : <Clock3 />}</span><div><small>{title}</small><strong>{verified ? 'Verificada' : 'Pendiente'}</strong></div><StatusBadge status={status} label={verified ? 'Verificada' : 'En proceso'} /></div>
}

export function WalletSummary({ address, balance, network, connected, movements }: { address: string; balance: string; network: string; connected: boolean; movements?: ReactNode }) {
  return <div className="wallet-summary"><div className="wallet-summary__icon"><Wallet /></div><div className="wallet-summary__identity"><span>Wallet de la empresa</span><code>{address}</code></div><MoneyDisplay label="Saldo" value={balance} emphasis /><dl><div><dt>Red</dt><dd>{network}</dd></div><div><dt>Estado</dt><dd><StatusBadge status={connected ? 'VERIFIED' : 'PENDING'} label={connected ? 'Conectada' : 'Sin conectar'} /></dd></div></dl>{movements}</div>
}

function shorten(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}

export function TechnicalDetails({ items }: { items: ProjectViewModel['technical'] }) {
  return (
    <details className="technical-details">
      <summary><span><ChevronDown /></span>Detalles técnicos</summary>
      <dl>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd><code title={item.value}>{shorten(item.value)}</code>{item.copyable && <button type="button" aria-label={`Copiar ${item.label}`} onClick={() => void navigator.clipboard?.writeText(item.value)}><Copy /></button>}</dd></div>)}</dl>
    </details>
  )
}

export function FundingOverview({ project }: { project: ProjectViewModel }) {
  return <div className="funding-overview"><div className="funding-overview__metrics"><MoneyDisplay label="Recaudado" value={project.funding.raised} /><MoneyDisplay label="Desembolsado" value={project.funding.released} /><MoneyDisplay label="Fondos protegidos" value={project.funding.protected} emphasis /></div><div className="funding-bars"><FundingBar label="Recaudado" value={project.funding.raised} target={project.funding.target} /><FundingBar label="Desembolsado" value={project.funding.released} target={project.funding.target} /><FundingBar label="Protegido" value={project.funding.protected} target={project.funding.target} emphasized /></div></div>
}

function FundingBar({ label, value, target, emphasized }: { label: string; value: string; target: string; emphasized?: boolean }) {
  const percentage = BigInt(target) === 0n ? 0 : Number(BigInt(value) * 100n / BigInt(target))
  return <div className={emphasized ? 'funding-bar funding-bar--emphasis' : 'funding-bar'}><div><span>{label}</span><strong>{formatUSDT(value)}</strong></div><i><b style={{ width: `${Math.min(100, percentage)}%` }} /></i></div>
}

export function TermsSummary({ project }: { project: ProjectViewModel }) {
  return <dl className="terms-summary"><div><dt>Retorno anual</dt><dd>{formatBps(project.terms.annualReturnBps)}</dd></div><div><dt>Plazo</dt><dd>{project.terms.durationMonths} meses</dd></div><div><dt>Repago</dt><dd>{project.terms.repayment}</dd></div><div><dt>Riesgo</dt><dd>{project.terms.risk}</dd></div></dl>
}

export function DocumentList({ project, onView, onDownload }: { project: ProjectViewModel; onView: (name: string) => void; onDownload: (name: string) => void }) {
  return <div className="project-document-list">{project.documents.map((document) => <article key={document.id}><span><FileCheck2 /></span><div><strong>{document.name}</strong><p>{document.category} · {document.type} · {formatDate(document.date)}</p></div><StatusBadge status={document.status} /><div><button type="button" onClick={() => onView(document.name)}>Ver</button><button type="button" onClick={() => onDownload(document.name)}>Descargar</button></div></article>)}</div>
}

export function ProtectedFundsCallout({ amount }: { amount: string }) {
  return <div className="protected-funds-callout"><span><ShieldCheck /></span><div><small>Fondos protegidos</small><strong>{formatUSDT(amount)}</strong><p>Permanece reservado hasta que se verifique el próximo hito.</p></div><CheckCircle2 /></div>
}
