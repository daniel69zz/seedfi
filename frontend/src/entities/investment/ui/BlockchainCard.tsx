import { Link2 } from 'lucide-react'
import type { InvestmentDetail } from '../model/investment.types'

export function BlockchainCard({ blockchain }: { blockchain: InvestmentDetail['blockchain'] }) {
  return (
    <details className="investment-disclosure investment-blockchain">
      <summary>
        <span className="investment-disclosure__icon"><Link2 size={26} aria-hidden="true" /></span>
        <span className="investment-disclosure__copy">
          <h2>Registro blockchain</h2>
          <span>{blockchain.network}</span>
          <small className="investment-disclosure__status">{blockchain.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</small>
        </span>
        <span className="investment-disclosure__action">Ver transacción</span>
      </summary>
      <div className="investment-disclosure__body">
        <dl className="investment-facts">
          <div><dt>Red</dt><dd>{blockchain.network}</dd></div>
          <div><dt>Transacción</dt><dd><code>{blockchain.txHash}</code></dd></div>
        </dl>
        {blockchain.isSimulated && <p className="investment-disclosure__note">Registro de demostración. Esta transacción es simulada.</p>}
      </div>
    </details>
  )
}
