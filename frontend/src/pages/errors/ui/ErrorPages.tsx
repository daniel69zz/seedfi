import { ArrowLeft, LockKeyhole, SearchX } from 'lucide-react'
import { Button } from '../../../shared/ui/button/Button'

export function NotFoundPage() {
  return <main className="section-placeholder page-shell" id="main-content"><section className="section-placeholder__card"><span className="section-placeholder__icon"><SearchX /></span><p className="section-placeholder__eyebrow">ERROR 404</p><h1>Página no encontrada</h1><p className="section-placeholder__description">La ruta que buscaste no existe o fue movida.</p><Button to="/"><ArrowLeft size={19} /> Volver al inicio</Button></section></main>
}

export function UnauthorizedPage() {
  return <main className="section-placeholder page-shell" id="main-content"><section className="section-placeholder__card"><span className="section-placeholder__icon"><LockKeyhole /></span><p className="section-placeholder__eyebrow">ACCESO RESTRINGIDO</p><h1>No tienes acceso a esta sección</h1><p className="section-placeholder__description">Inicia sesión con el perfil adecuado para continuar.</p><Button to="/auth/login">Cambiar de cuenta</Button></section></main>
}
