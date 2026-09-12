import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Wallet } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Opportunity } from '../../../entities/opportunity/model/opportunity.types'
import { useAuth } from '../../auth/model/AuthContext'
import { useDemo } from '../../demo/model/DemoContext'
import { web3MockService } from '../../../shared/api/mockServices'
import { formatDate, formatPercent, formatUsd } from '../../../shared/lib/format'
import { Button } from '../../../shared/ui/button/Button'
import { ProgressMeter } from '../../../shared/ui/platform/PlatformUI'
import './InvestmentFlow.css'

interface InvestmentFlowProps {
  opportunity: Opportunity
}

type TransactionState = 'idle' | 'connecting' | 'connected' | 'authorizing' | 'confirming' | 'confirmed' | 'error'

export function InvestmentFlow({ opportunity }: InvestmentFlowProps) {
  const { user } = useAuth()
  const { createInvestment } = useDemo()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('invest') === '1' && user?.role === 'INVESTOR' && user.kycStatus === 'VERIFIED')
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState(opportunity.minimumInvestment)
  const [accepted, setAccepted] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [transactionState, setTransactionState] = useState<TransactionState>('idle')
  const [transactionHash, setTransactionHash] = useState('')
  const remaining = opportunity.fundingRequested - opportunity.fundedAmount
  const maximum = Math.min(opportunity.maximumInvestment ?? remaining, remaining, 12500)
  const estimatedReturn = useMemo(() => amount * (opportunity.expectedApy / 100) * (opportunity.durationMonths / 12), [amount, opportunity])

  function begin() {
    const next = `/opportunities/${opportunity.id}?invest=1`
    if (!user) { navigate(`/auth/login?next=${encodeURIComponent(next)}`); return }
    if (user.role !== 'INVESTOR') { navigate('/unauthorized'); return }
    if (user.kycStatus !== 'VERIFIED') { navigate(`/investor/kyc?next=${encodeURIComponent(next)}`); return }
    setOpen(true)
  }

  async function connectWallet() {
    try {
      setTransactionState('connecting')
      const result = await web3MockService.connectWallet()
      setWalletAddress(result.address)
      setTransactionState('connected')
    } catch {
      setTransactionState('error')
    }
  }

  async function confirmInvestment() {
    try {
      setTransactionState('authorizing')
      await web3MockService.approveUSDT()
      setTransactionState('confirming')
      const result = await web3MockService.invest()
      createInvestment({ opportunityId: opportunity.id, projectName: opportunity.projectName, companyName: opportunity.business.name, amount, expectedApy: opportunity.expectedApy, durationMonths: opportunity.durationMonths, transactionHash: result.hash })
      setTransactionHash(result.hash)
      setTransactionState('confirmed')
      setStep(4)
    } catch {
      setTransactionState('error')
    }
  }

  function close() {
    setOpen(false)
    setStep(1)
    setTransactionState('idle')
    setWalletAddress('')
    setAccepted(false)
    navigate(`/opportunities/${opportunity.id}`, { replace: true })
  }

  return (
    <>
      <Button className="investment-trigger" onClick={begin}>Invertir en este proyecto <ArrowRight size={20} /></Button>
      <p className="investment-disclaimer">Retorno estimado. Toda inversión implica riesgo.</p>

      {open && (
        <div className="investment-modal" role="dialog" aria-modal="true" aria-labelledby="investment-title">
          <button className="investment-modal__backdrop" type="button" aria-label="Cerrar inversión" onClick={close} />
          <section className="investment-modal__panel">
            <header className="investment-modal__header"><div><p>PASO {step} DE 4</p><h2 id="investment-title">{step === 1 ? 'Define tu inversión' : step === 2 ? 'Revisa el resumen' : step === 3 ? 'Autoriza la operación' : 'Inversión registrada'}</h2></div><button type="button" onClick={close} aria-label="Cerrar">×</button></header>
            <ProgressMeter value={step * 25} compact />

            {step === 1 && <div className="investment-step"><div className="investment-project"><strong>{opportunity.projectName}</strong><span>{opportunity.business.name}</span></div><label className="field"><span>Monto a invertir</span><div className="money-input"><input type="number" min={opportunity.minimumInvestment} max={maximum} step={50} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><b>USDT</b></div><small>Mínimo {formatUsd(opportunity.minimumInvestment, true)} · Máximo disponible {formatUsd(maximum, true)}</small></label><div className="investment-availability"><p><span>Saldo disponible</span><strong>12,500 USDT</strong></p><p><span>Capital restante</span><strong>{formatUsd(remaining, true)}</strong></p></div>{(amount < opportunity.minimumInvestment || amount > maximum) && <p className="investment-error">Ingresa un monto entre {formatUsd(opportunity.minimumInvestment, true)} y {formatUsd(maximum, true)}.</p>}</div>}

            {step === 2 && <div className="investment-step"><div className="investment-summary"><p><span>Proyecto</span><strong>{opportunity.projectName}</strong></p><p><span>Monto</span><strong>{formatUsd(amount, true)}</strong></p><p><span>Retorno estimado</span><strong>{formatUsd(estimatedReturn, true)}</strong></p><p><span>Total estimado</span><strong>{formatUsd(amount + estimatedReturn, true)}</strong></p><p><span>APY estimado</span><strong>{formatPercent(opportunity.expectedApy)}</strong></p><p><span>Fecha estimada</span><strong>{formatDate(opportunity.expectedReturnDate)}</strong></p></div><div className="investment-risk-note"><LockKeyhole size={20} /><p><strong>Antes de continuar</strong><span>El retorno no está garantizado. Consulta riesgos, garantías y documentación del proyecto.</span></p></div><label className="check-row"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Entiendo que el retorno mostrado es estimado y que toda inversión implica riesgo.</label></div>}

            {step === 3 && <div className="investment-step investment-wallet"><span className="investment-wallet__icon"><Wallet size={34} /></span><h3>{walletAddress ? 'Wallet mock conectada' : 'Conecta la wallet de demostración'}</h3><p>Esta acción no conecta una wallet real ni solicita fondos. Simula autorización y confirmación.</p>{walletAddress && <code>{walletAddress}</code>}{transactionState === 'error' && <p className="investment-error">No se pudo completar la simulación. Intenta nuevamente.</p>}{!walletAddress ? <Button onClick={connectWallet} disabled={transactionState === 'connecting'}>{transactionState === 'connecting' ? <><LoaderCircle className="spin" /> Conectando...</> : <>Conectar wallet mock</>}</Button> : <Button onClick={confirmInvestment} disabled={transactionState === 'authorizing' || transactionState === 'confirming'}>{transactionState === 'authorizing' ? <><LoaderCircle className="spin" /> Autorizando USDT...</> : transactionState === 'confirming' ? <><LoaderCircle className="spin" /> Confirmando...</> : 'Confirmar inversión'}</Button>}</div>}

            {step === 4 && <div className="investment-step investment-success"><span><CheckCircle2 size={42} /></span><h3>Inversión realizada</h3><p>La operación mock fue confirmada y ya aparece en tus inversiones.</p><div><small>MONTO</small><strong>{formatUsd(amount, true)}</strong><small>PROYECTO</small><strong>{opportunity.projectName}</strong><small>TRANSACTION HASH</small><code>{transactionHash}</code></div><Button to="/investor/investments">Ver mi inversión <ArrowRight size={19} /></Button><button type="button" onClick={close}>Volver a la oportunidad</button></div>}

            {step < 3 && <footer className="investment-modal__footer"><Button variant="ghost" onClick={() => step === 1 ? close() : setStep((current) => current - 1)}><ArrowLeft size={18} /> {step === 1 ? 'Cancelar' : 'Atrás'}</Button><Button onClick={() => setStep((current) => current + 1)} disabled={(step === 1 && (amount < opportunity.minimumInvestment || amount > maximum)) || (step === 2 && !accepted)}>Continuar <ArrowRight size={18} /></Button></footer>}
          </section>
        </div>
      )}
    </>
  )
}
