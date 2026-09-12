import { AppRouter } from './app/router/AppRouter'
import { AuthProvider } from './features/auth/model/AuthContext'
import { DemoProvider } from './features/demo/model/DemoContext'
import { ToastProvider } from './features/toast/model/ToastContext'

export default function App() {
  return (
    <AuthProvider>
      <DemoProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </DemoProvider>
    </AuthProvider>
  )
}
