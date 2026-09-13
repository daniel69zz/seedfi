import { Wallet, LogOut, AlertTriangle } from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { shortAddress } from '@s2d/shared'
import { appChain } from '../../../shared/web3/config'
import './WalletButton.css'

/**
 * Conectar wallet  (backlog T8, primera mitad)
 *
 * Cubre el caso que casi siempre se olvida: la wallet conectada pero en la RED
 * EQUIVOCADA. Sin ese aviso, el usuario firma contra otra cadena, la
 * transacción falla con un error críptico y nadie entiende por qué.
 */
export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const wrongNetwork = isConnected && chainId !== appChain.id

  if (!isConnected) {
    const injectedConnector = connectors[0]
    return (
      <div className="wallet">
        <button
          type="button"
          className="wallet__connect"
          disabled={isPending || !injectedConnector}
          onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        >
          <Wallet size={18} aria-hidden />
          {isPending ? 'Conectando…' : 'Conectar wallet'}
        </button>
        {!injectedConnector && (
          <p className="wallet__hint">
            No se detectó ninguna wallet. Instalá MetaMask o Rabby y recargá.
          </p>
        )}
        {error && <p className="wallet__hint wallet__hint--error">{error.message}</p>}
      </div>
    )
  }

  return (
    <div className="wallet">
      {wrongNetwork && (
        <button type="button" className="wallet__switch" onClick={() => switchChain({ chainId: appChain.id })}>
          <AlertTriangle size={16} aria-hidden />
          Cambiar a {appChain.name}
        </button>
      )}
      <span className="wallet__address" title={address}>
        <Wallet size={16} aria-hidden />
        {shortAddress(address ?? '')}
      </span>
      <button type="button" className="wallet__disconnect" onClick={() => disconnect()} aria-label="Desconectar wallet">
        <LogOut size={16} aria-hidden />
      </button>
    </div>
  )
}
