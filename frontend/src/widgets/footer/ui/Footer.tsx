import { Link } from 'react-router-dom'
import { brand } from '../../../shared/config/brand'
import './Footer.css'

const columns = [
  { title: 'Producto', links: [['Oportunidades', '/opportunities'], ['Cómo funciona', '/how-it-works'], ['Seguridad', '/security']] },
  { title: 'Empresa', links: [['Acerca de', '/about'], ['Buscar financiamiento', '/auth/register?role=company'], ['Preguntas frecuentes', '/faq']] },
  { title: 'Legal', links: [['Términos de demostración', '/about#legal'], ['Privacidad', '/about#privacy'], ['Riesgos', '/security#risks']] },
  { title: 'Soporte', links: [['Centro de ayuda', '/faq'], ['Contacto', '/about#contact'], ['Estado de la plataforma', '/security']] },
] as const

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner page-shell">
        <div className="footer__brand">
          <Link to="/" aria-label={`${brand.name}, inicio`}><img src={brand.logo} alt="" /><strong>{brand.name}</strong></Link>
          <p>{brand.description}</p>
          <small>Demo frontend · Datos ficticios · Los retornos son estimados.</small>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2>{column.title}</h2>
            {column.links.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
          </nav>
        ))}
      </div>
      <div className="footer__bottom page-shell"><span>© 2026 {brand.name}</span><span>Capital para progreso real.</span></div>
    </footer>
  )
}
