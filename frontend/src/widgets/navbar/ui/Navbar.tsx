import { Wallet } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { appAssets } from '../../../assets/assets'
import { routes } from '../../../shared/constants/routes'
import './Navbar.css'

const navigation = [
  { label: 'Oportunidades', to: routes.marketplace },
  { label: 'Mis inversiones', to: routes.investments },
  { label: 'Portafolio', to: routes.portfolio },
  { label: 'Perfil', to: routes.profile },
] as const

export function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="navbar page-shell">
      <Link className="navbar__brand" to={routes.marketplace} aria-label="Seed 2 Deed — ir a oportunidades">
        <img src={appAssets.brand.logo} width="48" height="48" alt="" />
        <span>Seed 2 Deed</span>
      </Link>

      <nav className="navbar__links" aria-label="Navegación principal">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === routes.marketplace}
            className={({ isActive }) => {
              const active = item.to === routes.marketplace
                ? isActive || pathname.startsWith('/opportunities/')
                : isActive
              return active ? 'navbar__link navbar__link--active' : 'navbar__link'
            }}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar__balance" aria-label="Saldo disponible: 12,500 USDT">
        <span className="navbar__balance-icon"><Wallet size={20} strokeWidth={2.5} aria-hidden="true" /></span>
        <strong>12,500 USDT</strong>
      </div>
    </header>
  )
}
