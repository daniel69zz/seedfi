/* oxlint-disable react/only-export-components */
// ---------------------------------------------------------------------------
//  Piezas compartidas por las pantallas on-chain de /app
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import type { ProjectDossier } from '@s2d/shared'
import { explorerAddressUrl, explorerTxUrl, formatAmount } from '@s2d/shared'
import { api, type ChainEvent, type ChainState } from '../../../shared/api/backend'
import { appChain } from '../../../shared/web3/config'

/**
 * Confirmaciones a esperar en el navegador. Mismo motivo que en el backend:
 * el RPC público de HashKey balancea entre nodos, y leer justo después del
 * recibo puede caer en uno que todavía no vio el bloque.
 */
export const CONFIRMATIONS = appChain.id === 31337 ? 1 : 2

export interface OnchainProject {
  project: ProjectDossier
  /** Estado leído del vault; `null` si el proyecto todavía no está en cadena. */
  chain: ChainState | null
}

/**
 * Proyectos del backend + el estado real de cada vault.
 *
 * `marketplace` trae solo lo que pasó due diligence; `all` incluye borradores
 * y rondas cerradas (lo necesitan Mis proyectos, Portafolio y Pagos).
 */
export function useOnchainProjects(source: 'marketplace' | 'all' = 'marketplace') {
  const [items, setItems] = useState<OnchainProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // El indexador corre solo cada pocos segundos; forzarlo evita mostrar
      // un estado de hace un bloque justo después de una transacción.
      await api.sync().catch(() => undefined)
      const { projects } = source === 'marketplace' ? await api.projects.marketplace() : await api.projects.list()
      const chains = await Promise.all(projects.map((p) =>
        p.vaultAddress ? api.projects.chain(p.id).catch(() => null) : Promise.resolve(null)))
      setItems(projects.map((project, i) => ({ project, chain: chains[i] ?? null })))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los proyectos.')
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => { void load() }, [load])

  return { items, loading, error, reload: load }
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Presentado',
  UNDER_REVIEW: 'En revisión',
  CHANGES_REQUESTED: 'Con observaciones',
  REJECTED: 'Rechazado',
  APPROVED: 'Aprobado',
  PUBLISHED: 'Publicado',
  FUNDING: 'Ronda abierta',
  ACTIVE: 'En obra',
  COMPLETED: 'Completado',
  ROUND_FAILED: 'Ronda fallida',
  MILESTONE_FAILED: 'Hito fallido',
}

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'pill--warn', UNDER_REVIEW: 'pill--warn', CHANGES_REQUESTED: 'pill--warn',
  APPROVED: 'pill--ok', COMPLETED: 'pill--ok',
  PUBLISHED: 'pill--pending', FUNDING: 'pill--pending', ACTIVE: 'pill--pending',
  REJECTED: 'pill--bad', ROUND_FAILED: 'pill--bad', MILESTONE_FAILED: 'pill--bad',
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_TONE[status] ?? ''}`}>{STATUS_LABELS[status] ?? status}</span>
}

export const EVENT_LABELS: Record<string, string> = {
  ProjectCreated: 'Proyecto creado',
  VerifierGranted: 'Verificador registrado',
  Invested: 'Inversión',
  RoundFunded: 'Ronda completada',
  MilestoneReleased: 'Hito liberado',
  MilestoneFailed: 'Hito fallido',
  RoundRefunded: 'Reembolso de ronda',
  RemainingRefunded: 'Reembolso del capital congelado',
  Repaid: 'Repago',
  Claimed: 'Retiro',
  FeeCharged: 'Comisión cobrada',
}

/** Porcentaje recaudado, sin pasar el dinero por punto flotante. */
export function fundedPercent(chain: ChainState | null): number {
  if (!chain || chain.target === '0') return 0
  return Math.min(100, Number((BigInt(chain.raised) * 10_000n) / BigInt(chain.target)) / 100)
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="progress-block">
      <div className="progress" role="progressbar" aria-label={label}
        aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <span className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="field__hint">{label} · {percent.toFixed(1)} %</p>
    </div>
  )
}

export function Metric({ value, label, highlight = false, warn = false }: { value: string; label: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={`metric ${highlight ? 'metric--highlight' : ''} ${warn ? 'metric--warn' : ''}`}>
      <p className="metric__value">{value}</p>
      <p className="metric__label">{label}</p>
    </div>
  )
}

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`

export function TxLink({ hash, chainId }: { hash: string; chainId: number }) {
  const url = explorerTxUrl(chainId, hash)
  return url
    ? <a className="mono" href={url} target="_blank" rel="noreferrer" title={hash}>{short(hash)}</a>
    : <span className="mono" title={hash}>{short(hash)}</span>
}

export function AddressLink({ address, chainId }: { address: string; chainId: number }) {
  const url = explorerAddressUrl(chainId, address)
  return url
    ? <a className="mono" href={url} target="_blank" rel="noreferrer" title={address}>{short(address)}</a>
    : <span className="mono" title={address}>{short(address)}</span>
}

export function describeEvent(event: ChainEvent): string {
  const p = event.payload
  return [
    p.amount ? `${formatAmount(p.amount)} USDT` : '',
    p.investor ? `inversionista ${short(p.investor)}` : '',
    p.index !== undefined ? `hito ${p.index}` : '',
    p.kind ?? '',
    p.reason ?? '',
  ].filter(Boolean).join(' · ')
}

export function EventsTable({ events, chainId }: { events: ChainEvent[]; chainId: number }) {
  return (
    <div className="table-scroll">
      <table className="data">
        <thead><tr><th>Bloque</th><th>Evento</th><th>Detalle</th><th>Transacción</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={`${e.txHash}:${e.logIndex}`}>
              <td className="num">{e.blockNumber}</td>
              <td>{EVENT_LABELS[e.kind] ?? e.kind}</td>
              <td className="mono">{describeEvent(e)}</td>
              <td><TxLink hash={e.txHash} chainId={chainId} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** El motivo legible de un fallo de viem: el nombre del revert si lo hay. */
export function txError(caught: unknown): string {
  const error = caught as { shortMessage?: string; cause?: { data?: { errorName?: string } } } | null
  const reverted = error?.cause?.data?.errorName
  const message = error?.shortMessage ?? (caught instanceof Error ? caught.message : 'La operación falló.')
  const firstLine = message.split('\n')[0] ?? message
  return reverted ? `${firstLine} (${reverted})` : firstLine
}
