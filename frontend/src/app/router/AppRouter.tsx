import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { InvestmentsPage } from '../../pages/investments/ui/InvestmentsPage'
import { MarketplacePage } from '../../pages/marketplace/ui/MarketplacePage'
import { OpportunityDetailPage } from '../../pages/opportunity-detail/ui/OpportunityDetailPage'
import { PortfolioPage } from '../../pages/portfolio/ui/PortfolioPage'
import { ProfilePage } from '../../pages/profile/ui/ProfilePage'
import { Navbar } from '../../widgets/navbar/ui/Navbar'

const pageTitles: Record<string, string> = {
  '/': 'Oportunidades',
  '/investments': 'Mis inversiones',
  '/portfolio': 'Portafolio',
  '/profile': 'Perfil',
}

function ScrollToRoute() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      target?.scrollIntoView({ block: 'start' })
      target?.focus({ preventScroll: true })
    } else {
      window.scrollTo({ top: 0 })
    }

    const pageName = pathname.startsWith('/opportunities/')
      ? 'Detalle de oportunidad'
      : pageTitles[pathname] ?? 'Oportunidades'
    document.title = `${pageName} | Truth Works`
  }, [pathname, hash])

  return null
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToRoute />
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <Navbar />
      <Routes>
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/investments" element={<InvestmentsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
