import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilePlus2,
  FolderKanban,
  Landmark,
  MessageSquareText,
  Plus,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../features/auth/model/AuthContext'
import { useDemo } from '../../../features/demo/model/DemoContext'
import { useToast } from '../../../features/toast/model/ToastContext'
import { payments } from '../../../shared/data/platform.mock'
import { formatDate, formatPercent, formatUsd } from '../../../shared/lib/format'
import type { OpportunityCategory } from '../../../entities/opportunity/model/opportunity.types'
import type { ProjectStatus, Proposal } from '../../../shared/types/platform.types'
import { Button } from '../../../shared/ui/button/Button'
import { Breadcrumbs, DocumentCard, EmptyState, InfoGrid, MetricCard, PageHeader, ProgressMeter, SectionCard, StatusBadge, Tabs } from '../../../shared/ui/platform/PlatformUI'
import './CompanyPages.css'

const statusLabels: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviada', UNDER_REVIEW: 'En revisión', CHANGES_REQUESTED: 'Cambios solicitados', APPROVED: 'Aprobada', REJECTED: 'Rechazada', PUBLISHED: 'Publicada', FUNDING: 'En financiamiento', FUNDED: 'Financiada', ACTIVE: 'Activa', REPAYING: 'En pagos', COMPLETED: 'Completada', DEFAULTED: 'En incumplimiento',
}

function companyProposals(proposals: Proposal[], companyId?: string) {
  return proposals.filter((proposal) => proposal.companyId === companyId)
}

export function CompanyDashboardPage() {
  const { user } = useAuth()
  const { proposals } = useDemo()
  const own = companyProposals(proposals, user?.id === 'usr-company' ? 'company-altura' : user?.id)
  const active = own.filter((project) => ['PUBLISHED', 'FUNDING', 'FUNDED', 'ACTIVE', 'REPAYING'].includes(project.status))
  const requested = own.reduce((sum, project) => sum + project.fundingRequested, 0)

  return (
    <main className="app-page page-shell" id="main-content">
      <PageHeader eyebrow="PANEL DE EMPRESA" title={`Hola, ${user?.name.split(' ')[0] ?? 'equipo'}`} description={`Gestiona el financiamiento de ${user?.companyName ?? 'tu empresa'} y responde las observaciones de revisión.`} actions={<Button to="/company/projects/new"><Plus size={18} /> Nueva propuesta</Button>} />
      <div className="company-alert"><ShieldCheck size={21} /><div><strong>KYB verificado</strong><p>Tu empresa puede presentar propuestas y recibir financiamiento.</p></div><Link to="/company/profile">Ver perfil empresarial</Link></div>
      <div className="metrics-grid">
        <MetricCard label="Proyectos registrados" value={String(own.length)} detail={`${active.length} activos o publicados`} icon={FolderKanban} />
        <MetricCard label="Capital solicitado" value={formatUsd(requested, true)} detail="En propuestas de la empresa" icon={CircleDollarSign} tone="blue" />
        <MetricCard label="Capital recibido" value="184,500 USDT" detail="Fondos liberados" icon={WalletCards} tone="peach" />
        <MetricCard label="Próximo pago" value="28,750 USDT" detail="25 sep 2026" icon={CalendarClock} tone="lavender" />
      </div>
      <div className="dashboard-grid">
        <SectionCard title="Estado de proyectos" description="Últimas propuestas y acciones pendientes" actions={<Link className="table-link" to="/company/projects">Ver todos</Link>}>
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Proyecto</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{own.slice(0, 5).map((project) => <tr key={project.id}><td><strong>{project.projectName}</strong><small>{project.projectType}</small></td><td>{formatUsd(project.fundingRequested, true)}</td><td><StatusBadge status={project.status} label={statusLabels[project.status]} /></td><td><Link className="table-link" to={`/company/projects/${project.id}`}>{project.status === 'CHANGES_REQUESTED' ? 'Corregir' : 'Ver detalle'}</Link></td></tr>)}</tbody></table></div>
        </SectionCard>
        <div className="stack">
          <SectionCard title="Acciones rápidas"><div className="quick-action-list"><Link to="/company/projects/new"><FilePlus2 /><span><strong>Crear propuesta</strong><small>Inicia una solicitud guiada</small></span><ArrowRight /></Link><Link to="/company/payments"><ReceiptText /><span><strong>Registrar pago</strong><small>Revisa el cronograma</small></span><ArrowRight /></Link><Link to="/company/profile"><Building2 /><span><strong>Datos de empresa</strong><small>Perfil y documentos KYB</small></span><ArrowRight /></Link></div></SectionCard>
          <SectionCard title="Próximo vencimiento"><div className="company-payment-callout"><Clock3 /><div><strong>25 sep 2026</strong><p>Cuota de Residencial Mirador del Valle</p><b>28,750 USDT</b></div></div><Button to="/company/payments" variant="secondary">Gestionar pagos</Button></SectionCard>
        </div>
      </div>
    </main>
  )
}

type ProjectTab = 'Todos' | 'Borrador' | 'Revisión' | 'Publicados' | 'Cerrados'

export function CompanyProjectsPage() {
  const { user } = useAuth()
  const { proposals } = useDemo()
  const [tab, setTab] = useState<ProjectTab>('Todos')
  const own = companyProposals(proposals, user?.id === 'usr-company' ? 'company-altura' : user?.id)
  const filtered = own.filter((project) => {
    if (tab === 'Todos') return true
    if (tab === 'Borrador') return project.status === 'DRAFT'
    if (tab === 'Revisión') return ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].includes(project.status)
    if (tab === 'Publicados') return ['PUBLISHED', 'FUNDING', 'FUNDED', 'ACTIVE', 'REPAYING'].includes(project.status)
    return ['COMPLETED', 'REJECTED', 'DEFAULTED'].includes(project.status)
  })
  return <main className="app-page page-shell" id="main-content"><PageHeader eyebrow="FINANCIAMIENTO" title="Mis proyectos" description="Crea propuestas, responde revisiones y sigue el avance de cada campaña." actions={<Button to="/company/projects/new"><Plus size={18} /> Nueva propuesta</Button>} /><SectionCard><Tabs value={tab} label="Filtrar proyectos" options={['Todos', 'Borrador', 'Revisión', 'Publicados', 'Cerrados'].map((value) => ({ value: value as ProjectTab, label: value }))} onChange={setTab} />{filtered.length ? <div className="company-project-grid">{filtered.map((project) => <article key={project.id}><header><span>{project.category}</span><StatusBadge status={project.status} label={statusLabels[project.status]} /></header><h2>{project.projectName}</h2><p>{project.description}</p><dl><div><dt>Solicitado</dt><dd>{formatUsd(project.fundingRequested, true)}</dd></div><div><dt>Retorno</dt><dd>{formatPercent(project.expectedApy)}</dd></div><div><dt>Plazo</dt><dd>{project.durationMonths} meses</dd></div></dl>{['PUBLISHED', 'FUNDING'].includes(project.status) && <ProgressMeter value={37} label="Financiamiento" />}<Link to={`/company/projects/${project.id}`}>Administrar proyecto <ArrowRight size={17} /></Link></article>)}</div> : <EmptyState title="No hay proyectos en esta vista" description="Cambia el filtro o crea una nueva propuesta." actionLabel="Nueva propuesta" actionTo="/company/projects/new" />}</SectionCard></main>
}

interface WizardData {
  projectName: string
  category: OpportunityCategory
  projectType: string
  location: string
  description: string
  fundingRequested: number
  expectedApy: number
  durationMonths: number
  minimumInvestment: number
  materials: number
  personnel: number
  equipment: number
  other: number
  guarantee: string
}

const initialWizard: WizardData = {
  projectName: '', category: 'Construcción', projectType: 'Desarrollo inmobiliario', location: 'La Paz, Bolivia', description: '', fundingRequested: 250000, expectedApy: 10.5, durationMonths: 24, minimumInvestment: 100, materials: 45, personnel: 30, equipment: 15, other: 10, guarantee: 'Bien inmueble + pagaré empresarial',
}

const wizardSteps = ['Proyecto', 'Empresa', 'Financiamiento', 'Uso de fondos', 'Garantías', 'Documentos', 'Declaraciones', 'Resumen']

export function NewProjectPage() {
  const { user } = useAuth()
  const { addProposal } = useDemo()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [data, setData] = useState(initialWizard)
  const totalUse = data.materials + data.personnel + data.equipment + data.other

  function update<Key extends keyof WizardData>(key: Key, value: WizardData[Key]) { setData((current) => ({ ...current, [key]: value })) }
  function advance() {
    if (step === 1 && (!data.projectName.trim() || !data.description.trim())) { notify('Completa el nombre y la descripción del proyecto'); return }
    if (step === 4 && totalUse !== 100) { notify('La distribución de fondos debe sumar 100%'); return }
    setStep((current) => Math.min(8, current + 1))
  }
  function save(status: 'DRAFT' | 'SUBMITTED') {
    const proposal = addProposal({
      companyId: user?.id === 'usr-company' ? 'company-altura' : user?.id ?? 'company-demo',
      companyName: user?.companyName ?? 'Empresa demo',
      projectName: data.projectName || 'Propuesta sin título',
      category: data.category,
      projectType: data.projectType,
      location: data.location,
      description: data.description || 'Descripción pendiente.',
      fundingRequested: data.fundingRequested,
      expectedApy: data.expectedApy,
      durationMonths: data.durationMonths,
      minimumInvestment: data.minimumInvestment,
      status,
      priority: 'Normal',
      fundUse: [{ label: 'Materiales', percentage: data.materials }, { label: 'Personal', percentage: data.personnel }, { label: 'Equipamiento', percentage: data.equipment }, { label: 'Otros', percentage: data.other }],
      guarantee: data.guarantee,
      reviewerNotes: [],
    })
    notify(status === 'DRAFT' ? 'Borrador guardado' : 'Propuesta enviada a revisión')
    navigate(`/company/projects/${proposal.id}`)
  }

  return (
    <main className="app-page page-shell" id="main-content">
      <Breadcrumbs items={[{ label: 'Mis proyectos', to: '/company/projects' }, { label: 'Nueva propuesta' }]} />
      <PageHeader eyebrow="ASISTENTE DE PROPUESTA" title="Presenta un proyecto financiable" description="Completa ocho pasos. La información queda guardada únicamente en esta demo local." />
      <div className="wizard-layout">
        <aside className="wizard-sidebar" aria-label="Pasos de la propuesta">{wizardSteps.map((label, index) => <button key={label} type="button" className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} onClick={() => step > index + 1 && setStep(index + 1)}><span>{step > index + 1 ? <CheckCircle2 size={16} /> : index + 1}</span>{label}</button>)}</aside>
        <SectionCard className="wizard-card">
          <div className="wizard-heading"><span>Paso {step} de 8</span><h2>{wizardSteps[step - 1]}</h2></div>
          {step === 1 && <div className="form-grid"><label className="field"><span>Nombre del proyecto</span><input value={data.projectName} onChange={(event) => update('projectName', event.target.value)} placeholder="Ej. Edificio Bosques del Sur" required /></label><label className="field"><span>Categoría</span><select value={data.category} onChange={(event) => update('category', event.target.value as OpportunityCategory)}>{['Bienes Raíces', 'Construcción', 'Agricultura', 'Energía', 'Tecnología', 'Logística', 'Salud', 'Industria', 'Comercio'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Tipo de proyecto</span><input value={data.projectType} onChange={(event) => update('projectType', event.target.value)} /></label><label className="field"><span>Ubicación</span><input value={data.location} onChange={(event) => update('location', event.target.value)} /></label><label className="field field--full"><span>Descripción y objetivo</span><textarea value={data.description} onChange={(event) => update('description', event.target.value)} placeholder="Explica el proyecto, el mercado y el impacto esperado." required /></label></div>}
          {step === 2 && <><div className="wizard-info-banner"><Building2 /><div><strong>{user?.companyName}</strong><p>Los datos legales se toman del perfil KYB verificado.</p></div><Link to="/company/profile">Revisar perfil</Link></div><InfoGrid items={[{ label: 'Representante', value: user?.name }, { label: 'Correo', value: user?.email }, { label: 'NIT', value: '486201029' }, { label: 'Estado KYB', value: <StatusBadge status={user?.kybStatus ?? 'INCOMPLETE'} /> }]} /></>}
          {step === 3 && <div className="form-grid"><label className="field"><span>Monto solicitado (USDT)</span><input type="number" min="10000" value={data.fundingRequested} onChange={(event) => update('fundingRequested', Number(event.target.value))} /></label><label className="field"><span>Retorno estimado anual (%)</span><input type="number" min="1" max="40" step="0.1" value={data.expectedApy} onChange={(event) => update('expectedApy', Number(event.target.value))} /></label><label className="field"><span>Plazo (meses)</span><input type="number" min="3" max="60" value={data.durationMonths} onChange={(event) => update('durationMonths', Number(event.target.value))} /></label><label className="field"><span>Inversión mínima (USDT)</span><input type="number" min="10" value={data.minimumInvestment} onChange={(event) => update('minimumInvestment', Number(event.target.value))} /></label><div className="estimate-box field--full"><TrendingEstimate amount={data.fundingRequested} apy={data.expectedApy} months={data.durationMonths} /></div></div>}
          {step === 4 && <><div className={totalUse === 100 ? 'fund-total is-valid' : 'fund-total'}><span>Distribución total</span><strong>{totalUse}%</strong></div><div className="form-grid">{(['materials', 'personnel', 'equipment', 'other'] as const).map((key) => <label className="field" key={key}><span>{{ materials: 'Materiales', personnel: 'Personal', equipment: 'Equipamiento', other: 'Otros' }[key]} (%)</span><input type="number" min="0" max="100" value={data[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>)}</div></>}
          {step === 5 && <><label className="field"><span>Garantía principal</span><select value={data.guarantee} onChange={(event) => update('guarantee', event.target.value)}><option>Bien inmueble + pagaré empresarial</option><option>Hipoteca sobre terreno</option><option>Maquinaria y equipos</option><option>Contrato de compra y pagaré</option></select></label><div className="guarantee-preview"><Landmark /><div><strong>{data.guarantee}</strong><p>La garantía será revisada, valuada y vinculada al contrato antes de publicar el proyecto.</p></div></div></>}
          {step === 6 && <div className="upload-grid">{['Plan de negocio', 'Estados financieros', 'Documentos legales', 'Cronograma y presupuesto'].map((document) => <label className="upload-zone" key={document}><FileCheck2 /><strong>{document}</strong><span>PDF, XLSX o imagen · carga simulada</span><input type="file" /></label>)}</div>}
          {step === 7 && <div className="declaration-list"><label className="check-row"><input type="checkbox" required /> Declaro que la información presentada es verdadera y verificable.</label><label className="check-row"><input type="checkbox" required /> Autorizo la revisión documental, financiera y de garantías.</label><label className="check-row"><input type="checkbox" required /> Comprendo que enviar una propuesta no garantiza su aprobación ni financiamiento.</label></div>}
          {step === 8 && <div className="wizard-summary"><div className="summary-icon"><ClipboardCheck /></div><h3>{data.projectName || 'Propuesta sin título'}</h3><p>{data.description || 'Agrega una descripción antes de enviar.'}</p><InfoGrid items={[{ label: 'Empresa', value: user?.companyName }, { label: 'Categoría', value: data.category }, { label: 'Monto', value: formatUsd(data.fundingRequested, true) }, { label: 'Retorno', value: formatPercent(data.expectedApy) }, { label: 'Plazo', value: `${data.durationMonths} meses` }, { label: 'Garantía', value: data.guarantee }]} /><div className="review-note"><ShieldCheck /><p>El equipo revisará identidad empresarial, viabilidad, documentos y garantías antes de publicar.</p></div></div>}
          <div className="wizard-actions"><Button variant="ghost" onClick={() => step > 1 ? setStep((current) => current - 1) : navigate('/company/projects')}><ArrowLeft size={18} /> {step === 1 ? 'Cancelar' : 'Anterior'}</Button><div><Button variant="secondary" onClick={() => save('DRAFT')}>Guardar borrador</Button>{step < 8 ? <Button onClick={advance}>Continuar <ArrowRight size={18} /></Button> : <Button onClick={() => save('SUBMITTED')}>Enviar a revisión <ArrowRight size={18} /></Button>}</div></div>
        </SectionCard>
      </div>
    </main>
  )
}

function TrendingEstimate({ amount, apy, months }: { amount: number; apy: number; months: number }) {
  const total = amount * (1 + apy / 100 * months / 12)
  return <><Banknote /><div><span>Obligación total estimada</span><strong>{formatUsd(total, true)}</strong><small>Referencia de demo, sujeta a evaluación y contrato.</small></div></>
}

export function CompanyProjectDetailPage() {
  const { id } = useParams()
  const { proposals } = useDemo()
  const { notify } = useToast()
  const [showUpdate, setShowUpdate] = useState(false)
  const [updates, setUpdates] = useState<Array<{ title: string; text: string }>>([])
  const proposal = proposals.find((item) => item.id === id)
  if (!proposal) return <main className="app-page page-shell"><EmptyState title="Proyecto no encontrado" description="La propuesta solicitada no existe en esta sesión." actionLabel="Volver a mis proyectos" actionTo="/company/projects" /></main>
  const funding = ['PUBLISHED', 'FUNDING', 'FUNDED', 'ACTIVE'].includes(proposal.status) ? 37 : 0

  function addUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setUpdates((current) => [{ title: String(fields.get('title')), text: String(fields.get('text')) }, ...current])
    setShowUpdate(false)
    notify('Actualización publicada en la demo')
  }
  return <main className="app-page page-shell" id="main-content"><Breadcrumbs items={[{ label: 'Mis proyectos', to: '/company/projects' }, { label: proposal.projectName }]} /><PageHeader eyebrow="GESTIÓN DEL PROYECTO" title={proposal.projectName} description={`${proposal.companyName} · ${proposal.location}`} actions={<><StatusBadge status={proposal.status} label={statusLabels[proposal.status]} />{proposal.status === 'CHANGES_REQUESTED' && <Button onClick={() => notify('Editor de correcciones preparado')}>Corregir propuesta</Button>}{['PUBLISHED', 'FUNDING', 'FUNDED', 'ACTIVE'].includes(proposal.status) && <Button onClick={() => setShowUpdate(true)}><MessageSquareText size={18} /> Publicar actualización</Button>}</>} /><div className="project-status-banner"><div><strong>¿Qué significa este estado?</strong><p>{proposal.status === 'UNDER_REVIEW' ? 'El equipo está validando la viabilidad, documentación y garantía.' : proposal.status === 'CHANGES_REQUESTED' ? 'Debes responder las observaciones antes de continuar la revisión.' : proposal.status === 'SUBMITTED' ? 'La propuesta fue recibida y pronto será asignada a revisión.' : 'El proyecto avanza según el estado indicado y su cronograma.'}</p></div><span>Enviada {formatDate(proposal.submittedAt)}</span></div><div className="metrics-grid"><MetricCard label="Monto solicitado" value={formatUsd(proposal.fundingRequested, true)} icon={CircleDollarSign} /><MetricCard label="Capital financiado" value={formatUsd(proposal.fundingRequested * funding / 100, true)} detail={`${funding}% alcanzado`} icon={WalletCards} tone="blue" /><MetricCard label="Inversionistas" value={funding ? '48' : '0'} icon={Users} tone="peach" /><MetricCard label="Próximo hito" value="Revisión legal" detail="18 sep 2026" icon={CalendarClock} tone="lavender" /></div><div className="dashboard-grid"><div className="stack"><SectionCard title="Resumen y financiamiento"><InfoGrid items={[{ label: 'Tipo', value: proposal.projectType }, { label: 'Categoría', value: proposal.category }, { label: 'Retorno estimado', value: formatPercent(proposal.expectedApy) }, { label: 'Plazo', value: `${proposal.durationMonths} meses` }, { label: 'Mínimo', value: formatUsd(proposal.minimumInvestment, true) }, { label: 'Ubicación', value: proposal.location }]} />{funding > 0 && <div className="company-detail-progress"><ProgressMeter value={funding} label="Meta financiada" /></div>}</SectionCard><SectionCard title="Uso de fondos"><div className="fund-use-list">{proposal.fundUse.map((item) => <p key={item.label}><span>{item.label}</span><b>{item.percentage}%</b><i style={{ width: `${item.percentage}%` }} /></p>)}</div></SectionCard><SectionCard title="Actividad y actualizaciones"><div className="activity-list">{updates.map((update) => <p key={update.title}><CheckCircle2 /><span><strong>{update.title}</strong><small>{update.text}</small></span></p>)}<p><FileCheck2 /><span><strong>Propuesta enviada</strong><small>{formatDate(proposal.submittedAt)}</small></span></p><p><ShieldCheck /><span><strong>Documentos recibidos</strong><small>Validación inicial completada</small></span></p></div></SectionCard></div><div className="stack"><SectionCard title="Observaciones de revisión">{proposal.reviewerNotes.length ? <div className="reviewer-notes">{proposal.reviewerNotes.map((note) => <p key={note}><MessageSquareText />{note}</p>)}</div> : <p className="muted-copy">Todavía no hay observaciones del equipo.</p>}</SectionCard><SectionCard title="Garantía y bóveda"><div className="guarantee-preview"><Landmark /><div><strong>{proposal.guarantee}</strong><p>Custodia mock pendiente de formalización contractual.</p><StatusBadge status={proposal.status === 'APPROVED' ? 'VERIFIED' : 'UNDER_REVIEW'} /></div></div></SectionCard><SectionCard title="Documentos"><div className="document-list"><DocumentCard name="Plan del proyecto" type="PDF" date={proposal.submittedAt} status="Validado" onView={() => notify('Documento mock abierto')} onDownload={() => notify('Descarga mock preparada')} /><DocumentCard name="Presupuesto detallado" type="XLSX" date={proposal.submittedAt} status="En revisión" onView={() => notify('Documento mock abierto')} onDownload={() => notify('Descarga mock preparada')} /></div></SectionCard></div></div>{showUpdate && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowUpdate(false)}><section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="update-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="update-title">Nueva actualización</h2><p>Informa avances concretos a tus inversionistas.</p><form onSubmit={addUpdate}><label className="field"><span>Título</span><input name="title" required placeholder="Ej. Obra gris completada" /></label><label className="field"><span>Detalle</span><textarea name="text" required /></label><div className="form-actions"><Button variant="ghost" onClick={() => setShowUpdate(false)}>Cancelar</Button><Button type="submit">Publicar</Button></div></form></section></div>}</main>
}

export function CompanyPaymentsPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [showPayment, setShowPayment] = useState(false)
  const rows = useMemo(() => payments.filter((payment) => payment.companyName === user?.companyName || payment.companyName === 'ValleSur Desarrollos SRL'), [user?.companyName])
  function confirm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setShowPayment(false); notify('Pago mock registrado para validación') }
  return <main className="app-page page-shell" id="main-content"><PageHeader eyebrow="OBLIGACIONES" title="Pagos y cronograma" description="Consulta cuotas, comprobantes y distribución a inversionistas." actions={<Button onClick={() => setShowPayment(true)}><Banknote size={18} /> Realizar pago</Button>} /><div className="metrics-grid"><MetricCard label="Próxima cuota" value="28,750 USDT" detail="25 sep 2026" icon={CalendarClock} /><MetricCard label="Pagado a la fecha" value="56,900 USDT" detail="2 cuotas procesadas" icon={CheckCircle2} tone="blue" /><MetricCard label="Pendiente del ciclo" value="28,750 USDT" icon={Clock3} tone="peach" /><MetricCard label="Distribuido" value="56,900 USDT" detail="A 174 inversionistas" icon={Users} tone="lavender" /></div><SectionCard title="Cronograma de pagos" description="Montos demostrativos en USDT"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Proyecto</th><th>Fecha esperada</th><th>Monto</th><th>Estado</th><th>Comprobante</th></tr></thead><tbody>{rows.map((payment) => <tr key={payment.id}><td><strong>{payment.projectName}</strong></td><td>{formatDate(payment.expectedAt)}</td><td>{formatUsd(payment.amount, true)}</td><td><StatusBadge status={payment.status} /></td><td><button className="table-button" type="button" onClick={() => notify(payment.receivedAt ? 'Comprobante mock abierto' : 'Aún no existe un comprobante')}>{payment.receivedAt ? 'Ver comprobante' : 'Pendiente'}</button></td></tr>)}</tbody></table></div></SectionCard><SectionCard title="Cómo se procesa un pago" className="payment-process"><div className="three-column"><article><b>1</b><strong>Registro</strong><p>La empresa envía USDT y adjunta el comprobante.</p></article><article><b>2</b><strong>Validación</strong><p>Operaciones confirma el monto y el proyecto.</p></article><article><b>3</b><strong>Distribución</strong><p>El sistema acredita los saldos de los inversionistas.</p></article></div></SectionCard>{showPayment && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPayment(false)}><section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="payment-title">Registrar pago</h2><p>Simulación local. No se moverán fondos reales.</p><form onSubmit={confirm}><label className="field"><span>Proyecto</span><select><option>Residencial Mirador del Valle</option><option>Torres Mirador Norte</option></select></label><label className="field"><span>Monto (USDT)</span><input type="number" min="1" defaultValue="28750" required /></label><label className="field"><span>Hash o referencia</span><input placeholder="0x..." required /></label><div className="form-actions"><Button variant="ghost" onClick={() => setShowPayment(false)}>Cancelar</Button><Button type="submit">Confirmar registro</Button></div></form></section></div>}</main>
}

export function CompanyProfilePage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [tab, setTab] = useState<'Perfil' | 'KYB' | 'Seguridad'>('Perfil')
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); notify('Datos empresariales guardados') }
  return <main className="app-page page-shell app-page--narrow" id="main-content"><PageHeader eyebrow="CUENTA EMPRESARIAL" title="Perfil de la empresa" description="Administra los datos visibles, la verificación y el acceso del equipo." /><Tabs value={tab} label="Secciones del perfil" options={['Perfil', 'KYB', 'Seguridad'].map((value) => ({ value: value as typeof tab, label: value }))} onChange={setTab} />{tab === 'Perfil' && <SectionCard><div className="profile-heading"><span><Building2 /></span><div><strong>{user?.companyName}</strong><small>Cuenta empresarial · Bolivia</small></div></div><form onSubmit={save}><div className="form-grid"><label className="field"><span>Razón social</span><input defaultValue={user?.companyName} /></label><label className="field"><span>NIT</span><input defaultValue="486201029" /></label><label className="field"><span>Representante legal</span><input defaultValue={user?.name} /></label><label className="field"><span>Correo de contacto</span><input type="email" defaultValue={user?.email} /></label><label className="field"><span>Ciudad</span><input defaultValue="La Paz" /></label><label className="field"><span>Sector</span><input defaultValue="Construcción" /></label><label className="field field--full"><span>Descripción pública</span><textarea defaultValue="Desarrollamos proyectos inmobiliarios con planificación técnica, trazabilidad y foco en vivienda urbana." /></label></div><div className="form-actions"><Button type="submit">Guardar cambios</Button></div></form></SectionCard>}{tab === 'KYB' && <div className="stack"><SectionCard><div className="kyb-status"><ShieldCheck /><div><StatusBadge status={user?.kybStatus ?? 'INCOMPLETE'} /><h2>Empresa verificada</h2><p>Los documentos legales y la identidad del representante fueron validados para esta demo.</p></div></div></SectionCard><SectionCard title="Documentación KYB"><div className="document-list"><DocumentCard name="Matrícula de comercio" type="PDF" date="2026-02-14" status="Validado" onView={() => notify('Documento mock abierto')} onDownload={() => notify('Descarga mock preparada')} /><DocumentCard name="Poder del representante" type="PDF" date="2026-02-14" status="Validado" onView={() => notify('Documento mock abierto')} onDownload={() => notify('Descarga mock preparada')} /><DocumentCard name="Registro NIT" type="PDF" date="2026-02-14" status="Validado" onView={() => notify('Documento mock abierto')} onDownload={() => notify('Descarga mock preparada')} /></div></SectionCard></div>}{tab === 'Seguridad' && <SectionCard title="Acceso y notificaciones"><div className="preference-list"><label><span><strong>Alertas de revisión</strong><small>Correo cuando el administrador solicite cambios.</small></span><input type="checkbox" defaultChecked /></label><label><span><strong>Alertas de pago</strong><small>Recordatorios antes de cada vencimiento.</small></span><input type="checkbox" defaultChecked /></label><label><span><strong>Autenticación en dos pasos</strong><small>Configuración simulada en esta demo.</small></span><input type="checkbox" /></label></div><div className="form-actions"><Button onClick={() => notify('Preferencias de seguridad guardadas')}>Guardar preferencias</Button></div></SectionCard>}</main>
}
