import { useMemo, useState } from 'react'
import { Plus, Trash2, Send, Rocket } from 'lucide-react'
import { parseAmount, type ProjectDossier, type ValidationIssue } from '@s2d/shared'
import { api, ApiError } from '../../../shared/api/backend'

const DIA = 24 * 60 * 60 * 1000
const iso = (dias: number) => new Date(Date.now() + dias * DIA).toISOString()
const fecha = (value: string) => value.slice(0, 10)

interface MilestoneDraft {
  title: string
  description: string
  bps: number
  role: 'LEGAL' | 'SUPERVISOR'
  deadline: string
  requiredEvidence: string[]
}

const EVIDENCE_KINDS = ['INFORME', 'FOTOGRAFIA', 'FACTURA', 'CERTIFICADO', 'PLANO', 'CONTRATO'] as const

const DEFAULT_MILESTONES: MilestoneDraft[] = [
  { title: 'Cierre legal y societario', description: 'SPV constituido, terreno transferido, gravámenes verificados.', bps: 2500, role: 'LEGAL', deadline: fecha(iso(60)), requiredEvidence: ['CERTIFICADO', 'CONTRATO'] },
  { title: 'Fundaciones', description: 'Movimiento de tierras y fundaciones vaciadas.', bps: 2500, role: 'SUPERVISOR', deadline: fecha(iso(180)), requiredEvidence: ['INFORME', 'FOTOGRAFIA'] },
  { title: 'Obra gruesa', description: 'Estructura y cerramientos completos.', bps: 3000, role: 'SUPERVISOR', deadline: fecha(iso(330)), requiredEvidence: ['INFORME', 'FOTOGRAFIA'] },
  { title: 'Acabados y habitabilidad', description: 'Certificado municipal de habitabilidad emitido.', bps: 2000, role: 'LEGAL', deadline: fecha(iso(480)), requiredEvidence: ['CERTIFICADO'] },
]

/**
 * Crear proyecto  (backlog T7)
 *
 * El formulario valida CONTRA EL BACKEND, que corre las mismas reglas que van a
 * decidir si el despliegue revierte. Duplicar la validación en el cliente se
 * siente más ágil y garantiza que un día las dos versiones digan cosas
 * distintas — y la que manda es la de allá.
 *
 * Lo único que se calcula acá es la suma de tramos, porque es la que el usuario
 * necesita ver moverse mientras edita.
 */
export function NewProjectPage() {
  const [form, setForm] = useState({
    name: 'Edificio Aurora II',
    city: 'Cochabamba',
    type: 'RESIDENCIAL' as ProjectDossier['type'],
    summary: 'Edificio residencial de 6 plantas. El terreno está pagado y escriturado al SPV.',
    developerName: 'Vallesur Desarrollos S.R.L.',
    developerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    spvName: 'Aurora II S.R.L.',
    cadastralId: '3.01.4.02.0099887',
    target: '600000',
    equity: '500000',
    construction: '780000',
    land: '260000',
    minimumTicket: '1000',
    termMonths: 24,
    interestBps: 1200,
    originationBps: 200,
    successBps: 1500,
    fundingDeadline: fecha(iso(21)),
    minNetWorth: '100000',
    allowedJurisdiction: 68,
    legalVerifier: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    supervisorVerifier: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  })
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(DEFAULT_MILESTONES)
  const [created, setCreated] = useState<ProjectDossier | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const bpsTotal = useMemo(() => milestones.reduce((acc, m) => acc + m.bps, 0), [milestones])

  function buildDossier() {
    // Fuentes y usos tienen que cuadrar: el validador lo exige como error
    // bloqueante, así que la contingencia absorbe la diferencia.
    const usos = BigInt(parseAmount(form.land)) + BigInt(parseAmount(form.construction))
    const fuentes = BigInt(parseAmount(form.target)) + BigInt(parseAmount(form.equity))
    const contingencia = fuentes > usos ? (fuentes - usos).toString() : '0'

    return {
      name: form.name, city: form.city, type: form.type, summary: form.summary,
      developer: {
        id: 'dev-frontend', legalName: form.developerName, taxId: '1028374650018',
        address: form.developerAddress, completedProjects: 6, yearsActive: 11,
      },
      spv: {
        legalName: form.spvName, taxId: '4059281730099', commercialRegistry: 'MC-00300000',
        incorporatedAt: iso(-90), jurisdiction: 'Bolivia', treasuryAddress: form.developerAddress,
      },
      property: {
        cadastralId: form.cadastralId, address: 'Sin especificar', city: form.city,
        landArea: 900, buildableArea: 3600, titleHolder: form.spvName,
        appraisedValue: parseAmount('1200000'), appraisedAt: iso(-30),
        appraiser: 'Tasaciones Andinas', encumbrances: [],
        // Sin esto el validador bloquea: "sin gravámenes declarados" no es lo
        // mismo que "libre de gravámenes".
        certificateVerifiedAt: iso(-7),
      },
      sourcesAndUses: {
        sources: {
          developerEquity: parseAmount(form.equity), investorFinancing: parseAmount(form.target),
          bankFinancing: parseAmount('0'), presales: parseAmount('0'),
        },
        uses: {
          land: parseAmount(form.land), construction: parseAmount(form.construction),
          permitsAndFees: parseAmount('0'), professionalServices: parseAmount('0'),
          marketing: parseAmount('0'), contingency: contingencia, financialCosts: parseAmount('0'),
        },
      },
      terms: {
        target: parseAmount(form.target), minimumTicket: parseAmount(form.minimumTicket),
        maximumTicket: null, termMonths: form.termMonths, interestBps: form.interestBps,
        repaymentModel: 'ON_SALE' as const, originationBps: form.originationBps,
        successBps: form.successBps, expectedRevenue: parseAmount('2400000'),
        fundingDeadline: new Date(`${form.fundingDeadline}T12:00:00Z`).toISOString(),
      },
      milestones: milestones.map((m, index) => ({
        index, title: m.title, description: m.description, bps: m.bps, role: m.role,
        deadline: new Date(`${m.deadline}T12:00:00Z`).toISOString(),
        requiredEvidence: m.requiredEvidence,
      })),
      eligibility: {
        minNetWorth: form.minNetWorth, allowedJurisdiction: form.allowedJurisdiction, credentialRoot: '0x0',
      },
      risk: null,
      verifiers: [
        { id: 'ver-legal', address: form.legalVerifier, name: 'Verificador legal', role: 'LEGAL' as const, license: 'RAP 14-882', organization: 'Estudio jurídico' },
        { id: 'ver-obra', address: form.supervisorVerifier, name: 'Supervisor de obra', role: 'SUPERVISOR' as const, license: 'CIB 21-4417', organization: 'Supervisión Andina' },
      ],
      agreementHash: null, agreementVersion: null, vaultAddress: null, chainId: null,
    }
  }

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label); setError(null); setFlash(null)
    try {
      const message = await action()
      if (message) setFlash(message)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setIssues(caught.validationIssues as ValidationIssue[])
      } else {
        setError(caught instanceof Error ? caught.message : 'Falló la operación.')
      }
    } finally {
      setBusy(null)
    }
  }

  const errors = issues.filter((i) => i.severity === 'ERROR')
  const warnings = issues.filter((i) => i.severity === 'WARNING')

  return (
    <div className="stack">
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p>{flash}</p></div>}

      <section className="card">
        <h2>Datos del proyecto</h2>
        <div className="grid-2">
          <div className="field"><label htmlFor="name">Nombre</label>
            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="city">Ciudad</label>
            <input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="field"><label htmlFor="spv">SPV</label>
            <input id="spv" value={form.spvName} onChange={(e) => setForm({ ...form, spvName: e.target.value })} />
            <p className="field__hint">Patrimonio separado: si la constructora quiebra por otra obra, este proyecto no se va con ella.</p></div>
          <div className="field"><label htmlFor="cadastral">Matrícula de Derechos Reales</label>
            <input id="cadastral" value={form.cadastralId} onChange={(e) => setForm({ ...form, cadastralId: e.target.value })} /></div>
        </div>
        <div className="field" style={{ marginTop: '.75rem' }}>
          <label htmlFor="summary">Resumen</label>
          <textarea id="summary" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        </div>
      </section>

      <section className="card">
        <h2>Condiciones financieras</h2>
        <div className="grid-3">
          <div className="field"><label htmlFor="target">Meta de la ronda (USDT)</label>
            <input id="target" inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="equity">Aporte del desarrollador</label>
            <input id="equity" inputMode="numeric" value={form.equity} onChange={(e) => setForm({ ...form, equity: e.target.value.replace(/\D/g, '') })} />
            <p className="field__hint">Bajo 10 % del costo, el riesgo lo carga entero el inversionista.</p></div>
          <div className="field"><label htmlFor="minTicket">Ticket mínimo</label>
            <input id="minTicket" inputMode="numeric" value={form.minimumTicket} onChange={(e) => setForm({ ...form, minimumTicket: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="land">Costo del terreno</label>
            <input id="land" inputMode="numeric" value={form.land} onChange={(e) => setForm({ ...form, land: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="construction">Costo de construcción</label>
            <input id="construction" inputMode="numeric" value={form.construction} onChange={(e) => setForm({ ...form, construction: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor="deadline">Cierre de la ronda</label>
            <input id="deadline" type="date" value={form.fundingDeadline} onChange={(e) => setForm({ ...form, fundingDeadline: e.target.value })} /></div>
          <div className="field"><label htmlFor="interest">Retorno anual (bps)</label>
            <input id="interest" type="number" value={form.interestBps} onChange={(e) => setForm({ ...form, interestBps: Number(e.target.value) })} />
            <p className="field__hint">{form.interestBps / 100} % anual</p></div>
          <div className="field"><label htmlFor="orig">Comisión de originación (bps)</label>
            <input id="orig" type="number" max={300} value={form.originationBps} onChange={(e) => setForm({ ...form, originationBps: Number(e.target.value) })} />
            <p className="field__hint">Tope inmutable del contrato: 300</p></div>
          <div className="field"><label htmlFor="succ">Comisión de éxito (bps)</label>
            <input id="succ" type="number" max={2000} value={form.successBps} onChange={(e) => setForm({ ...form, successBps: Number(e.target.value) })} />
            <p className="field__hint">Tope: 2000. Solo sobre el retorno, nunca sobre el capital.</p></div>
        </div>
      </section>

      <section className="card">
        <h2>Hitos de desembolso
          <span className={`pill ${bpsTotal === 10_000 ? 'pill--ok' : 'pill--bad'}`} style={{ marginLeft: '.75rem' }}>
            {bpsTotal / 100} % de 100 %
          </span>
        </h2>
        <p className="card__lead">
          Los tramos deben sumar exactamente 100 %. El contrato revierte con <code>HitosInvalidos</code> si no.
        </p>

        <div className="stack">
          {milestones.map((m, i) => (
            <div key={i} className="notice" style={{ background: 'var(--color-surface)' }}>
              <div className="grid-2">
                <div className="field"><label>Título</label>
                  <input value={m.title} onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></div>
                <div className="field"><label>Tramo (bps)</label>
                  <input type="number" value={m.bps} onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, bps: Number(e.target.value) } : x))} /></div>
                <div className="field"><label>Rol que acredita</label>
                  <select value={m.role} onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, role: e.target.value as MilestoneDraft['role'] } : x))}>
                    <option value="LEGAL">LEGAL</option><option value="SUPERVISOR">SUPERVISOR</option>
                  </select></div>
                <div className="field"><label>Vence</label>
                  <input type="date" value={m.deadline} onChange={(e) => setMilestones(milestones.map((x, j) => j === i ? { ...x, deadline: e.target.value } : x))} /></div>
              </div>
              <div className="row" style={{ marginTop: '.75rem' }}>
                {EVIDENCE_KINDS.map((kind) => (
                  <button key={kind} type="button"
                    className={`pill ${m.requiredEvidence.includes(kind) ? 'pill--ok' : ''}`}
                    style={{ cursor: 'pointer', background: m.requiredEvidence.includes(kind) ? undefined : 'transparent' }}
                    onClick={() => setMilestones(milestones.map((x, j) => j === i ? {
                      ...x,
                      requiredEvidence: x.requiredEvidence.includes(kind)
                        ? x.requiredEvidence.filter((k) => k !== kind)
                        : [...x.requiredEvidence, kind],
                    } : x))}>
                    {kind}
                  </button>
                ))}
                <button type="button" className="btn btn--danger" style={{ marginLeft: 'auto' }}
                  onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>
                  <Trash2 size={14} aria-hidden /> Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn" style={{ marginTop: '1rem' }}
          onClick={() => setMilestones([...milestones, {
            title: 'Nuevo hito', description: '', bps: 0, role: 'SUPERVISOR',
            deadline: fecha(iso(600)), requiredEvidence: ['INFORME'],
          }])}>
          <Plus size={16} aria-hidden /> Agregar hito
        </button>
      </section>

      {(errors.length > 0 || warnings.length > 0) && (
        <section className="card">
          <h2>Validación del dossier</h2>
          {errors.length > 0 && (
            <div className="notice notice--error">
              <p><strong>Bloqueantes</strong></p>
              <ul>{errors.map((i) => <li key={i.field + i.message}><code>{i.field}</code> — {i.message}</li>)}</ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="notice notice--warn" style={{ marginTop: '.75rem' }}>
              <p><strong>Advertencias</strong></p>
              <ul>{warnings.map((i) => <li key={i.field + i.message}><code>{i.field}</code> — {i.message}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Presentar</h2>
        {created ? (
          <>
            <p className="card__lead">
              Proyecto <strong>{created.id}</strong> (onChainId {created.onChainId}) · estado <strong>{created.status}</strong>
            </p>
            <div className="row">
              <button type="button" className="btn" disabled={busy !== null || created.status !== 'DRAFT'}
                onClick={() => void run('submit', async () => {
                  const { project } = await api.projects.submit(created.id)
                  setCreated(project); setIssues([])
                  return 'Presentado a revisión.'
                })}>
                <Send size={16} aria-hidden /> {busy === 'submit' ? 'Presentando…' : 'Presentar a revisión'}
              </button>

              <button type="button" className="btn" disabled={busy !== null || created.status !== 'SUBMITTED'}
                onClick={() => void run('review', async () => {
                  await api.projects.review(created.id, { decision: 'UNDER_REVIEW', note: 'En revisión desde el panel.', author: 'comite@seedfi.bo' })
                  const { project } = await api.projects.review(created.id, { decision: 'APPROVED', note: 'Aprobado desde el panel de demo.', author: 'comite@seedfi.bo' })
                  setCreated(project)
                  return 'Due diligence completada: APPROVED.'
                })}>
                {busy === 'review' ? 'Revisando…' : 'Revisar y aprobar (demo)'}
              </button>

              <button type="button" className="btn btn--primary" disabled={busy !== null || created.status !== 'APPROVED'}
                onClick={() => void run('publish', async () => {
                  const { project } = await api.projects.publish(created.id)
                  setCreated(project)
                  return 'Publicado en cadena. Los hitos y las comisiones ya son inmutables.'
                })}>
                <Rocket size={16} aria-hidden /> {busy === 'publish' ? 'Publicando…' : 'Publicar en cadena'}
              </button>
            </div>
            <p className="field__hint" style={{ marginTop: '.75rem' }}>
              Publicar es el punto sin retorno: a partir de ahí los hitos, la meta, el plazo y las
              comisiones quedan grabados en el vault.
            </p>
          </>
        ) : (
          <>
            <p className="card__lead">Se guarda como borrador. La validación bloqueante corre al presentarlo.</p>
            <button type="button" className="btn btn--primary" disabled={busy !== null}
              onClick={() => void run('create', async () => {
                const { project, validation } = await api.projects.create(buildDossier())
                setCreated(project); setIssues(validation)
                return `Borrador creado: ${project.id}`
              })}>
              {busy === 'create' ? 'Guardando…' : 'Guardar borrador'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
