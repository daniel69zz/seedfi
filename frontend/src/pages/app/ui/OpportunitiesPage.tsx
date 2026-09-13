import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, RefreshCw } from 'lucide-react'
import { formatAmount } from '@s2d/shared'
import { fundedPercent, ProgressBar, StatusPill, useOnchainProjects } from '../model/onchain'

/**
 * Oportunidades en cadena.
 *
 * Reemplaza al catálogo de demostración de `/opportunities` dentro de /app:
 * lo recaudado y el estado salen del vault, no de un archivo mock.
 */
export function OnchainOpportunitiesPage() {
  const { items, loading, error, reload } = useOnchainProjects('marketplace')
  const [onlyOpen, setOnlyOpen] = useState(true)

  const visible = items.filter(({ project, chain }) => !onlyOpen || (chain?.status ?? project.status) === 'FUNDING')

  return (
    <div className="stack">
      <section className="card">
        <div className="card-toolbar">
          <div>
            <h2>Oportunidades en cadena</h2>
            <p className="card__lead">Proyectos que pasaron due diligence y tienen su ronda en el vault.</p>
          </div>
          <div className="row">
            <label className="check-inline">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Solo rondas abiertas
            </label>
            <button type="button" className="btn" disabled={loading} onClick={() => void reload()}>
              <RefreshCw size={16} aria-hidden /> Actualizar
            </button>
          </div>
        </div>
      </section>

      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}

      {loading && items.length === 0 ? (
        <section className="card"><p className="card__lead">Leyendo proyectos y estado del vault…</p></section>
      ) : visible.length === 0 ? (
        <section className="card">
          <p className="card__lead">
            {onlyOpen ? 'No hay rondas abiertas ahora mismo. Desmarcá el filtro para ver las cerradas.' : 'No hay proyectos publicados.'}
          </p>
        </section>
      ) : (
        <div className="onchain-grid">
          {visible.map(({ project, chain }) => {
            const status = chain?.status ?? project.status
            return (
              <article key={project.id} className="onchain-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="pill">{project.type}</span>
                  <StatusPill status={status} />
                </div>
                <h3>{project.name}</h3>
                <p className="field__hint"><MapPin size={14} aria-hidden /> {project.city} · {project.developer.legalName}</p>
                <p className="onchain-card__summary">{project.summary}</p>
                <ProgressBar
                  percent={fundedPercent(chain)}
                  label={`${formatAmount(chain?.raised ?? '0')} de ${formatAmount(project.terms.target)} USDT`}
                />
                <dl className="onchain-facts">
                  <div><dt>Retorno</dt><dd>{project.terms.interestBps / 100} % anual</dd></div>
                  <div><dt>Plazo</dt><dd>{project.terms.termMonths} meses</dd></div>
                  <div><dt>Riesgo</dt><dd>{project.risk?.grade ?? '—'}</dd></div>
                  <div><dt>Ticket mínimo</dt><dd>{formatAmount(project.terms.minimumTicket)}</dd></div>
                </dl>
                <div className="row onchain-card__actions">
                  <Link className="btn" to={`/app/opportunities/${project.id}`}>Ver detalle</Link>
                  {status === 'FUNDING' && (
                    <Link className="btn btn--primary" to={`/app/invest?project=${project.id}`}>
                      Invertir <ArrowRight size={16} aria-hidden />
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
