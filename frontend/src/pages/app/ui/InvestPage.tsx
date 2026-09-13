import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { formatUnits, parseUnits, type Address } from 'viem'
import { CheckCircle2, Circle, Loader2, ShieldCheck, Wallet2 } from 'lucide-react'
import type { ProjectDossier } from '@s2d/shared'
import { formatAmount } from '@s2d/shared'
import { api, type ChainState } from '../../../shared/api/backend'
import { eligibilityRegistryAbi, mockUsdtAbi, projectVaultAbi, useDeployment, USDT_DECIMALS } from '../../../shared/web3/contracts'
import { useEligibilityProof } from '../../../features/zk-eligibility/model/useEligibilityProof'

type Step = 'eligibility' | 'approve' | 'invest' | 'done'

/**
 * Invertir  (backlog T8 + T9)
 *
 * Tres pasos, en este orden y no en otro:
 *
 *   1. PROBAR ELEGIBILIDAD — la prueba ZK se genera en este navegador y se
 *      registra en cadena. Sin esto, `invest` revierte con `ElegibilidadRequerida`.
 *   2. APROBAR USDT — el vault tiene que poder mover el token.
 *   3. INVERTIR — el capital entra al escrow, no a la cuenta del desarrollador.
 *
 * Se muestran los tres desde el principio, aunque estén bloqueados, porque un
 * flujo que revela sus pasos de a uno deja al usuario sin saber cuánto falta.
 */
export function InvestPage() {
  const { address, isConnected } = useAccount()
  const { deployment, problem } = useDeployment()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { state: proverState, prove, credential } = useEligibilityProof(address)
  // `?project=` llega desde Oportunidades: entra con ese proyecto ya elegido.
  const [searchParams] = useSearchParams()

  const [projects, setProjects] = useState<ProjectDossier[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [chain, setChain] = useState<ChainState | null>(null)
  const [amount, setAmount] = useState('10000')
  const [busy, setBusy] = useState<Step | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txs, setTxs] = useState<{ label: string; hash: string }[]>([])
  const [eligible, setEligible] = useState(false)
  const [balance, setBalance] = useState<bigint | null>(null)

  const project = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId])

  // ── carga ────────────────────────────────────────────────────────────
  useEffect(() => {
    void api.projects.marketplace()
      .then(({ projects: found }) => {
        const open = found.filter((p) => p.status === 'PUBLISHED' || p.status === 'FUNDING')
        setProjects(open)
        const wanted = open.find((p) => p.id === searchParams.get('project')) ?? open[0]
        if (wanted) setSelectedId(wanted.id)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los proyectos.'))
  }, [searchParams])

  const refresh = useCallback(async () => {
    if (!project || !deployment || !address || !publicClient) return
    try {
      const [state, isEligible, usdtBalance] = await Promise.all([
        api.projects.chain(project.id),
        publicClient.readContract({
          address: deployment.eligibility, abi: eligibilityRegistryAbi,
          functionName: 'isEligible', args: [BigInt(project.onChainId), address],
        }) as Promise<boolean>,
        publicClient.readContract({
          address: deployment.usdt, abi: mockUsdtAbi,
          functionName: 'balanceOf', args: [address],
        }) as Promise<bigint>,
      ])
      setChain(state)
      setEligible(isEligible)
      setBalance(usdtBalance)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el estado en cadena.')
    }
  }, [project, deployment, address, publicClient])

  useEffect(() => { void refresh() }, [refresh])

  // ── acciones ─────────────────────────────────────────────────────────
  async function runTx(step: Step, label: string, action: () => Promise<`0x${string}`>) {
    setBusy(step); setError(null)
    try {
      const hash = await action()
      await publicClient?.waitForTransactionReceipt({ hash })
      setTxs((current) => [...current, { label, hash }])
      await refresh()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'La transacción falló.'
      // viem mete el revert en la primera línea; el resto es ruido para el usuario.
      setError(message.split('\n')[0] ?? message)
    } finally {
      setBusy(null)
    }
  }

  async function handleProve() {
    if (!project || !deployment || !publicClient) return
    setError(null)
    // `now` sale del BLOQUE, no del reloj del navegador: el contrato exige que
    // la prueba sea reciente respecto de SU reloj, y un host desfasado produce
    // `PruebaVencida` sin explicación.
    const block = await publicClient.getBlock()
    const proof = await prove({
      projectId: project.onChainId,
      investorAddress: address!,
      minNetWorth: project.eligibility.minNetWorth,
      allowedJurisdiction: project.eligibility.allowedJurisdiction,
      now: Number(block.timestamp),
    })
    if (!proof) return

    await runTx('eligibility', 'Registrar elegibilidad', () => writeContractAsync({
      address: deployment.eligibility, abi: eligibilityRegistryAbi, functionName: 'proveEligibility',
      args: [BigInt(project.onChainId), proof.proof, proof.publicInputs],
    }))
  }

  // ── render ───────────────────────────────────────────────────────────
  if (!isConnected) {
    return <section className="card"><h2><Wallet2 size={20} aria-hidden /> Invertir</h2>
      <p className="card__lead">Conectá tu wallet para invertir.</p></section>
  }
  if (problem) {
    return <section className="card"><h2>Invertir</h2><p className="card__lead">{problem}</p></section>
  }

  const amountUnits = (() => {
    try { return parseUnits(amount || '0', USDT_DECIMALS) } catch { return 0n }
  })()
  const insufficient = balance !== null && amountUnits > balance
  const belowMinimum = project ? amountUnits < BigInt(project.terms.minimumTicket) : false
  const proving = proverState.status === 'working'

  return (
    <div className="stack">
      <section className="card">
        <h2>Oportunidad</h2>
        {projects.length === 0 ? (
          <p className="card__lead">No hay rondas abiertas. Publicá un proyecto o corré <code>npm run seed -- --reset</code>.</p>
        ) : (
          <div className="field">
            <label htmlFor="project">Proyecto</label>
            <select id="project" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setTxs([]) }}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.city} · meta {formatAmount(p.terms.target)} USDT</option>
              ))}
            </select>
          </div>
        )}

        {project && chain && (
          <div className="grid-3" style={{ marginTop: '1.25rem' }}>
            <div className="metric">
              <p className="metric__value">{formatAmount(chain.raised)}</p>
              <p className="metric__label">Recaudado de {formatAmount(chain.target)}</p>
            </div>
            <div className="metric metric--highlight">
              <p className="metric__value">{formatAmount(chain.locked)}</p>
              <p className="metric__label">En el escrow ahora mismo</p>
            </div>
            <div className="metric">
              <p className="metric__value">{project.terms.interestBps / 100} %</p>
              <p className="metric__label">Retorno anual · {project.terms.termMonths} meses</p>
            </div>
          </div>
        )}
      </section>

      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}

      {/* ── Paso 1 ────────────────────────────────────────────────── */}
      <section className="card">
        <h2>{eligible ? <CheckCircle2 size={20} aria-hidden /> : <Circle size={20} aria-hidden />} 1 · Probar elegibilidad</h2>

        {eligible ? (
          <div className="notice notice--ok">
            <p><strong>Elegibilidad registrada en cadena.</strong></p>
            <p>El contrato sabe que cumplís. No sabe tu patrimonio, tu identidad ni cuál de las credenciales vigentes es la tuya.</p>
          </div>
        ) : (
          <>
            <p className="card__lead">
              Esta ronda exige residencia en la jurisdicción <strong>{project?.eligibility.allowedJurisdiction}</strong> y
              un patrimonio mínimo de <strong>{project?.eligibility.minNetWorth}</strong>.
              La prueba se genera <strong>en este navegador</strong>; el secreto no sale de acá.
            </p>

            {!credential && (
              <div className="notice notice--warn">
                <p>No hay credencial guardada en este navegador. Emitila en <strong>Identidad</strong>.</p>
              </div>
            )}

            {proverState.status === 'error' && (
              <div className="notice notice--error">
                <p><strong>{proverState.message}</strong></p>
                {proverState.problems && <ul>{proverState.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
              </div>
            )}

            {proving && (
              <div className="notice">
                <p><Loader2 size={16} className="spin" aria-hidden /> {proverState.step}</p>
                <p className="field__hint">Toma unos segundos. La pestaña sigue respondiendo porque corre en un worker.</p>
              </div>
            )}

            {proverState.status === 'done' && (
              <p className="field__hint">Prueba generada en {proverState.proof.elapsedMs} ms · {proverState.proof.proof.length / 2 - 1} bytes</p>
            )}

            <button type="button" className="btn btn--primary" style={{ marginTop: '1rem' }}
              disabled={!project || !credential || proving || busy !== null}
              onClick={() => void handleProve()}>
              <ShieldCheck size={16} aria-hidden />
              {proving ? 'Generando…' : busy === 'eligibility' ? 'Registrando…' : 'Generar prueba y registrar'}
            </button>
          </>
        )}
      </section>

      {/* ── Pasos 2 y 3 ───────────────────────────────────────────── */}
      <section className="card">
        <h2>2 · Aprobar y 3 · Invertir</h2>
        <p className="card__lead">
          El capital entra al <strong>escrow del proyecto</strong>, no a la cuenta del desarrollador.
          Sale por tramos, y solo cuando un verificador independiente acredita cada hito.
        </p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="amount">Monto en USDT</label>
            <input id="amount" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
            {project && <p className="field__hint">Mínimo {formatAmount(project.terms.minimumTicket)} USDT</p>}
          </div>
          <div className="metric">
            <p className="metric__value">{balance === null ? '—' : formatUnits(balance, USDT_DECIMALS)}</p>
            <p className="metric__label">Tu saldo USDT</p>
          </div>
        </div>

        {insufficient && <div className="notice notice--warn"><p>Saldo insuficiente. En la demo podés usar el faucet del MockUSDT.</p></div>}
        {belowMinimum && amountUnits > 0n && <div className="notice notice--warn"><p>El monto está por debajo del ticket mínimo de la ronda.</p></div>}

        <div className="row" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn"
            disabled={!eligible || !project || busy !== null || amountUnits === 0n}
            onClick={() => void runTx('approve', 'Aprobar USDT', () => writeContractAsync({
              address: deployment!.usdt, abi: mockUsdtAbi, functionName: 'approve',
              args: [deployment!.vault as Address, amountUnits],
            }))}>
            {busy === 'approve' ? 'Aprobando…' : '2 · Aprobar USDT'}
          </button>

          <button type="button" className="btn btn--primary"
            disabled={!eligible || !project || busy !== null || amountUnits === 0n || insufficient || belowMinimum}
            onClick={() => void runTx('invest', 'Invertir', () => writeContractAsync({
              address: deployment!.vault, abi: projectVaultAbi, functionName: 'invest',
              args: [BigInt(project!.onChainId), amountUnits],
            }))}>
            {busy === 'invest' ? 'Invirtiendo…' : '3 · Invertir'}
          </button>

          <button type="button" className="btn"
            disabled={busy !== null}
            onClick={() => void runTx('approve', 'Faucet', () => writeContractAsync({
              address: deployment!.usdt, abi: mockUsdtAbi, functionName: 'faucet', args: [],
            }))}>
            Faucet (+10.000)
          </button>
        </div>

        {!eligible && <p className="field__hint" style={{ marginTop: '.75rem' }}>
          Sin la prueba del paso 1, <code>invest</code> revierte con <code>ElegibilidadRequerida</code>.
        </p>}
      </section>

      {txs.length > 0 && (
        <section className="card">
          <h2>Transacciones</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Acción</th><th>Hash</th></tr></thead>
              <tbody>
                {txs.map((tx) => (
                  <tr key={tx.hash}><td>{tx.label}</td><td className="mono">{tx.hash}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
