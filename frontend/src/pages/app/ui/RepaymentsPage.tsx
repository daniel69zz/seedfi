import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { CalendarPlus, Droplets, RefreshCw } from 'lucide-react'
import { formatAmount } from '@s2d/shared'
import { api, ApiError, type RepaymentSchedule } from '../../../shared/api/backend'
import { mockUsdtAbi, projectVaultAbi, useDeployment } from '../../../shared/web3/contracts'
import { AddressLink, CONFIRMATIONS, Metric, STATUS_LABELS, TxLink, txError, useOnchainProjects } from '../model/onchain'

/**
 * Pagos: el repago de la constructora a los inversionistas, en cadena.
 *
 * Reemplaza a "Pagos" de la maqueta. Cada cuota se paga desde la WALLET
 * conectada (aprobar USDT + `repay`) y recién después el backend la marca,
 * verificando el evento `Repaid` en el recibo. El backend no envía un segundo
 * `repay`: antes el panel pagaba desde la wallet y además llamaba a `/pay`, que
 * repagaba otra vez con la llave del operador.
 */
export function OnchainRepaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { address, isConnected } = useAccount()
  const { deployment, chainId, problem } = useDeployment()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { items, loading, error: loadError, reload } = useOnchainProjects('all')

  const onChain = useMemo(() => items.filter((i) => i.chain !== null), [items])
  const selected = onChain.find((i) => i.project.id === searchParams.get('project')) ?? onChain[0] ?? null

  const [schedule, setSchedule] = useState<RepaymentSchedule | null>(null)
  const [usdtBalance, setUsdtBalance] = useState<bigint | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const selectedId = selected?.project.id
  const loadSchedule = useCallback(async () => {
    if (!selectedId) { setSchedule(null); return }
    try {
      const { schedule: found } = await api.projects.repaymentSchedule(selectedId)
      setSchedule(found as RepaymentSchedule)
    } catch (caught) {
      setSchedule(null)
      if (!(caught instanceof ApiError && caught.status === 404)) setError(txError(caught))
    }
  }, [selectedId])

  const loadBalance = useCallback(async () => {
    if (!address || !deployment || !publicClient) { setUsdtBalance(null); return }
    try {
      setUsdtBalance(await publicClient.readContract({
        address: deployment.usdt, abi: mockUsdtAbi, functionName: 'balanceOf', args: [address],
      }) as bigint)
    } catch {
      setUsdtBalance(null)
    }
  }, [address, deployment, publicClient])

  useEffect(() => { void loadSchedule() }, [loadSchedule])
  useEffect(() => { void loadBalance() }, [loadBalance])

  async function generate() {
    if (!selected) return
    setBusy('generate'); setError(null); setFlash(null)
    try {
      const { schedule: created } = await api.projects.generateRepayment(selected.project.id)
      setSchedule(created as RepaymentSchedule)
      setFlash('Calendario generado.')
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setBusy(null)
    }
  }

  async function faucet() {
    if (!deployment || !publicClient) return
    setBusy('faucet'); setError(null); setFlash(null)
    try {
      const hash = await writeContractAsync({ address: deployment.usdt, abi: mockUsdtAbi, functionName: 'faucet', args: [] })
      await publicClient.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS })
      setFlash(`+10.000 USDT de prueba · tx ${hash}`)
      await loadBalance()
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setBusy(null)
    }
  }

  async function pay(index: number, amount: bigint) {
    if (!selected || !deployment || !publicClient || !address) return
    setBusy(`pay-${index}`); setError(null); setFlash(null)
    try {
      const allowance = await publicClient.readContract({
        address: deployment.usdt, abi: mockUsdtAbi, functionName: 'allowance', args: [address, deployment.vault],
      }) as bigint
      if (allowance < amount) {
        setStep('1/3 · Aprobando USDT para el vault…')
        const approveHash = await writeContractAsync({
          address: deployment.usdt, abi: mockUsdtAbi, functionName: 'approve', args: [deployment.vault, amount],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: CONFIRMATIONS })
      }
      setStep('2/3 · Enviando el repago al vault…')
      const hash = await writeContractAsync({
        address: deployment.vault, abi: projectVaultAbi, functionName: 'repay',
        args: [BigInt(selected.project.onChainId), amount],
      })
      await publicClient.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS })
      setStep('3/3 · Registrando la cuota…')
      const { schedule: updated } = await api.projects.confirmRepayment(selected.project.id, index, hash)
      setSchedule(updated)
      setFlash(`Cuota ${index + 1} pagada · tx ${hash}`)
      await Promise.all([loadBalance(), reload()])
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setBusy(null)
      setStep(null)
    }
  }

  if (problem) {
    return <section className="card"><h2>Pagos</h2><p className="card__lead">{problem}</p></section>
  }
  if (!loading && onChain.length === 0) {
    return (
      <section className="card">
        <h2>Pagos</h2>
        <p className="card__lead">No hay proyectos en cadena. Publicá uno desde <Link to="/app/projects">Mis proyectos</Link>.</p>
      </section>
    )
  }

  const project = selected?.project ?? null
  const chain = selected?.chain ?? null
  const isBuilder = Boolean(address && project && project.developer.address.toLowerCase() === address.toLowerCase())
  const paidCount = schedule?.installments.filter((i) => i.status === 'PAID').length ?? 0
  const now = Date.now()

  return (
    <div className="stack">
      <section className="card">
        <div className="card-toolbar">
          <div>
            <h2>Pagos a inversionistas</h2>
            <p className="card__lead">
              La constructora repaga al vault y el contrato reparte a prorrata. La comisión de éxito solo se cobra sobre el retorno.
            </p>
          </div>
          <div className="row">
            <button type="button" className="btn" disabled={!isConnected || busy !== null} onClick={() => void faucet()}>
              <Droplets size={16} aria-hidden /> {busy === 'faucet' ? 'Enviando…' : 'Faucet USDT'}
            </button>
            <button type="button" className="btn" disabled={loading} onClick={() => { void reload(); void loadSchedule(); void loadBalance() }}>
              <RefreshCw size={16} aria-hidden /> Actualizar
            </button>
          </div>
        </div>

        <div className="field" style={{ marginTop: '1rem' }}>
          <label htmlFor="rproject">Proyecto</label>
          <select id="rproject" value={project?.id ?? ''} onChange={(e) => setSearchParams({ project: e.target.value })}>
            {onChain.map(({ project: p, chain: c }) => (
              <option key={p.id} value={p.id}>{p.name} — {STATUS_LABELS[c?.status ?? p.status] ?? p.status}</option>
            ))}
          </select>
        </div>

        {project && chain && (
          <>
            <div className="grid-3" style={{ marginTop: '1rem' }}>
              <Metric value={STATUS_LABELS[chain.status] ?? chain.status} label="Estado en el vault" />
              <Metric value={formatAmount(chain.raised)} label="Capital recaudado" />
              <Metric value={formatAmount(chain.totalRepaid)} label="Repagado en cadena" highlight />
              <Metric value={schedule ? `${paidCount}/${schedule.installments.length}` : '—'} label="Cuotas pagadas" />
              <Metric value={usdtBalance === null ? '—' : formatAmount(usdtBalance.toString())} label="Tu saldo USDT" />
            </div>
            <p className="field__hint" style={{ marginTop: '.75rem' }}>
              Constructora: <AddressLink address={project.developer.address} chainId={chainId} />
            </p>
            {isConnected && !isBuilder && (
              <div className="notice notice--warn" style={{ marginTop: '1rem' }}>
                <p>Tu wallet no es la de la constructora. Podés pagar igual, pero los USDT salen de <strong>tu</strong> wallet.</p>
              </div>
            )}
            {!isConnected && (
              <div className="notice" style={{ marginTop: '1rem' }}><p>Conectá tu wallet para pagar cuotas.</p></div>
            )}
          </>
        )}
      </section>

      {loadError && <div className="notice notice--error"><p><strong>{loadError}</strong></p></div>}
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {step && <div className="notice"><p>{step}</p></div>}
      {flash && <div className="notice notice--ok"><p className="mono">{flash}</p></div>}

      {project && chain && (
        <section className="card">
          <h2>Calendario de repagos</h2>
          {!schedule ? (
            <>
              <p className="card__lead">Todavía no hay calendario para este proyecto.</p>
              <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={() => void generate()}>
                <CalendarPlus size={16} aria-hidden /> {busy === 'generate' ? 'Generando…' : 'Generar calendario'}
              </button>
            </>
          ) : (
            <>
              <p className="card__lead">Total comprometido: {formatAmount(schedule.totalDue)} USDT en {schedule.periods} cuotas.</p>
              <div className="table-scroll">
                <table className="data">
                  <thead><tr><th>Cuota</th><th>Vence</th><th>Capital</th><th>Interés</th><th>Total</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {schedule.installments.map((cuota) => {
                      const overdue = cuota.status !== 'PAID' && Date.parse(cuota.dueDate) < now
                      return (
                        <tr key={cuota.index}>
                          <td>{cuota.index + 1}/{schedule.installments.length}</td>
                          <td>{new Date(cuota.dueDate).toLocaleDateString('es-BO')}</td>
                          <td className="num">{formatAmount(cuota.capitalPortion)}</td>
                          <td className="num">{formatAmount(cuota.interestPortion)}</td>
                          <td className="num"><strong>{formatAmount(cuota.amount)}</strong></td>
                          <td>
                            {cuota.status === 'PAID'
                              ? <span className="pill pill--ok">Pagada</span>
                              : overdue ? <span className="pill pill--bad">Vencida</span> : <span className="pill pill--pending">Pendiente</span>}
                          </td>
                          <td>
                            {cuota.status === 'PAID' ? (
                              cuota.txHash ? <TxLink hash={cuota.txHash} chainId={chainId} /> : '—'
                            ) : (
                              <button type="button" className="btn btn--small btn--primary"
                                disabled={!isConnected || busy !== null}
                                onClick={() => void pay(cuota.index, BigInt(cuota.amount))}>
                                {busy === `pay-${cuota.index}` ? 'Pagando…' : 'Pagar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="field__hint" style={{ marginTop: '.75rem' }}>
                Cada pago son hasta dos firmas en tu wallet (aprobar USDT y <code>repay</code>). El backend marca la cuota
                solo después de comprobar el evento <code>Repaid</code> en el recibo. Si el contrato no acepta el repago en
                el estado actual del proyecto, la transacción revierte y verás el motivo.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
