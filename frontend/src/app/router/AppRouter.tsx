import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from '../../widgets/navbar/ui/Navbar'
import { MarketplacePage } from '../../pages/marketplace/ui/MarketplacePage'
import { OpportunityDetailPage } from '../../pages/opportunity-detail/ui/OpportunityDetailPage'

function ScrollToRoute() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      target?.scrollIntoView({ block: 'start' })
      target?.focus({ preventScroll: true })
    } else {
      window.scrollTo(0, 0)
    }
    document.title = pathname.startsWith('/opportunities/') ? 'Opportunity | NORA Lending' : 'Browse businesses | NORA Lending'
  }, [pathname, hash])

  return null
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToRoute />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Navbar />
      <Routes>
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
        <Route path="*" element={<OpportunityDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}
