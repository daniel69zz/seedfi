import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute'
import { AdminLayout } from '../../pages/admin/ui/AdminLayout'
import { AdminCompaniesPage, AdminCompanyDetailPage, AdminDashboardPage, AdminProjectReviewPage, AdminProjectsPage, AdminRegistryPage } from '../../pages/admin/ui/AdminPages'
import { ForgotPasswordPage, LoginPage, RegisterPage, VerifyEmailPage } from '../../pages/auth/ui/AuthPages'
import { CompanyDashboardPage, CompanyPaymentsPage, CompanyProfilePage, CompanyProjectDetailPage, CompanyProjectsPage, NewProjectPage } from '../../pages/company/ui/CompanyPages'
import { NotFoundPage, UnauthorizedPage } from '../../pages/errors/ui/ErrorPages'
import { InvestmentsPage } from '../../pages/investments/ui/InvestmentsPage'
import { InvestmentDetailPage, InvestorDashboardPage, InvestorKycPage, InvestorWalletPage, NotificationsPage } from '../../pages/investor/ui/InvestorPages'
import { MarketplacePage } from '../../pages/marketplace/ui/MarketplacePage'
import { OpportunityDetailPage } from '../../pages/opportunity-detail/ui/OpportunityDetailPage'
import { PortfolioPage } from '../../pages/portfolio/ui/PortfolioPage'
import { ProfilePage } from '../../pages/profile/ui/ProfilePage'
import { FaqPage, InfoPage, LandingPage } from '../../pages/public/ui/PublicPages'
import { Footer } from '../../widgets/footer/ui/Footer'
import { Navbar } from '../../widgets/navbar/ui/Navbar'

const pageTitles: Record<string, string> = {
  '/': 'Financiamiento e inversión con propósito',
  '/opportunities': 'Oportunidades',
  '/how-it-works': 'Cómo funciona',
  '/security': 'Seguridad',
  '/about': 'Acerca de',
  '/faq': 'Preguntas frecuentes',
  '/auth/login': 'Ingresar',
  '/auth/register': 'Crear cuenta',
  '/auth/forgot-password': 'Recuperar contraseña',
  '/auth/verify-email': 'Verificar correo',
  '/investor/dashboard': 'Resumen del inversionista',
  '/investor/investments': 'Mis inversiones',
  '/investor/portfolio': 'Portafolio',
  '/investor/wallet': 'Wallet y movimientos',
  '/investor/profile': 'Perfil',
  '/investor/kyc': 'Verificación de identidad',
  '/company/dashboard': 'Panel de empresa',
  '/company/projects': 'Mis proyectos',
  '/company/projects/new': 'Nueva propuesta',
  '/company/payments': 'Pagos de empresa',
  '/company/profile': 'Perfil empresarial',
  '/admin': 'Administración',
  '/admin/companies': 'Administrar empresas',
  '/admin/projects': 'Administrar proyectos',
  '/admin/contracts': 'Contratos',
  '/admin/guarantees': 'Garantías',
  '/admin/vaults': 'Bóvedas',
  '/admin/investments': 'Registro de inversiones',
  '/admin/payments': 'Administrar pagos',
  '/admin/defaults': 'Incumplimientos',
  '/notifications': 'Notificaciones',
  '/unauthorized': 'Acceso restringido',
}

const publicFooterPaths = ['/', '/opportunities', '/how-it-works', '/security', '/about', '/faq']

function ScrollToRoute() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1))
        target?.scrollIntoView({ block: 'start' })
        target?.focus({ preventScroll: true })
      })
    } else {
      window.scrollTo({ top: 0 })
    }

    const pageName = pathname.startsWith('/opportunities/')
      ? 'Detalle de oportunidad'
      : pathname.startsWith('/investor/investments/')
        ? 'Detalle de inversión'
        : pathname.startsWith('/company/projects/') && pathname !== '/company/projects/new'
          ? 'Gestión del proyecto'
          : pathname.startsWith('/admin/companies/')
            ? 'Expediente de empresa'
            : pathname.startsWith('/admin/projects/')
              ? 'Revisión de proyecto'
              : pageTitles[pathname] ?? 'Página no encontrada'
    document.title = `${pageName} | Seed 2 Deed`
  }, [pathname, hash])
  return null
}

function AppChrome() {
  const { pathname } = useLocation()
  const showFooter = publicFooterPaths.includes(pathname) || pathname.startsWith('/opportunities/')
  return (
    <>
      <ScrollToRoute />
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/opportunities" element={<MarketplacePage />} />
        <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
        <Route path="/how-it-works" element={<InfoPage page="how-it-works" />} />
        <Route path="/security" element={<InfoPage page="security" />} />
        <Route path="/about" element={<InfoPage page="about" />} />
        <Route path="/faq" element={<FaqPage />} />

        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />

        <Route path="/investor/dashboard" element={<ProtectedRoute roles={['INVESTOR']}><InvestorDashboardPage /></ProtectedRoute>} />
        <Route path="/investor/investments" element={<ProtectedRoute roles={['INVESTOR']}><InvestmentsPage /></ProtectedRoute>} />
        <Route path="/investor/investments/:id" element={<ProtectedRoute roles={['INVESTOR']}><InvestmentDetailPage /></ProtectedRoute>} />
        <Route path="/investor/portfolio" element={<ProtectedRoute roles={['INVESTOR']}><PortfolioPage /></ProtectedRoute>} />
        <Route path="/investor/wallet" element={<ProtectedRoute roles={['INVESTOR']}><InvestorWalletPage /></ProtectedRoute>} />
        <Route path="/investor/profile" element={<ProtectedRoute roles={['INVESTOR']}><ProfilePage /></ProtectedRoute>} />
        <Route path="/investor/kyc" element={<ProtectedRoute roles={['INVESTOR']}><InvestorKycPage /></ProtectedRoute>} />

        <Route path="/company/dashboard" element={<ProtectedRoute roles={['COMPANY']}><CompanyDashboardPage /></ProtectedRoute>} />
        <Route path="/company/projects" element={<ProtectedRoute roles={['COMPANY']}><CompanyProjectsPage /></ProtectedRoute>} />
        <Route path="/company/projects/new" element={<ProtectedRoute roles={['COMPANY']}><NewProjectPage /></ProtectedRoute>} />
        <Route path="/company/projects/:id" element={<ProtectedRoute roles={['COMPANY']}><CompanyProjectDetailPage /></ProtectedRoute>} />
        <Route path="/company/payments" element={<ProtectedRoute roles={['COMPANY']}><CompanyPaymentsPage /></ProtectedRoute>} />
        <Route path="/company/profile" element={<ProtectedRoute roles={['COMPANY']}><CompanyProfilePage /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="companies" element={<AdminCompaniesPage />} />
          <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
          <Route path="projects" element={<AdminProjectsPage />} />
          <Route path="projects/:id" element={<Navigate to="review" replace />} />
          <Route path="projects/:id/review" element={<AdminProjectReviewPage />} />
          <Route path="contracts" element={<AdminRegistryPage kind="contracts" />} />
          <Route path="guarantees" element={<AdminRegistryPage kind="guarantees" />} />
          <Route path="vaults" element={<AdminRegistryPage kind="vaults" />} />
          <Route path="investments" element={<AdminRegistryPage kind="investments" />} />
          <Route path="payments" element={<AdminRegistryPage kind="payments" />} />
          <Route path="defaults" element={<AdminRegistryPage kind="defaults" />} />
        </Route>

        <Route path="/notifications" element={<ProtectedRoute roles={['INVESTOR', 'COMPANY', 'ADMIN']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/investments" element={<Navigate to="/investor/investments" replace />} />
        <Route path="/portfolio" element={<Navigate to="/investor/portfolio" replace />} />
        <Route path="/profile" element={<Navigate to="/investor/profile" replace />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showFooter && <Footer />}
    </>
  )
}

export function AppRouter() {
  return <BrowserRouter><AppChrome /></BrowserRouter>
}
