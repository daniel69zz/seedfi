import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity, AlertTriangle, ArrowLeftRight, Banknote, FilePlus2, FolderKanban, IdCard, PieChart, ShieldCheck, Store, Wallet2,
} from 'lucide-react'
import { WalletButton } from '../../../features/wallet/ui/WalletButton'
import { useDeployment } from '../../../shared/web3/contracts'
import './AppShell.css'
import './OnchainPages.css'

const tabs = [
  ['/app', 'Panel', Activity],
  ['/app/opportunities', 'Oportunidades', Store],
  ['/app/invest', 'Invertir', Wallet2],
  ['/app/portfolio', 'Portafolio', PieChart],
  ['/app/wallet', 'Movimientos', ArrowLeftRight],
  ['/app/identity', 'Identidad', IdCard],
  ['/app/projects', 'Mis proyectos', FolderKanban],
  ['/app/developer/new', 'Nuevo proyecto', FilePlus2],
  ['/app/repayments', 'Pagos', Banknote],
  ['/app/verify', 'Verificar hitos', ShieldCheck],
] as const

/**
 * Shell de la aplicación con cadena real.
 *
 * El marketplace público (`/opportunities`) sigue mostrando el catálogo mock.
 * Todo lo que hay bajo `/app` habla con el backend y con los contratos
 * desplegados, y el aviso de arriba lo deja claro cuando falta alguno de los dos
 * —en vez de dejar que el usuario haga clic en botones que van a fallar—.
 */
export function AppLayout() {
  const { deployment, chainId, loading, problem } = useDeployment()
  const { pathname } = useLocation()

  return (
    <div className="app-shell page-shell">
      <header className="app-shell__header">
        <div>
          <p className="app-shell__eyebrow">Aplicación on-chain</p>
          <h1 className="app-shell__title">Financiamiento verificable</h1>
        </div>
        <WalletButton />
      </header>

      {!loading && problem && (
        <div className="app-shell__banner" role="alert">
          <AlertTriangle size={20} aria-hidden />
          <div>
            <strong>No hay contratos disponibles.</strong>
            <p>{problem}</p>
          </div>
        </div>
      )}

      {deployment && (
        <p className="app-shell__deployment">
          Red <strong>{chainId}</strong> · vault <code>{deployment.vault}</code>
        </p>
      )}

      <nav className="app-shell__tabs" aria-label="Secciones de la aplicación">
        {tabs.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            className={({ isActive }) =>
              isActive || (to !== '/app' && pathname.startsWith(to))
                ? 'app-shell__tab app-shell__tab--active'
                : 'app-shell__tab'}
          >
            <Icon size={16} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <main id="main-content" className="app-shell__content">
        <Outlet />
      </main>
    </div>
  )
}
