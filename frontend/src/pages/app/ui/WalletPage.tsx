import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { formatUnits } from 'viem'
import { Droplets, RefreshCw } from 'lucide-react'
import { formatAmount } from '@s2d/shared'
import { api, ApiError, type Investor } from '../../../shared/api/backend'
import { mockUsdtAbi, projectVaultAbi, useDeployment } from '../../../shared/web3/contracts'
import { appChain } from '../../../shared/web3/config'
import { AddressLink, CONFIRMATIONS, EVENT_LABELS, Metric, TxLink, txError, useOnchainProjects } from '../model/onchain'

/** Movimientos que ENTRAN a la wallet; el resto (inversión, repago) salen. */
const INFLOW = new Set(['Claimed', 'RoundRefunded', 'RemainingRefunded', 'MilestoneReleased'])

/**
 * Wallet y movimientos, en cadena.
 *
 * Saldos leídos del nodo y movimientos sacados de los eventos de los vaults:
 * reemplaza a "Movimientos" y al saldo fijo de la maqueta.
 */
export function OnchainWalletPage() {
  const { address, isConnected } = useAccount()
  const { deployment, chainId, problem } = useDeployment()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { items, loading, error: loadError, reload } = useOnchainProjects('all')

  const [balances, setBalances] = useState<{ native: bigint; usdt: bigint; kyc: boolean } | null>(null)
  const [investor, setInvestor] = useState<Investor | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const loadBalances = useCallback(async () => {
    if (!address || !deployment || !publicClient) { setBalances(null); return }
    try {
      const [native, usdt, kyc] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({ address: deployment.usdt, abi: mockUsdtAbi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.readContract({ address: deployment.vault, abi: projectVaultAbi, functionName: 'kycApproved', args: [address] }) as Promise<boolean>,
      ])
      setBalances({ native, usdt, kyc })
    } catch (caught) {
      setError(txError(caught))
    }
    try {
      const { investor: found } = await api.investors.detail(address)
      setInvestor(found)
    } catch (caught) {
      setInvestor(null)
      if (!(caught instanceof ApiError && caught.status === 404)) setError(txError(caught))
    }
  }, [address, deployment, publicClient])

  useEffect(() => { void loadBalances() }, [loadBalances])

  const movements = useMemo(() => {
    if (!address) return []
    const me = address.toLowerCase()
    return items
      .flatMap(({ project, chain }) => (chain?.events ?? [])
        .filter((e) => e.payload.investor?.toLowerCase() === me
          || (project.developer.address.toLowerCase() === me && (e.kind === 'MilestoneReleased' || e.kind === 'Repaid')))
        .map((event) => ({ project, event })))
      .sort((a, b) => b.event.blockNumber - a.event.blockNumber || b.event.logIndex - a.event.logIndex)
  }, [items, address])

  async function faucet() {
    if (!deployment || !publicClient) return
    setBusy(true); setError(null); setFlash(null)
    try {
      const hash = await writeContractAsync({ address: deployment.usdt, abi: mockUsdtAbi, functionName: 'faucet', args: [] })
      await publicClient.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS })
      setFlash(`+10.000 USDT de prueba · tx ${hash}`)
      await loadBalances()
    } catch (caught) {
      setError(txError(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!isConnected || !address) {
    return <section className="card"><h2>Movimientos</h2><p className="card__lead">Conectá tu wallet para ver tus saldos y movimientos en cadena.</p></section>
  }
  if (problem) {
    return <section className="card"><h2>Movimientos</h2><p className="card__lead">{problem}</p></section>
  }

  const symbol = appChain.nativeCurrency.symbol

  return (
    <div className="stack">
      <section className="card">
        <div className="card-toolbar">
          <div>
            <h2>Tu wallet</h2>
            <p className="card__lead"><AddressLink address={address} chainId={chainId} /> · {appChain.name}</p>
          </div>
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => void faucet()}>
              <Droplets size={16} aria-hidden /> {busy ? 'Enviando…' : 'Faucet USDT (+10.000)'}
            </button>
            <button type="button" className="btn" disabled={loading} onClick={() => { void loadBalances(); void reload() }}>
              <RefreshCw size={16} aria-hidden /> Actualizar
            </button>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: '1rem' }}>
          <Metric
            value={balances ? Number(formatUnits(balances.native, appChain.nativeCurrency.decimals)).toLocaleString('es-BO', { maximumFractionDigits: 5 }) : '—'}
            label={`${symbol} para gas`}
            warn={balances?.native === 0n}
          />
          <Metric value={balances ? formatAmount(balances.usdt.toString()) : '—'} label="USDT disponible" highlight />
          <Metric value={balances ? (balances.kyc ? 'Aprobado' : 'Pendiente') : '—'} label="KYC en el vault" />
          <Metric value={investor ? investor.displayName : 'Sin registro'} label="Registro en la plataforma" />
        </div>

        {balances?.native === 0n && (
          <div className="notice notice--warn" style={{ marginTop: '1rem' }}>
            <p>Sin {symbol} no podés firmar transacciones. Conseguí gas de testnet con el bridge de HashKey Chain.</p>
          </div>
        )}
        {balances && !balances.kyc && (
          <p className="field__hint" style={{ marginTop: '.75rem' }}>
            Para invertir necesitás KYC aprobado y una credencial: <Link to="/app/identity">Identidad</Link>.
          </p>
        )}
      </section>

      {loadError && <div className="notice notice--error"><p><strong>{loadError}</strong></p></div>}
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p className="mono">{flash}</p></div>}

      <section className="card">
        <h2>Movimientos en cadena</h2>
        {movements.length === 0 ? (
          <p className="card__lead">{loading ? 'Leyendo eventos…' : 'Esta wallet todavía no tiene movimientos en los vaults.'}</p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Bloque</th><th>Proyecto</th><th>Movimiento</th><th>Monto (USDT)</th><th>Transacción</th></tr></thead>
              <tbody>
                {movements.map(({ project, event }) => {
                  const inflow = INFLOW.has(event.kind)
                  return (
                    <tr key={`${event.txHash}:${event.logIndex}`}>
                      <td className="num">{event.blockNumber}</td>
                      <td><Link to={`/app/opportunities/${project.id}`}>{project.name}</Link></td>
                      <td>{EVENT_LABELS[event.kind] ?? event.kind}</td>
                      <td className={`num ${inflow ? 'amount-in' : 'amount-out'}`}>
                        {event.payload.amount ? `${inflow ? '+' : '−'}${formatAmount(event.payload.amount)}` : '—'}
                      </td>
                      <td><TxLink hash={event.txHash} chainId={chainId} /></td>
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
