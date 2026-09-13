import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { FilePlus2, RefreshCw } from 'lucide-react'
import type { ProjectDossier, ProjectStatus } from '@s2d/shared'
import { formatAmount } from '@s2d/shared'
import { api } from '../../../shared/api/backend'
import { StatusPill, useOnchainProjects } from '../model/onchain'

/** El siguiente paso del ciclo de curaduría, según las transiciones del backend. */
const NEXT_ACTION: Partial<Record<ProjectStatus, string>> = {
  DRAFT: 'Presentar a revisión',
  CHANGES_REQUESTED: 'Volver a presentar',
  SUBMITTED: 'Revisar y aprobar (demo)',
  UNDER_REVIEW: 'Aprobar (demo)',
  APPROVED: 'Publicar en cadena',
}

const COMMITTEE = 'comite@seedfi.bo'

/**
 * Mis proyectos: los dossiers del backend con su estado en el vault.
 *
 * Reemplaza a "Dashboard / Mis proyectos" de la empresa en la maqueta. Desde
 * acá se avanza un proyecto por revisión y publicación — publicar crea el
 * proyecto en el vault con la llave del operador.
 */
export function OnchainProjectsPage() {
  const { address } = useAccount()
  const { items, loading, error: loadError, reload } = useOnchainProjects('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const me = address?.toLowerCase()
  const visible = items.filter(({ project }) => !onlyMine || project.developer.address.toLowerCase() === me)

  async function advance(project: ProjectDossier) {
    setBusy(project.id); setError(null); setFlash(null)
    try {
      switch (project.status) {
        case 'DRAFT':
        case 'CHANGES_REQUESTED':
          await api.projects.submit(project.id)
          setFlash(`${project.name}: presentado a revisión.`)
          break
        case 'SUBMITTED':
          await api.projects.review(project.id, { decision: 'UNDER_REVIEW', note: 'Due diligence iniciada desde Mis proyectos.', author: COMMITTEE })
          await api.projects.review(project.id, { decision: 'APPROVED', note: 'Aprobado desde Mis proyectos (demo).', author: COMMITTEE })
          setFlash(`${project.name}: aprobado.`)
          break
        case 'UNDER_REVIEW':
          await api.projects.review(project.id, { decision: 'APPROVED', note: 'Aprobado desde Mis proyectos (demo).', author: COMMITTEE })
          setFlash(`${project.name}: aprobado.`)
          break
        case 'APPROVED':
          await api.projects.publish(project.id)
          setFlash(`${project.name}: publicado en cadena. Hitos y comisiones ya son inmutables.`)
          break
        default:
          return
      }
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falló la operación.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-toolbar">
          <div>
            <h2>Mis proyectos</h2>
            <p className="card__lead">Dossiers de la plataforma con su estado en cadena.</p>
          </div>
          <div className="row">
            <label className="check-inline">
              <input type="checkbox" checked={onlyMine} disabled={!address} onChange={(e) => setOnlyMine(e.target.checked)} />
              Solo los de mi wallet
            </label>
            <Link className="btn btn--primary" to="/app/developer/new"><FilePlus2 size={16} aria-hidden /> Nuevo proyecto</Link>
            <button type="button" className="btn" disabled={loading} onClick={() => void reload()}>
              <RefreshCw size={16} aria-hidden /> Actualizar
            </button>
          </div>
        </div>
        <p className="field__hint" style={{ marginTop: '.75rem' }}>
          Presentar, aprobar y publicar los ejecuta el backend: la aprobación es del comité de la demo y la
          publicación la firma el operador.
        </p>
      </section>

      {loadError && <div className="notice notice--error"><p><strong>{loadError}</strong></p></div>}
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p>{flash}</p></div>}

      <section className="card">
        {visible.length === 0 ? (
          <p className="card__lead">
            {loading ? 'Cargando proyectos…' : onlyMine ? 'Tu wallet no figura como constructora de ningún proyecto.' : 'Todavía no hay proyectos.'}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Proyecto</th><th>Estado</th><th>Meta</th><th>Recaudado</th><th>Acciones</th></tr></thead>
              <tbody>
                {visible.map(({ project, chain }) => {
                  const action = NEXT_ACTION[project.status]
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/app/opportunities/${project.id}`}><strong>{project.name}</strong></Link><br />
                        <span className="field__hint">{project.city} · {project.id} · onChainId {project.onChainId}</span>
                      </td>
                      <td>
                        <StatusPill status={project.status} />
                        {chain && chain.status !== project.status && <> <StatusPill status={chain.status} /></>}
                      </td>
                      <td className="num">{formatAmount(project.terms.target)}</td>
                      <td className="num">{chain ? formatAmount(chain.raised) : '—'}</td>
                      <td>
                        <div className="row">
                          {action && (
                            <button type="button" className={`btn btn--small ${project.status === 'APPROVED' ? 'btn--primary' : ''}`}
                              disabled={busy !== null} onClick={() => void advance(project)}>
                              {busy === project.id ? 'Procesando…' : action}
                            </button>
                          )}
                          {chain && (
                            <>
                              <Link className="btn btn--small" to={`/app?project=${project.id}`}>Panel</Link>
                              <Link className="btn btn--small" to={`/app/verify?project=${project.id}`}>Hitos</Link>
                              <Link className="btn btn--small" to={`/app/repayments?project=${project.id}`}>Pagos</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
