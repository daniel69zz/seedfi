import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { Download, RefreshCw, Undo2 } from 'lucide-react'
import { formatAmount } from '@s2d/shared'
import { projectVaultAbi, useDeployment } from '../../../shared/web3/contracts'
import { CONFIRMATIONS, Metric, StatusPill, txError, useOnchainProjects, type OnchainProject } from '../model/onchain'

interface Position {
  item: OnchainProject
  invested: bigint
  claimable: bigint
  claimed: bigint
  tookRoundRefund: boolean
  tookRemainingRefund: boolean
}

/**
 * Portafolio: las posiciones de la wallet conectada, leídas del vault.
 *
 * Reemplaza a "Mis inversiones" y "Portafolio" de la maqueta. Ningún número de
 * acá sale de la base de datos: una plataforma que le muestra al inversionista
 * sus propios registros le está pidiendo que le crea.
 */
export function OnchainPortfolioPage() {
  const { address, isConnected } = useAccount()
  const { deployment, problem } = useDeployment()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { items, loading, error: loadError, reload } = useOnchainProjects('all')

  const [positions, setPositions] = useState<Position[]>([])
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const readPositions = useCallback(async () => {
    if (!address || !deployment || !publicClient) { setPositions([]); return }
    setReading(true)
    try {
      const read = <T,>(functionName: string, onChainId: number) => publicClient.readContract({
        address: deployment.vault, abi: projectVaultAbi, functionName, args: [BigInt(onChainId), address],
      } as never) as Promise<T>

      const rows = await Promise.all(items.filter((i) => i.chain !== null).map(async (item) => {
        const id = item.project.onChainId
        const [invested, claimable, claimed, tookRoundRefund, tookRemainingRefund] = await Promise.all([
          read<bigint>('invested', id), read<bigint>('claimable', id), read<bigint>('claimed', id),
          read<boolean>('tookRoundRefund', id), read<boolean>('tookRemainingRefund', id),
        ])
        return { item, invested, claimable, claimed, tookRoundRefund, tookRemainingRefund }
      }))
      setPositions(rows.filter((r) => r.invested > 0n))
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setReading(false)
    }
  }, [items, address, deployment, publicClient])

  useEffect(() => { void readPositions() }, [readPositions])

  async function run(label: string, action: () => Promise<`0x${string}`>) {
    setBusy(label); setError(null); setFlash(null)
    try {
      const hash = await action()
      await publicClient?.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS })
      setFlash(`Confirmada · tx ${hash}`)
      await reload()
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setBusy(null)
    }
  }

  if (!isConnected || !address) {
    return <section className="card"><h2>Portafolio</h2><p className="card__lead">Conectá tu wallet para ver tus posiciones en cadena.</p></section>
  }
  if (problem) {
    return <section className="card"><h2>Portafolio</h2><p className="card__lead">{problem}</p></section>
  }

  const totals = positions.reduce(
    (acc, p) => ({ invested: acc.invested + p.invested, claimable: acc.claimable + p.claimable, claimed: acc.claimed + p.claimed }),
    { invested: 0n, claimable: 0n, claimed: 0n },
  )

  return (
    <div className="stack">
      <section className="card">
        <div className="card-toolbar">
          <div>
            <h2>Tu portafolio</h2>
            <p className="card__lead">Posiciones leídas directamente del vault para tu wallet.</p>
          </div>
          <button type="button" className="btn" disabled={loading || reading} onClick={() => void reload()}>
            <RefreshCw size={16} aria-hidden /> Actualizar
          </button>
        </div>
        <div className="grid-3" style={{ marginTop: '1rem' }}>
          <Metric value={formatAmount(totals.invested.toString())} label="Capital invertido (USDT)" />
          <Metric value={formatAmount(totals.claimable.toString())} label="Disponible para retirar" highlight />
          <Metric value={formatAmount(totals.claimed.toString())} label="Ya retirado" />
          <Metric value={String(positions.length)} label="Proyectos con posición" />
        </div>
      </section>

      {loadError && <div className="notice notice--error"><p><strong>{loadError}</strong></p></div>}
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p className="mono">{flash}</p></div>}

      <section className="card">
        <h2>Posiciones</h2>
        {positions.length === 0 ? (
          <p className="card__lead">
            {loading || reading
              ? 'Leyendo el vault…'
              : <>Esta wallet no tiene inversiones. <Link to="/app/opportunities">Ver oportunidades</Link></>}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>Proyecto</th><th>Estado</th><th>Invertido</th><th>De la ronda</th><th>Disponible</th><th>Retirado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {positions.map(({ item: { project, chain }, invested, claimable, claimed, tookRoundRefund, tookRemainingRefund }) => {
                  const status = chain?.status ?? project.status
                  const share = chain && chain.raised !== '0' ? Number((invested * 10_000n) / BigInt(chain.raised)) / 100 : 0
                  const vault = deployment!.vault
                  const onChainId = BigInt(project.onChainId)
                  return (
                    <tr key={project.id}>
                      <td><Link to={`/app/opportunities/${project.id}`}><strong>{project.name}</strong></Link><br /><span className="field__hint">{project.city}</span></td>
                      <td><StatusPill status={status} /></td>
                      <td className="num">{formatAmount(invested.toString())}</td>
                      <td className="num">{share.toFixed(2)} %</td>
                      <td className="num">{formatAmount(claimable.toString())}</td>
                      <td className="num">{formatAmount(claimed.toString())}</td>
                      <td>
                        <div className="row">
                          {claimable > 0n && (
                            <button type="button" className="btn btn--small btn--primary" disabled={busy !== null}
                              onClick={() => void run(`claim-${project.id}`, () => writeContractAsync({
                                address: vault, abi: projectVaultAbi, functionName: 'claim', args: [onChainId],
                              }))}>
                              <Download size={14} aria-hidden /> {busy === `claim-${project.id}` ? 'Retirando…' : 'Retirar'}
                            </button>
                          )}
                          {status === 'ROUND_FAILED' && !tookRoundRefund && (
                            <button type="button" className="btn btn--small" disabled={busy !== null}
                              onClick={() => void run(`refund-${project.id}`, () => writeContractAsync({
                                address: vault, abi: projectVaultAbi, functionName: 'refund', args: [onChainId],
                              }))}>
                              <Undo2 size={14} aria-hidden /> {busy === `refund-${project.id}` ? 'Reembolsando…' : 'Reembolso de ronda'}
                            </button>
                          )}
                          {status === 'MILESTONE_FAILED' && !tookRemainingRefund && (
                            <button type="button" className="btn btn--small" disabled={busy !== null}
                              onClick={() => void run(`remaining-${project.id}`, () => writeContractAsync({
                                address: vault, abi: projectVaultAbi, functionName: 'refundRemaining', args: [onChainId],
                              }))}>
                              <Undo2 size={14} aria-hidden /> {busy === `remaining-${project.id}` ? 'Recuperando…' : 'Recuperar capital'}
                            </button>
                          )}
                          <Link className="btn btn--small" to={`/app?project=${project.id}`}>Panel</Link>
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
