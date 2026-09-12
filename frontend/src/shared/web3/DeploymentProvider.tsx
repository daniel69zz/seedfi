/* oxlint-disable react/only-export-components */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { api, ApiError } from '../api/backend'
import { DeploymentContext, toDeployment, type Deployment } from './contracts'

/**
 * Resuelve las direcciones desplegadas al arrancar la app.
 *
 * Si el backend no está, o no hay despliegue para esta red, NO se rompe: se
 * guarda un `problem` con el comando exacto que hay que correr. Las pantallas
 * que solo leen dossiers siguen funcionando; las que escriben en cadena muestran
 * el mensaje.
 */
export function DeploymentProvider({ children }: PropsWithChildren) {
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [chainId, setChainId] = useState(31337)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const health = await api.health()
      setChainId(health.chainId)
      const resolved = toDeployment(health)
      setDeployment(resolved)
      setProblem(resolved ? null
        : `No hay contratos desplegados en la red ${health.chainId}. Corré: npm run contracts:deploy:local`)
    } catch (error) {
      setDeployment(null)
      setProblem(error instanceof ApiError ? error.message : 'No se pudo leer el estado del backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const value = useMemo(
    () => ({ deployment, chainId, loading, problem, refresh: () => void load() }),
    [deployment, chainId, loading, problem, load],
  )

  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>
}
