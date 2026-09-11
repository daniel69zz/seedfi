import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import noraLogo from '../../../assets/brand/nora-logo.png'
import './Navbar.css'

const information = {
  how: {
    title: 'How it works',
    description: 'Discover businesses, compare opportunities, and take a closer look at the projects that interest you.',
    points: [
      'Browse by category, risk level, or duration.',
      'Compare funding requested, expected APY, and loan duration.',
      'Open an opportunity to learn more about the business.',
    ],
  },
  why: {
    title: 'Why NORA',
    description: 'Real businesses. Brighter tomorrows. NORA brings opportunities from Bolivian businesses together in one place.',
    points: [
      'Explore businesses across energy, agriculture, healthcare, and more.',
      'See key information in a clear, consistent format.',
      'Find projects that match the categories and timeframes you care about.',
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    description: 'A few things to know about this marketplace preview.',
    points: [
      'Can I invest here? This is a frontend preview; investments and payments are not available.',
      'Are these live offers? The businesses, badges, and opportunity figures shown are demonstration data.',
      'Do the filters work? Yes. Filters and sorting update the sample opportunities locally.',
    ],
  },
} as const

type InformationTopic = keyof typeof information

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTopic, setActiveTopic] = useState<InformationTopic | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeTopic) dialogRef.current?.showModal()
  }, [activeTopic])

  function showInformation(topic: InformationTopic, trigger: HTMLButtonElement) {
    triggerRef.current = menuOpen ? menuButtonRef.current : trigger
    setMenuOpen(false)
    setActiveTopic(topic)
  }

  function closeInformation() {
    setActiveTopic(null)
    triggerRef.current?.focus()
  }

  function browseOpportunities() {
    setMenuOpen(false)
    requestAnimationFrame(() => {
      document.getElementById('opportunities')?.scrollIntoView({ block: 'start' })
    })
  }

  const content = activeTopic ? information[activeTopic] : null

  return (
    <>
      <header className="navbar page-shell">
        <Link className="navbar__brand" to="/" aria-label="NORA Lending home" onClick={() => setMenuOpen(false)}>
          <img src={noraLogo} width="50" height="56" alt="" />
          <span className="navbar__brand-name">NORA <span>Lending</span></span>
        </Link>

        <nav className={`navbar__links${menuOpen ? ' navbar__links--open' : ''}`} aria-label="Main navigation" id="main-navigation">
          <button type="button" onClick={(event) => showInformation('how', event.currentTarget)}>How it works</button>
          <Link to="/#opportunities" onClick={browseOpportunities}>Browse</Link>
          <button type="button" onClick={(event) => showInformation('why', event.currentTarget)}>Why NORA</button>
          <button type="button" onClick={(event) => showInformation('faq', event.currentTarget)}>FAQ</button>
        </nav>

        <div className="navbar__actions">
          <label className="navbar__language">
            <Globe size={27} strokeWidth={2.6} aria-hidden="true" />
            <select aria-label="Language" defaultValue="en">
              <option value="en">EN</option>
              <option value="es" disabled>Español — soon</option>
            </select>
            <ChevronDown size={21} strokeWidth={3} aria-hidden="true" />
          </label>
          <Link className="navbar__start" to="/#opportunities" onClick={browseOpportunities}>Start</Link>
          <button
            className="navbar__menu-toggle"
            type="button"
            ref={menuButtonRef}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>

      <dialog
        className="navbar-dialog"
        ref={dialogRef}
        aria-labelledby="navbar-dialog-title"
        onClose={closeInformation}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
      >
        <div className="navbar-dialog__content">
          <button className="navbar-dialog__close" type="button" aria-label="Close information" onClick={() => dialogRef.current?.close()}>
            <X size={24} aria-hidden="true" />
          </button>
          <p className="navbar-dialog__eyebrow">NORA LENDING</p>
          <h2 id="navbar-dialog-title">{content?.title}</h2>
          <p>{content?.description}</p>
          <ul>{content?.points.map((point) => <li key={point}>{point}</li>)}</ul>
          {activeTopic !== 'faq' && <p className="navbar-dialog__note">You are exploring a preview with sample opportunities.</p>}
        </div>
      </dialog>
    </>
  )
}
