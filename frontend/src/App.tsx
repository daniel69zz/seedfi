import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './app/router/AppRouter'
import { AuthProvider } from './features/auth/model/AuthContext'
import { DemoProvider } from './features/demo/model/DemoContext'
import { ToastProvider } from './features/toast/model/ToastContext'
import { wagmiConfig } from './shared/web3/config'
import { DeploymentProvider } from './shared/web3/DeploymentProvider'

// wagmi lo exige y lo usa para cachear las lecturas de contratos. Se crea una
// sola vez fuera del componente: dentro, cada render lo recrearía y tiraría la
// caché entera.
const queryClient = new QueryClient()

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DeploymentProvider>
          <AuthProvider>
            <DemoProvider>
              <ToastProvider>
                <AppRouter />
              </ToastProvider>
            </DemoProvider>
          </AuthProvider>
        </DeploymentProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
