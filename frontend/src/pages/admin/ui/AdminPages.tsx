import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSignature,
  FolderKanban,
  Landmark,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Vault,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { useToast } from '../../../features/toast/model/ToastContext'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { companies, payments } from '../../../shared/data/platform.mock'
import { formatDate, formatPercent, formatUsd } from '../../../shared/lib/format'
import type { ProjectStatus } from '../../../shared/types/platform.types'
import { Button } from '../../../shared/ui/button/Button'
import { Breadcrumbs, DocumentCard, EmptyState, InfoGrid, MetricCard, PageHeader, ProgressMeter, SectionCard, StatusBadge, Tabs } from '../../../shared/ui/platform/PlatformUI'
import './AdminPages.css'

const adminStatusLabels: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviada', UNDER_REVIEW: 'En revisión', CHANGES_REQUESTED: 'Cambios solicitados', APPROVED: 'Aprobada', REJECTED: 'Rechazada', PUBLISHED: 'Publicada', FUNDING: 'Financiando', FUNDED: 'Financiada', ACTIVE: 'Activa', REPAYING: 'En pagos', COMPLETED: 'Completada', DEFAULTED: 'Incumplimiento',
}

export function AdminDashboardPage() {
  const { proposals } = useDemo()
  const pending = proposals.filter((proposal) => ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(proposal.status))
  return <AdminPage><PageHeader eyebrow="CENTRO DE OPERACIONES" title="Panel administrativo" description="Revisión, trazabilidad y operación de Seed 2 Deed." actions={<Button to="/admin/projects">Revisar proyectos <ArrowRight size={18} /></Button>} /><div className="metrics-grid"><MetricCard label="Empresas registradas" value="28" detail="4 requieren atención" icon={Building2} /><MetricCard label="Proyectos publicados" value="14" detail="6 en financiamiento" icon={FolderKanban} tone="blue" /><MetricCard label="Capital canalizado" value="3.84M USDT" detail="+12.8% este mes" icon={TrendingUp} tone="peach" /><MetricCard label="Alertas operativas" value="3" detail="1 pago vencido" icon={ShieldAlert} tone="lavender" /></div><div className="dashboard-grid"><SectionCard title=" refer Revisión prioritaria" description="Propuestas que requieren decisión"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Proyecto</th><th>Empresa</th><th>Prioridad</th><th>Estado</th><th /></tr></thead><tbody>{pending.map((proposal) => <tr key={proposal.id}><td><strong>{proposal.projectName}</strong><small>{formatUsd(proposal.fundingRequested, true)}</small></td><td>{proposal.companyName}</td><td><StatusBadge status={proposal.priority === 'Alta' ? 'LATE' : 'PENDING'} label={proposal.priority} /></td><td><StatusBadge status={proposal.status} label={adminStatusLabels[proposal.status]} /></td><td><Link className="table-link" to={`/admin/projects/${proposal.id}/review`}>Revisar</Link></td></tr>)}</tbody></table></div></SectionCard><div className="stack"><SectionCard title="Tareas del día"><div className="admin-task-list"><Link to="/admin/companies"><Building2 /><span><strong>2 KYB por validar</strong><small>Empresas nuevas</small></span><ArrowRight /></Link><Link to="/admin/payments"><BadgeDollarSign /><span><strong>1 pago vencido</strong><small>Requiere seguimiento</small></span><ArrowRight /></Link><Link to="/admin/guarantees"><Landmark /><span><strong>3 avalúos pendientes</strong><small>Garantías de proyectos</small></span><ArrowRight /></Link></div></SectionCard><SectionCard title="Salud de la plataforma"><div className="health-list"><p><span>Contratos activos</span><b>18</b></p><p><span>Bóvedas desplegadas</span><b>14/14</b></p><p><span>Pagos a tiempo</span><b>96.4%</b></p><ProgressMeter value={96} label="Cumplimiento operativo" /></div></SectionCard></div></div><div className="admin-bottom-grid"><SectionCard title="Flujo de capital"><div className="admin-chart" aria-label="Gráfico simulado de capital mensual">{[32, 47, 41, 58, 55, 72, 68, 86, 79, 94].map((height, index) => <span key={index} style={{ height: `${height}%` }} title={`${height * 5200} USDT`} />)}</div></SectionCard><SectionCard title="Actividad reciente"><div className="admin-activity"><p><CheckCircle2 /><span><strong>Pago distribuido</strong><small>Andes Solar · hace 18 min</small></span></p><p><FileCheck2 /><span><strong>Documento validado</strong><small>Urbania SRL · hace 44 min</small></span></p><p><ShieldCheck /><span><strong>KYB aprobado</strong><small>NovaCasa Bolivia · hoy</small></span></p></div></SectionCard></div></AdminPage>
}

export function AdminCompaniesPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Todos')
  const filtered = companies.filter((company) => `${company.name} ${company.representative} ${company.nit}`.toLowerCase().includes(query.toLowerCase()) && (status === 'Todos' || company.kybStatus === status))
  return <AdminPage><PageHeader eyebrow="CUMPLIMIENTO" title="Empresas" description="Verifica identidad empresarial, documentación y representantes." /><SectionCard><div className="admin-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por empresa, NIT o representante" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar estado KYB"><option>Todos</option><option value="VERIFIED">Verificadas</option><option value="UNDER_REVIEW">En revisión</option><option value="ACTION_REQUIRED">Requiere acción</option></select></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Empresa</th><th>Representante</th><th>Sector</th><th>Registro</th><th>KYB</th><th /></tr></thead><tbody>{filtered.map((company) => <tr key={company.id}><td><strong>{company.name}</strong><small>NIT {company.nit} · {company.city}</small></td><td>{company.representative}</td><td>{company.sector}</td><td>{formatDate(company.registeredAt)}</td><td><StatusBadge status={company.kybStatus} /></td><td><Link className="table-link" to={`/admin/companies/${company.id}`}>Revisar</Link></td></tr>)}</tbody></table></div></SectionCard></AdminPage>
}

export function AdminCompanyDetailPage() {
  const { id } = useParams()
  const { notify } = useToast()
  const [decision, setDecision] = useState<null | 'approve' | 'action' | 'reject'>(null)
  const company = companies.find((item) => item.id === id)
  if (!company) return <AdminPage><EmptyState title="Empresa no encontrada" description="El registro solicitado no existe." actionLabel="Volver a empresas" actionTo="/admin/companies" /></AdminPage>
  return <AdminPage><Breadcrumbs items={[{ label: 'Empresas', to: '/admin/companies' }, { label: company.name }]} /><PageHeader eyebrow="EXPEDIENTE EMPRESARIAL" title={company.name} description={`NIT ${company.nit} · ${company.city}`} actions={<StatusBadge status={company.kybStatus} />} /><div className="dashboard-grid"><div className="stack"><SectionCard title="Información legal"><InfoGrid items={[{ label: 'Razón social', value: company.name }, { label: 'NIT', value: company.nit }, { label: 'Ciudad', value: company.city }, { label: 'Sector', value: company.sector }, { label: 'Representante', value: company.representative }, { label: 'Registro', value: formatDate(company.registeredAt) }]} /></SectionCard><SectionCard title="Documentos KYB"><div className="document-list">{['Matrícula de comercio', 'Registro tributario', 'Poder del representante', 'Estado financiero'].map((name) => <DocumentCard key={name} name={name} type="PDF" date={company.registeredAt} status={name === 'Estado financiero' ? 'En revisión' : 'Validado'} onView={() => notify(`${name}: vista previa mock`)} onDownload={() => notify('Descarga mock preparada')} />)}</div></SectionCard><SectionCard title="Historial de revisión"><div className="review-timeline"><p><b /><span><strong>Registro recibido</strong><small>{formatDate(company.registeredAt)}</small></span></p><p><b /><span><strong>Identidad del representante validada</strong><small>Control mock completado</small></span></p><p><b /><span><strong>Revisión documental en curso</strong><small>Asignada a Mariana Rojas</small></span></p></div></SectionCard></div><div className="stack"><SectionCard title="Evaluación KYB"><div className="verification-score"><ShieldCheck /><strong>86/100</strong><span>Índice interno de completitud</span></div><div className="checklist"><p><CheckCircle2 /> Identidad y representación</p><p><CheckCircle2 /> Registro tributario</p><p><CheckCircle2 /> Domicilio declarado</p><p><Clock3 /> Estados financieros</p></div></SectionCard><SectionCard title="Tomar decisión"><div className="decision-actions"><Button onClick={() => setDecision('approve')}><CheckCircle2 /> Aprobar empresa</Button><Button variant="secondary" onClick={() => setDecision('action')}>Solicitar información</Button><Button variant="danger" onClick={() => setDecision('reject')}><XCircle /> Rechazar</Button></div></SectionCard></div></div>{decision && <DecisionModal title={decision === 'approve' ? 'Aprobar empresa' : decision === 'reject' ? 'Rechazar empresa' : 'Solicitar información'} confirmLabel="Confirmar decisión" danger={decision === 'reject'} onClose={() => setDecision(null)} onConfirm={() => { notify('Decisión KYB registrada en la demo'); setDecision(null) }} />}</AdminPage>
}

type AdminProjectTab = 'Todos' | 'Pendientes' | 'Publicados' | 'Cerrados'

export function AdminProjectsPage() {
  const { proposals } = useDemo()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<AdminProjectTab>('Todos')
  const [query, setQuery] = useState(() => searchParams.get('query') ?? '')
  const filtered = proposals.filter((project) => `${project.projectName} ${project.companyName}`.toLowerCase().includes(query.toLowerCase()) && (tab === 'Todos' || (tab === 'Pendientes' && ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(project.status)) || (tab === 'Publicados' && ['PUBLISHED', 'FUNDING', 'FUNDED', 'ACTIVE', 'REPAYING'].includes(project.status)) || (tab === 'Cerrados' && ['COMPLETED', 'REJECTED', 'DEFAULTED'].includes(project.status))))
  return <AdminPage><PageHeader eyebrow="ORIGINACIÓN" title="Proyectos y propuestas" description="Administra el ciclo completo desde la recepción hasta el cierre." /><SectionCard><Tabs value={tab} label="Estado de proyectos" options={['Todos', 'Pendientes', 'Publicados', 'Cerrados'].map((value) => ({ value: value as AdminProjectTab, label: value }))} onChange={setTab} /><div className="admin-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proyecto o empresa" /></label><span>{filtered.length} resultados</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Proyecto</th><th>Empresa</th><th>Monto</th><th>Retorno</th><th>Estado</th><th /></tr></thead><tbody>{filtered.map((project) => <tr key={project.id}><td><strong>{project.projectName}</strong><small>{project.category} · {project.location}</small></td><td>{project.companyName}</td><td>{formatUsd(project.fundingRequested, true)}</td><td>{formatPercent(project.expectedApy)}</td><td><StatusBadge status={project.status} label={adminStatusLabels[project.status]} /></td><td><Link className="table-link" to={`/admin/projects/${project.id}/review`}>Abrir expediente</Link></td></tr>)}</tbody></table></div></SectionCard></AdminPage>
}

export function AdminProjectReviewPage() {
  const { id } = useParams()
  const { proposals, updateProposalStatus } = useDemo()
  const { notify } = useToast()
  const [tab, setTab] = useState<'Evaluación' | 'Documentos' | 'Garantía' | 'Contrato'>('Evaluación')
  const [decision, setDecision] = useState<null | ProjectStatus>(null)
  const project = proposals.find((item) => item.id === id)
  if (!project) return <AdminPage><EmptyState title="Proyecto no encontrado" description="El expediente solicitado no existe." actionLabel="Volver a proyectos" actionTo="/admin/projects" /></AdminPage>
  const projectId = project.id
  function commitDecision() { if (!decision) return; updateProposalStatus(projectId, decision); notify(`Proyecto actualizado a ${adminStatusLabels[decision]}`); setDecision(null) }
  return <AdminPage><Breadcrumbs items={[{ label: 'Proyectos', to: '/admin/projects' }, { label: project.projectName }]} /><PageHeader eyebrow="REVISIÓN DE PROYECTO" title={project.projectName} description={`${project.companyName} · ${formatUsd(project.fundingRequested, true)}`} actions={<StatusBadge status={project.status} label={adminStatusLabels[project.status]} />} /><div className="review-scorebar"><div><strong>82/100</strong><span>Puntaje preliminar</span></div><p><span>Empresa <b>92</b></span><span>Proyecto <b>81</b></span><span>Garantía <b>76</b></span><span>Documentos <b>84</b></span></p></div><Tabs value={tab} label="Expediente del proyecto" options={['Evaluación', 'Documentos', 'Garantía', 'Contrato'].map((value) => ({ value: value as typeof tab, label: value }))} onChange={setTab} />{tab === 'Evaluación' && <div className="dashboard-grid"><div className="stack"><SectionCard title="Datos de la propuesta"><InfoGrid items={[{ label: 'Tipo', value: project.projectType }, { label: 'Categoría', value: project.category }, { label: 'Ubicación', value: project.location }, { label: 'Retorno estimado', value: formatPercent(project.expectedApy) }, { label: 'Plazo', value: `${project.durationMonths} meses` }, { label: 'Inversión mínima', value: formatUsd(project.minimumInvestment, true) }]} /><p className="review-description">{project.description}</p></SectionCard><SectionCard title="Destino del capital"><div className="fund-use-list">{project.fundUse.map((item) => <p key={item.label}><span>{item.label}</span><b>{item.percentage}%</b><i style={{ width: `${item.percentage}%` }} /></p>)}</div></SectionCard><SectionCard title="Lista de validación"><div className="review-check-grid"><label><input type="checkbox" defaultChecked /> Mercado y demanda sustentados</label><label><input type="checkbox" defaultChecked /> Flujo financiero consistente</label><label><input type="checkbox" /> Permisos críticos confirmados</label><label><input type="checkbox" defaultChecked /> Cronograma viable</label><label><input type="checkbox" /> Seguro o cobertura confirmada</label><label><input type="checkbox" defaultChecked /> Uso de fondos completo</label></div></SectionCard></div><div className="stack"><SectionCard title="Riesgos detectados"><div className="risk-admin-list"><p><AlertTriangle /><span><strong>Riesgo de ejecución</strong><small>Dependencia de permisos municipales.</small></span><StatusBadge status="MEDIO" /></p><p><ShieldAlert /><span><strong>Cobertura de garantía</strong><small>Avalúo cubre 1.28x el capital.</small></span><StatusBadge status="BAJO" /></p></div></SectionCard><SectionCard title="Notas internas"><textarea className="admin-notes" defaultValue={project.reviewerNotes.join('\n')} aria-label="Notas internas" /><Button variant="secondary" onClick={() => notify('Notas internas guardadas')}>Guardar notas</Button></SectionCard><SectionCard title="Decisión"><div className="decision-actions"><Button onClick={() => setDecision(project.status === 'APPROVED' ? 'PUBLISHED' : 'APPROVED')}><CheckCircle2 /> {project.status === 'APPROVED' ? 'Publicar' : 'Aprobar'}</Button><Button variant="secondary" onClick={() => setDecision('CHANGES_REQUESTED')}>Solicitar cambios</Button><Button variant="danger" onClick={() => setDecision('REJECTED')}><XCircle /> Rechazar</Button></div></SectionCard></div></div>}{tab === 'Documentos' && <SectionCard title="Documentación del expediente"><div className="document-list">{['Plan de negocio', 'Estados financieros', 'Cronograma', 'Presupuesto', 'Permisos municipales'].map((name, index) => <DocumentCard key={name} name={name} type="PDF" date={project.submittedAt} status={index === 4 ? 'En revisión' : 'Validado'} onView={() => notify(`${name}: vista previa mock`)} onDownload={() => notify('Descarga mock preparada')} />)}</div></SectionCard>}{tab === 'Garantía' && <SectionCard title="Garantía propuesta"><div className="guarantee-review"><Landmark /><div><h2>{project.guarantee}</h2><p>Valor comercial estimado: {formatUsd(project.fundingRequested * 1.28, true)} · cobertura 1.28x.</p><StatusBadge status="UNDER_REVIEW" label="Avalúo en revisión" /></div></div><InfoGrid items={[{ label: 'Titular', value: project.companyName }, { label: 'Tipo de respaldo', value: project.guarantee }, { label: 'Custodio', value: 'Fiduciaria demo' }, { label: 'Prioridad', value: 'Primer grado' }]} /></SectionCard>}{tab === 'Contrato' && <SectionCard title="Contrato y condiciones"><div className="contract-preview"><FileSignature /><div><h2>Contrato de financiamiento</h2><p>Se generará cuando el proyecto sea aprobado. Incluye destino de fondos, pagos, garantías, eventos de incumplimiento y divulgación de riesgos.</p><Button variant="secondary" onClick={() => notify('Previsualización contractual mock abierta')}>Previsualizar borrador</Button></div></div></SectionCard>}{decision && <DecisionModal title={decision === 'REJECTED' ? 'Rechazar proyecto' : decision === 'CHANGES_REQUESTED' ? 'Solicitar cambios' : decision === 'PUBLISHED' ? 'Publicar oportunidad' : 'Aprobar proyecto'} confirmLabel={decision === 'PUBLISHED' ? 'Confirmar publicación' : 'Confirmar decisión'} danger={decision === 'REJECTED'} onClose={() => setDecision(null)} onConfirm={commitDecision} />}</AdminPage>
}

type RegistryKind = 'contracts' | 'guarantees' | 'vaults' | 'investments' | 'payments' | 'defaults'
const registryConfig: Record<RegistryKind, { eyebrow: string; title: string; description: string; icon: typeof Vault }> = {
  contracts: { eyebrow: 'GESTIÓN LEGAL', title: 'Contratos', description: 'Estados de firma, vigencia y documentación contractual.', icon: FileSignature },
  guarantees: { eyebrow: 'RESPALDOS', title: 'Garantías', description: 'Avalúos, cobertura, prioridad y estado de custodia.', icon: Landmark },
  vaults: { eyebrow: 'TRAZABILIDAD', title: 'Bóvedas de proyectos', description: 'Despliegue y movimientos mock de contratos de custodia.', icon: Vault },
  investments: { eyebrow: 'REGISTRO', title: 'Inversiones', description: 'Operaciones confirmadas y pendientes de conciliación.', icon: Users },
  payments: { eyebrow: 'OPERACIONES', title: 'Pagos', description: 'Recepción, validación y distribución a inversionistas.', icon: BadgeDollarSign },
  defaults: { eyebrow: 'RIESGO', title: 'Incumplimientos', description: 'Alertas, seguimiento y protocolos de recuperación.', icon: AlertTriangle },
}

export function AdminRegistryPage({ kind }: { kind: RegistryKind }) {
  const { notify } = useToast()
  const config = registryConfig[kind]
  return <AdminPage><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<Button variant="secondary" onClick={() => notify('Reporte CSV mock preparado')}>Exportar reporte</Button>} />{kind === 'payments' ? <PaymentsRegistry /> : kind === 'investments' ? <InvestmentsRegistry /> : kind === 'defaults' ? <DefaultsRegistry /> : <AssetRegistry kind={kind} icon={config.icon} />}</AdminPage>
}

function PaymentsRegistry() { return <><div className="metrics-grid"><MetricCard label="Recibido este mes" value="72,325 USDT" icon={BadgeDollarSign} /><MetricCard label="Pendiente" value="28,750 USDT" icon={Clock3} tone="blue" /><MetricCard label="Distribuido" value="43,575 USDT" icon={Users} tone="peach" /><MetricCard label="Vencido" value="34,900 USDT" icon={AlertTriangle} tone="lavender" /></div><SectionCard><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Proyecto</th><th>Empresa</th><th>Vencimiento</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.projectName}</strong></td><td>{payment.companyName}</td><td>{formatDate(payment.expectedAt)}</td><td>{formatUsd(payment.amount, true)}</td><td><StatusBadge status={payment.status} /></td></tr>)}</tbody></table></div></SectionCard></> }
function InvestmentsRegistry() { const rows = opportunities.slice(0, 6); return <SectionCard><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Operación</th><th>Proyecto</th><th>Inversionista</th><th>Monto</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{rows.map((project, index) => <tr key={project.id}><td><code>INV-{2401 + index}</code></td><td><strong>{project.projectName}</strong></td><td>{['Valeria Mendoza', 'Rodrigo Paz', 'Camila Suárez'][index % 3]}</td><td>{formatUsd((index + 1) * 750, true)}</td><td>10 sep 2026</td><td><StatusBadge status="CONFIRMED" label="Confirmada" /></td></tr>)}</tbody></table></div></SectionCard> }
function DefaultsRegistry() {
  const { notify } = useToast()
  return (
    <>
      <div className="metrics-grid">
        <MetricCard label="Alertas abiertas" value="1" icon={AlertTriangle} />
        <MetricCard label="Capital expuesto" value="34,900 USDT" icon={WalletCards} tone="blue" />
        <MetricCard label="En seguimiento" value="2" icon={Clock3} tone="peach" />
        <MetricCard label="Resueltos" value="7" icon={CheckCircle2} tone="lavender" />
      </div>
      <SectionCard>
        <div className="default-case">
          <AlertTriangle />
          <div><StatusBadge status="LATE" label="Pago vencido" /><h2>Centro Empresarial Andino</h2><p>Cuota vencida el 30 ago 2026. La empresa fue notificada y el caso está en seguimiento operativo.</p><div><Button variant="secondary" onClick={() => notify('Expediente de incumplimiento mock abierto')}>Abrir caso</Button><Button onClick={() => notify('Gestión operativa registrada')}>Registrar gestión</Button></div></div>
          <strong>34,900 USDT</strong>
        </div>
      </SectionCard>
    </>
  )
}
function AssetRegistry({ kind, icon: Icon }: { kind: 'contracts' | 'guarantees' | 'vaults'; icon: typeof Vault }) {
  const { notify } = useToast()
  const items = opportunities.slice(0, 6)
  return (
    <>
      <div className="metrics-grid">
        <MetricCard label="Registros totales" value={String(items.length + 8)} icon={Icon} />
        <MetricCard label="Activos" value="8" icon={CheckCircle2} tone="blue" />
        <MetricCard label="Pendientes" value="3" icon={Clock3} tone="peach" />
        <MetricCard label="Requieren atención" value="1" icon={AlertTriangle} tone="lavender" />
      </div>
      <SectionCard>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Identificador</th><th>Proyecto</th><th>{kind === 'guarantees' ? 'Cobertura' : kind === 'vaults' ? 'Saldo' : 'Vigencia'}</th><th>Estado</th><th /></tr></thead><tbody>{items.map((project, index) => <tr key={project.id}><td><code>{kind.slice(0, 3).toUpperCase()}-{1024 + index}</code></td><td><strong>{project.projectName}</strong><small>{project.business.name}</small></td><td>{kind === 'guarantees' ? `${(1.18 + index * .04).toFixed(2)}x` : kind === 'vaults' ? formatUsd(project.fundedAmount, true) : `${project.durationMonths} meses`}</td><td><StatusBadge status={index === 4 ? 'PENDING' : 'ACTIVE'} /></td><td><button className="table-button" type="button" onClick={() => notify(`Detalle mock abierto: ${project.projectName}`)}>Ver detalle</button></td></tr>)}</tbody></table></div>
      </SectionCard>
    </>
  )
}

function DecisionModal({ title, confirmLabel, danger, onClose, onConfirm }: { title: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="decision-title">{title}</h2><p>Esta acción actualiza el estado compartido de la demo.</p><label className="field"><span>Comentario de la decisión</span><textarea placeholder="Agrega contexto para la empresa…" /></label><label className="check-row"><input type="checkbox" required /> Confirmo que revisé el expediente y la documentación disponible.</label><div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></div></section></div>
}

function AdminPage({ children }: { children: ReactNode }) { return <main className="admin-page" id="main-content">{children}</main> }
