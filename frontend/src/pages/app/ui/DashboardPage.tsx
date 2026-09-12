import { useCallback, useEffect, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { RefreshCw, Download, TimerOff } from 'lucide-react'
import type { ProjectDossier } from '@s2d/shared'
import { formatAmount } from '@s2d/shared'
import { api, type ChainState } from '../../../shared/api/backend'
import { projectVaultAbi, useDeployment } from '../../../shared/web3/contracts'

const EVENT_LABELS: Record<string, string> = {
  ProjectCreated: 'Proyecto creado',
  VerifierGranted: 'Verificador registrado',
  Invested: 'Inversión recibida',
  RoundFunded: 'Ronda completada',
  MilestoneReleased: 'Hito liberado',
  MilestoneFailed: 'Hito fallido',
  RoundRefunded: 'Reembolso de ronda',
  RemainingRefunded: 'Reembolso del capital congelado',
  Repaid: 'Repago recibido',
  Claimed: 'Retiro de inversionista',
  FeeCharged: 'Comisión cobrada',
}

/**
 * Panel de estado  (backlog T14)
 *
 * Todo lo que se muestra acá sale de la CADENA, no de la base de datos. El
 * backend indexa los eventos para poder listarlos rápido, pero los saldos y el
 * estado salen de `projects()` en el vault.
 *
 * La distinción importa: una plataforma que muestra sus propios registros le
 * está pidiendo al inversionista que le crea. Acá cada número tiene un hash de
 * transacción detrás.
 */
export function DashboardPage() {
  const { address } = useAccount()
  const { deployment, problem } = useDeployment()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [projects, setProjects] = useState<ProjectDossier[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [chain, setChain] = useState<ChainState | null>(null)
  const [position, setPosition] = useState<{ invested: bigint; claimable: bigint } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    void api.projects.list()
      .then(({ projects: found }) => {
        const onChain = found.filter((p) => p.vaultAddress !== null)
        setProjects(onChain)
        if (onChain[0]) setSelectedId(onChain[0].id)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los proyectos.'))
  }, [])

  const project = projects.find((p) => p.id === selectedId) ?? null

  const load = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      await api.sync()
      const state = await api.projects.chain(project.id)
      setChain(state)

      if (address && deployment && publicClient) {
        const [invested, claimable] = await Promise.all([
          publicClient.readContract({ address: deployment.vault, abi: projectVaultAbi, functionName: 'invested', args: [BigInt(project.onChainId), address] }) as Promise<bigint>,
          publicClient.readContract({ address: deployment.vault, abi: projectVaultAbi, functionName: 'claimable', args: [BigInt(project.onChainId), address] }) as Promise<bigint>,
        ])
        setPosition({ invested, claimable })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el estado en cadena.')
    }
  }, [project, address, deployment, publicClient])

  useEffect(() => { void load() }, [load])

  async function run(label: string, action: () => Promise<`0x${string}`>) {
    setBusy(label); setError(null); setFlash(null)
    try {
      const hash = await action()
      await publicClient?.waitForTransactionReceipt({ hash })
      await load()
      setFlash(`Confirmada. tx ${hash}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'La transacción falló.'
      setError(message.split('\n')[0] ?? message)
    } finally {
      setBusy(null)
    }
  }

  if (problem) return <section className="card"><h2>Panel</h2><p className="card__lead">{problem}</p></section>
  if (projects.length === 0) {
    return <section className="card"><h2>Panel</h2>
      <p className="card__lead">{error ?? 'No hay proyectos en cadena. Corré npm run seed -- --reset.'}</p></section>
  }

  const frozen = chain?.status === 'MILESTONE_FAILED'

  return (
    <div className="stack">
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="field" style={{ flex: 1, minWidth: '260px' }}>
            <label htmlFor="dproject">Proyecto</label>
            <select id="dproject" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
            </select>
          </div>
          <button type="button" className="btn" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden /> Actualizar
          </button>
        </div>
      </section>

      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p className="mono">{flash}</p></div>}

      {chain && (
        <>
          <section className="card">
            <h2>Estado del capital</h2>
            <div className="grid-3">
              <div className="metric">
                <p className="metric__value">{formatAmount(chain.raised)}</p>
                <p className="metric__label">Recaudado de {formatAmount(chain.target)}</p>
              </div>
              <div className="metric metric--highlight">
                <p className="metric__value">{formatAmount(chain.locked)}</p>
                <p className="metric__label">Sigue en el escrow</p>
              </div>
              <div className="metric">
                <p className="metric__value">{formatAmount(chain.released)}</p>
                <p className="metric__label">Liberado a la obra</p>
              </div>
              <div className="metric">
                <p className="metric__value">{formatAmount(chain.totalRepaid)}</p>
                <p className="metric__label">Repagado a inversionistas</p>
              </div>
              <div className={`metric ${frozen ? 'metric--warn' : ''}`}>
                <p className="metric__value">{formatAmount(chain.frozenRemaining)}</p>
                <p className="metric__label">Congelado para reembolso</p>
              </div>
              <div className="metric">
                <p className="metric__value">{chain.status}</p>
                <p className="metric__label">Estado on-chain</p>
              </div>
            </div>
            <p className="field__hint" style={{ marginTop: '1rem' }}>
              «Sigue en el escrow» es el número que le importa al inversionista: es lo que puede
              recuperar si un hito falla.
            </p>
          </section>

          {position && (
            <section className="card">
              <h2>Tu posición</h2>
              <div className="grid-3">
                <div className="metric">
                  <p className="metric__value">{formatAmount(position.invested.toString())}</p>
                  <p className="metric__label">Invertido</p>
                </div>
                <div className="metric metric--highlight">
                  <p className="metric__value">{formatAmount(position.claimable.toString())}</p>
                  <p className="metric__label">Disponible para retirar</p>
                </div>
                <div className="metric">
                  <p className="metric__value">
                    {position.invested > 0n && chain.raised !== '0'
                      ? `${(Number(position.invested * 10000n / BigInt(chain.raised)) / 100).toFixed(2)} %`
                      : '—'}
                  </p>
                  <p className="metric__label">De la ronda</p>
                </div>
              </div>

              <div className="row" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn--primary"
                  disabled={busy !== null || position.claimable === 0n}
                  onClick={() => void run('claim', () => writeContractAsync({
                    address: deployment!.vault, abi: projectVaultAbi, functionName: 'claim',
                    args: [BigInt(project!.onChainId)],
                  }))}>
                  <Download size={16} aria-hidden /> {busy === 'claim' ? 'Retirando…' : 'Retirar'}
                </button>

                {frozen && (
                  <button type="button" className="btn"
                    disabled={busy !== null}
                    onClick={() => void run('refund', () => writeContractAsync({
                      address: deployment!.vault, abi: projectVaultAbi, functionName: 'refundRemaining',
                      args: [BigInt(project!.onChainId)],
                    }))}>
                    {busy === 'refund' ? 'Reembolsando…' : 'Recuperar capital no liberado'}
                  </button>
                )}
              </div>

              {frozen && (
                <p className="field__hint" style={{ marginTop: '.75rem' }}>
                  <code>refundRemaining</code> es permissionless: no necesita la firma de la plataforma,
                  no paga comisión, y devuelve a prorrata el 100 % de lo que no llegó a liberarse.
                </p>
              )}
            </section>
          )}

          <section className="card">
            <h2>Hitos</h2>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr><th>#</th><th>Tramo</th><th>Monto</th><th>Rol</th><th>Vence</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {chain.milestones.map((m) => (
                    <tr key={m.index}>
                      <td>{m.index}</td>
                      <td className="num">{m.bps / 100} %</td>
                      <td className="num">{formatAmount(m.amount)}</td>
                      <td><span className="pill">{m.role}</span></td>
                      <td>{new Date(m.deadline).toLocaleDateString('es-BO')}</td>
                      <td>
                        <span className={`pill ${m.released ? 'pill--ok' : m.index === chain.nextMilestone ? 'pill--pending' : ''}`}>
                          {m.released ? 'Liberado' : m.index === chain.nextMilestone ? 'En turno' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {chain.status === 'ACTIVE' && (
              <button type="button" className="btn" style={{ marginTop: '1rem' }}
                disabled={busy !== null}
                onClick={() => void run('expire', () => writeContractAsync({
                  address: deployment!.vault, abi: projectVaultAbi, functionName: 'expireMilestone',
                  args: [BigInt(project!.onChainId)],
                }))}>
                <TimerOff size={16} aria-hidden /> {busy === 'expire' ? 'Enviando…' : 'Frenar hito vencido'}
              </button>
            )}
            <p className="field__hint" style={{ marginTop: '.5rem' }}>
              <code>expireMilestone</code> lo puede llamar cualquiera. Si el verificador desaparece,
              el capital no queda atrapado.
            </p>
          </section>

          <section className="card">
            <h2>Historial on-chain</h2>
            {chain.events.length === 0 ? (
              <p className="card__lead">Sin eventos indexados todavía.</p>
            ) : (
              <div className="table-scroll">
                <table className="data">
                  <thead><tr><th>Bloque</th><th>Evento</th><th>Detalle</th><th>Transacción</th></tr></thead>
                  <tbody>
                    {[...chain.events].reverse().map((e) => (
                      <tr key={`${e.txHash}:${e.logIndex}`}>
                        <td className="num">{e.blockNumber}</td>
                        <td>{EVENT_LABELS[e.kind] ?? e.kind}</td>
                        <td className="mono">
                          {e.payload.amount ? `${formatAmount(e.payload.amount)} USDT` : ''}
                          {e.payload.investor ? ` · ${e.payload.investor.slice(0, 10)}…` : ''}
                          {e.payload.index !== undefined ? ` · hito ${e.payload.index}` : ''}
                          {e.payload.reason ? ` · ${e.payload.reason}` : ''}
                        </td>
                        <td className="mono">{e.txHash.slice(0, 18)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
