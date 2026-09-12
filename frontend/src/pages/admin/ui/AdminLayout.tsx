import { useState } from 'react'
import {
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Vault,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/model/AuthContext'
import { brand } from '../../../shared/config/brand'
import './AdminPages.css'

const adminNavigation = [
  { label: 'Resumen', to: '/admin', icon: Gauge, end: true },
  { label: 'Empresas', to: '/admin/companies', icon: Building2 },
  { label: 'Proyectos', to: '/admin/projects', icon: BriefcaseBusiness },
  { label: 'Contratos', to: '/admin/contracts', icon: FileSignature },
  { label: 'Garantías', to: '/admin/guarantees', icon: Landmark },
  { label: 'Bóvedas', to: '/admin/vaults', icon: Vault },
  { label: 'Inversiones', to: '/admin/investments', icon: Users },
  { label: 'Pagos', to: '/admin/payments', icon: BadgeDollarSign },
  { label: 'Incumplimientos', to: '/admin/defaults', icon: AlertTriangle },
] as const

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  function signOut() { logout(); navigate('/') }

  return (
    <div className={collapsed ? 'admin-shell is-collapsed' : 'admin-shell'}>
      <button className="admin-mobile-toggle" type="button" aria-label="Abrir menú de administración" onClick={() => setMobileOpen(true)}><Menu /></button>
      <aside className={mobileOpen ? 'admin-sidebar is-mobile-open' : 'admin-sidebar'}>
        <header><a href="/admin" className="admin-brand"><img src={brand.logo} alt="" /><span>{brand.name}<small>Administración</small></span></a><button className="admin-close" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><X /></button></header>
        <nav aria-label="Administración">{adminNavigation.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
        <footer><button type="button" onClick={() => setCollapsed((current) => !current)}>{collapsed ? <ChevronRight /> : <ChevronLeft />}<span>Contraer menú</span></button><button type="button" onClick={signOut}><LogOut /><span>Cerrar sesión</span></button></footer>
      </aside>
      {mobileOpen && <button className="admin-overlay" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
      <div className="admin-main">
        <header className="admin-topbar"><label><Search size={18} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchQuery.trim()) navigate(`/admin/projects?query=${encodeURIComponent(searchQuery.trim())}`) }} placeholder="Buscar empresas, proyectos, pagos…" aria-label="Búsqueda global" /></label><div><button type="button" aria-label="Notificaciones" onClick={() => navigate('/notifications')}><Bell /><b>2</b></button><span className="admin-avatar"><UserRound /></span><p><strong>{user?.name}</strong><small>Administrador</small></p><ShieldCheck size={17} /></div></header>
        <Outlet />
      </div>
    </div>
  )
}
