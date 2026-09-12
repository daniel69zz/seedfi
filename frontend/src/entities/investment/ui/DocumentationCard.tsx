import { Download, FileText } from 'lucide-react'
import type { InvestmentDetail } from '../model/investment.types'
import { formatUsd } from '../../../shared/lib/format'
import { formatInvestmentDate } from '../model/formatInvestmentDate'

export function DocumentationCard({ investment }: { investment: InvestmentDetail }) {
  const document = investment.documentation[0]

  function downloadReceipt() {
    if (!document) return
    const text = [
      'SEED 2 DEED · COMPROBANTE DE DEMOSTRACIÓN',
      document.name,
      `Inversión: ${investment.id}`,
      `Proyecto: ${investment.projectName}`,
      `Empresa: ${investment.company.name}`,
      `Fecha: ${formatInvestmentDate(document.issuedAt)}`,
      `Monto original: ${formatUsd(investment.investment.originalAmount, true)}`,
      `Estado: ${document.status === 'validated' ? 'Validado' : 'Pendiente'}`,
      '',
      'Documento simulado. No acredita una inversión ni una transacción real.',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = window.document.createElement('a')
    link.href = url
    link.download = `comprobante-${investment.id}.txt`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <details className="investment-disclosure investment-documentation">
      <summary>
        <span className="investment-disclosure__icon"><FileText size={27} aria-hidden="true" /></span>
        <span className="investment-disclosure__copy">
          <h2>Documentación y garantía</h2>
          <span>{document?.name ?? 'Sin documentos disponibles'}</span>
          {document && <small className="investment-disclosure__status">{document.status === 'validated' ? 'Validado' : 'Pendiente'}</small>}
        </span>
        <span className="investment-disclosure__action">Ver</span>
      </summary>
      <div className="investment-disclosure__body">
        {document && <>
          <dl className="investment-facts">
            <div><dt>Proyecto</dt><dd>{investment.projectName}</dd></div>
            <div><dt>Empresa</dt><dd>{investment.company.name}</dd></div>
            <div><dt>Fecha de inversión</dt><dd>{formatInvestmentDate(document.issuedAt)}</dd></div>
            <div><dt>Monto original</dt><dd>{formatUsd(investment.investment.originalAmount, true)}</dd></div>
          </dl>
          <button className="investment-download" type="button" onClick={downloadReceipt}><Download size={18} aria-hidden="true" /> Descargar comprobante</button>
          <p className="investment-disclosure__note">Comprobante de demostración.</p>
        </>}
        {investment.guarantee && <p className="investment-guarantee"><strong>Garantía asociada</strong>{investment.guarantee}</p>}
      </div>
    </details>
  )
}
