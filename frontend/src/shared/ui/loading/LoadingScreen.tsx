import { BeaverLoader } from './BeaverLoader'
import './LoadingScreen.css'

export function LoadingScreen({ message = 'Cargando...', visible = true }: { message?: string; visible?: boolean }) {
  return (
    <main className="loading-screen" id="main-content" aria-label={message}>
      {visible && <div className="loading-screen__content">
        <BeaverLoader />
        <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
      </div>}
    </main>
  )
}
