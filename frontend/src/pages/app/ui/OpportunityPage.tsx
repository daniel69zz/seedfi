import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { formatAmount } from '@s2d/shared'
import { api, ApiError, type ChainState, type ProjectDetail } from '../../../shared/api/backend'
import { useDeployment } from '../../../shared/web3/contracts'
import {
  AddressLink, EventsTable, fundedPercent, Metric, ProgressBar, STATUS_LABELS, StatusPill,
} from '../model/onchain'

/** Detalle de una oportunidad: dossier del backend + estado del vault. */
export function OnchainOpportunityPage() {
  const { id = '' } = useParams()
  const { chainId } = useDeployment()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [chain, setChain] = useState<ChainState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await api.sync().catch(() => undefined)
      const found = await api.projects.detail(id)
      setDetail(found)
      setChain(found.project.vaultAddress ? await api.projects.chain(id).catch(() => null) : null)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 404
        ? 'El proyecto no existe.'
        : caught instanceof Error ? caught.message : 'No se pudo cargar el proyecto.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (!detail) {
    return (
      <section className="card">
        <Link className="btn" to="/app/opportunities"><ArrowLeft size={16} aria-hidden /> Oportunidades</Link>
        <p className="card__lead" style={{ marginTop: '1rem' }}>{error ?? (loading ? 'Cargando…' : 'Sin datos.')}</p>
      </section>
    )
  }

  const { project } = detail
  const status = chain?.status ?? project.status
  const specs = [...project.milestones].sort((a, b) => a.index - b.index)
  const events = [...(chain?.events ?? detail.events)].reverse()

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Link className="btn" to="/app/opportunities"><ArrowLeft size={16} aria-hidden /> Oportunidades</Link>
        <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden /> Actualizar
        </button>
      </div>

      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}

      <section className="card">
        <div className="card-toolbar">
          <div>
            <p className="field__hint">{project.type} · {project.city} · onChainId {project.onChainId}</p>
            <h2>{project.name}</h2>
          </div>
          <StatusPill status={status} />
        </div>
        <p className="card__lead" style={{ marginTop: '.75rem' }}>{project.summary}</p>

        {chain ? (
          <ProgressBar percent={fundedPercent(chain)}
            label={`${formatAmount(chain.raised)} de ${formatAmount(chain.target)} USDT recaudados`} />
        ) : (
          <div className="notice notice--warn">
            <p>Este proyecto todavía no está en cadena ({STATUS_LABELS[project.status] ?? project.status}).</p>
          </div>
        )}

        <div className="grid-3" style={{ marginTop: '1rem' }}>
          <Metric value={chain ? formatAmount(chain.locked) : '—'} label="Sigue en el escrow" highlight />
          <Metric value={chain ? formatAmount(chain.released) : '—'} label="Liberado a la obra" />
          <Metric value={chain ? formatAmount(chain.totalRepaid) : '—'} label="Repagado" />
          <Metric value={`${project.terms.interestBps / 100} %`} label={`Retorno anual · ${project.terms.termMonths} meses`} />
          <Metric value={formatAmount(project.terms.minimumTicket)} label="Ticket mínimo (USDT)" />
          <Metric value={new Date(project.terms.fundingDeadline).toLocaleDateString('es-BO')} label="Cierre de la ronda" />
        </div>

        <div className="row" style={{ marginTop: '1rem' }}>
          {status === 'FUNDING' && (
            <Link className="btn btn--primary" to={`/app/invest?project=${project.id}`}>
              Invertir <ArrowRight size={16} aria-hidden />
            </Link>
          )}
          {chain && <Link className="btn" to={`/app?project=${project.id}`}>Ver en el panel</Link>}
          {chain && <Link className="btn" to={`/app/verify?project=${project.id}`}>Verificar hitos</Link>}
          {chain && <Link className="btn" to={`/app/repayments?project=${project.id}`}>Pagos</Link>}
        </div>
      </section>

      <section className="card">
        <h2>Contrato y condiciones</h2>
        <dl className="dl-list">
          <div><dt>Vault</dt><dd>{project.vaultAddress ? <AddressLink address={project.vaultAddress} chainId={chainId} /> : '—'}</dd></div>
          <div><dt>Comisión de originación</dt><dd>{project.terms.originationBps / 100} % por tramo</dd></div>
          <div><dt>Comisión de éxito</dt><dd>{project.terms.successBps / 100} % del retorno</dd></div>
          <div><dt>Patrimonio mínimo (prueba ZK)</dt><dd>{Number(project.eligibility.minNetWorth).toLocaleString('es-BO')}</dd></div>
          <div><dt>Jurisdicción exigida</dt><dd>{project.eligibility.allowedJurisdiction}</dd></div>
          <div><dt>Modelo de repago</dt><dd>{project.terms.repaymentModel}</dd></div>
        </dl>
      </section>

      <section className="card">
        <h2>Hitos de desembolso</h2>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>#</th><th>Hito</th><th>Rol</th><th>Tramo</th><th>Monto</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              {specs.map((m) => {
                const onChain = chain?.milestones[m.index]
                const inTurn = !onChain?.released && chain?.status === 'ACTIVE' && chain.nextMilestone === m.index
                return (
                  <tr key={m.index}>
                    <td>{m.index}</td>
                    <td><strong>{m.title}</strong><br /><span className="field__hint">{m.description}</span></td>
                    <td><span className="pill">{m.role}</span></td>
                    <td className="num">{m.bps / 100} %</td>
                    <td className="num">{onChain ? formatAmount(onChain.amount) : '—'}</td>
                    <td>{new Date(m.deadline).toLocaleDateString('es-BO')}</td>
                    <td>
                      <span className={`pill ${onChain?.released ? 'pill--ok' : inTurn ? 'pill--pending' : ''}`}>
                        {onChain?.released ? 'Liberado' : inTurn ? 'En turno' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Estructura y garantías</h2>
        <dl className="dl-list">
          <div><dt>Desarrollador</dt><dd>{project.developer.legalName}</dd></div>
          <div><dt>Trayectoria</dt><dd>{project.developer.completedProjects} proyectos · {project.developer.yearsActive} años</dd></div>
          <div><dt>Wallet de la constructora</dt><dd><AddressLink address={project.developer.address} chainId={chainId} /></dd></div>
          <div><dt>SPV</dt><dd>{project.spv.legalName}</dd></div>
          <div><dt>Matrícula (Derechos Reales)</dt><dd>{project.property.cadastralId}</dd></div>
          <div><dt>Tasación</dt><dd>{formatAmount(project.property.appraisedValue)} USDT · {project.property.appraiser}</dd></div>
          <div><dt>Riesgo</dt><dd>{project.risk ? `${project.risk.grade} (${project.risk.total}/100)` : 'Sin calificar'}</dd></div>
        </dl>
        {project.property.encumbrances.length > 0 && (
          <div className="notice notice--warn" style={{ marginTop: '1rem' }}>
            <p><strong>Gravámenes declarados</strong> — cobran antes que los inversionistas.</p>
            <ul>
              {project.property.encumbrances.map((e) => (
                <li key={`${e.holder}-${e.rank}`}>{e.type} · {e.holder} · {formatAmount(e.amount)} USDT · rango {e.rank}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Verificadores</h2>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Matrícula</th><th>Wallet</th></tr></thead>
            <tbody>
              {project.verifiers.map((v) => (
                <tr key={v.address}>
                  <td>{v.name}<br /><span className="field__hint">{v.organization}</span></td>
                  <td><span className="pill">{v.role}</span></td>
                  <td>{v.license}</td>
                  <td><AddressLink address={v.address} chainId={chainId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Evidencia</h2>
        {detail.evidence.length === 0 ? (
          <p className="card__lead">Todavía no se cargó evidencia.</p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Hito</th><th>Archivo</th><th>Tipo</th><th>sha256</th></tr></thead>
              <tbody>
                {detail.evidence.map((e) => (
                  <tr key={e.id}>
                    <td>{e.milestoneIndex}</td>
                    <td>{e.filename}</td>
                    <td><span className="pill">{e.kind}</span></td>
                    <td className="mono" title={e.sha256}>{e.sha256.slice(0, 14)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Historial on-chain</h2>
        {events.length === 0
          ? <p className="card__lead">Sin eventos indexados.</p>
          : <EventsTable events={events} chainId={chainId} />}
      </section>
    </div>
  )
}
