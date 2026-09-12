import { CalendarDays, ChevronRight } from 'lucide-react'
import type { InvestmentDetail } from '../model/investment.types'
import { formatUsd } from '../../../shared/lib/format'
import { formatInvestmentDate } from '../model/formatInvestmentDate'

export function PaymentScheduleCard({ nextPayment, payments }: { nextPayment: InvestmentDetail['nextPayment']; payments: InvestmentDetail['paymentSchedule'] }) {
  return (
    <details className="investment-disclosure investment-payments">
      <summary>
        <span className="investment-disclosure__icon"><CalendarDays size={27} aria-hidden="true" /></span>
        <span className="investment-disclosure__copy">
          <h2>Cronograma de pagos</h2>
          <span>{nextPayment ? 'Próximo pago' : 'Pagos completados'}</span>
          {nextPayment && <span>{formatInvestmentDate(nextPayment.date)}</span>}
        </span>
        {nextPayment && <strong className="investment-payments__amount">{formatUsd(nextPayment.amount, true)}</strong>}
        <ChevronRight className="investment-disclosure__chevron" size={23} aria-hidden="true" />
      </summary>
      <div className="investment-disclosure__body">
        <ul className="investment-payment-list">
          {payments.map((payment) => (
            <li key={payment.id}>
              <div><strong>{payment.label}</strong><span>{formatInvestmentDate(payment.date)}</span></div>
              <div><strong>{formatUsd(payment.amount, true)}</strong><span>{payment.status === 'DISTRIBUTED' ? 'Distribuido' : payment.status === 'PENDING' ? 'Pendiente' : 'Programado'}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
