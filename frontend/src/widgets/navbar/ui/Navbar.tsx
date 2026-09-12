import { Bell, ChevronDown, LogOut, UserRound, Wallet } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/model/AuthContext'
import { notifications } from '../../../shared/data/platform.mock'
import { brand } from '../../../shared/config/brand'
import './Navbar.css'

const guestNavigation = [
  ['Oportunidades', '/opportunities'],
  ['Cómo funciona', '/how-it-works'],
  ['Seguridad', '/security'],
  ['Acerca de', '/about'],
] as const

const investorNavigation = [
  ['Oportunidades', '/opportunities'],
  ['Resumen', '/investor/dashboard'],
  ['Mis inversiones', '/investor/investments'],
  ['Portafolio', '/investor/portfolio'],
  ['Movimientos', '/investor/wallet'],
] as const

const companyNavigation = [
  ['Dashboard', '/company/dashboard'],
  ['Mis proyectos', '/company/projects'],
  ['Nueva propuesta', '/company/projects/new'],
  ['Pagos', '/company/payments'],
] as const

export function Navbar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (pathname.startsWith('/auth/') || pathname.startsWith('/admin')) return null

  const navigation = user?.role === 'INVESTOR'
    ? investorNavigation
    : user?.role === 'COMPANY'
      ? companyNavigation
      : guestNavigation
  const roleNotifications = user ? notifications.filter((item) => item.audience === user.role) : []

  function signOut() {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar page-shell">
      <Link className="navbar__brand" to="/" aria-label={`${brand.name} — inicio`}>
        <img src={brand.logo} width="48" height="48" alt="" />
        <span>{brand.name}</span>
      </Link>

      <nav className="navbar__links" aria-label="Navegación principal">
        {navigation.map(([label, to]) => (
          <NavLink key={to} to={to} end={to.endsWith('dashboard')} className={({ isActive }) => isActive || (to === '/opportunities' && pathname.startsWith('/opportunities/')) ? 'navbar__link navbar__link--active' : 'navbar__link'}>{label}</NavLink>
        ))}
      </nav>

      <div className="navbar__actions">
        {user?.role === 'INVESTOR' && (
          <Link className="navbar__balance" to="/investor/wallet" aria-label="Saldo disponible: 12,500 USDT">
            <span className="navbar__balance-icon"><Wallet size={18} aria-hidden="true" /></span><strong>12,500 USDT</strong>
          </Link>
        )}

        {user ? (
          <>
            <details className="navbar-menu navbar-menu--notifications">
              <summary aria-label={`${roleNotifications.filter((item) => !item.read).length} notificaciones sin leer`}><Bell size={19} /><span>{roleNotifications.filter((item) => !item.read).length}</span></summary>
              <div className="navbar-menu__panel">
                <header><strong>Notificaciones</strong><Link to="/notifications">Ver todas</Link></header>
                {roleNotifications.slice(0, 3).map((item) => <Link key={item.id} to="/notifications"><span className={item.read ? '' : 'is-unread'} /><div><strong>{item.title}</strong><p>{item.description}</p><small>{item.createdAt}</small></div></Link>)}
              </div>
            </details>
            <details className="navbar-menu navbar-menu--profile">
              <summary><span className="navbar-avatar"><UserRound size={18} /></span><span className="navbar-user"><strong>{user.name.split(' ')[0]}</strong><small>{user.role === 'INVESTOR' ? 'Inversionista' : 'Empresa'}</small></span><ChevronDown size={16} /></summary>
              <div className="navbar-menu__panel navbar-menu__panel--profile">
                <p><strong>{user.name}</strong><span>{user.email}</span></p>
                <Link to={user.role === 'INVESTOR' ? '/investor/profile' : '/company/profile'}>Ver perfil</Link>
                <button type="button" onClick={signOut}><LogOut size={16} /> Cerrar sesión</button>
              </div>
            </details>
          </>
        ) : (
          <div className="navbar__guest-actions"><Link to="/auth/login">Ingresar</Link><Link to="/auth/register">Crear cuenta</Link></div>
        )}
      </div>
    </header>
  )
}
