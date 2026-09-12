/* oxlint-disable react/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import './Toast.css'

interface ToastContextValue {
  notify: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null)
  const value = useMemo(() => ({ notify(nextMessage: string) { setMessage(nextMessage) } }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>{message}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setMessage(null)}><X size={18} /></button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe utilizarse dentro de ToastProvider')
  return context
}
