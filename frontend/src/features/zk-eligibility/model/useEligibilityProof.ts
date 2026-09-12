// ---------------------------------------------------------------------------
//  Hook de generación de la prueba de elegibilidad  (backlog T9)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../shared/api/backend'
import { getCredential, isExpired, type StoredCredential } from './credentialStore'
import type { ProveRequest, ProveResponse } from './prover.worker'

export interface EligibilityProof {
  proof: `0x${string}`
  publicInputs: `0x${string}`[]
  nullifier: string
  elapsedMs: number
}

export type ProverState =
  | { status: 'idle' }
  | { status: 'working'; step: string }
  | { status: 'done'; proof: EligibilityProof }
  | { status: 'error'; message: string; problems?: string[] }

export interface ProveInput {
  projectId: number
  investorAddress: string
  minNetWorth: string
  allowedJurisdiction: number
  /** Timestamp del BLOQUE, no del reloj del navegador. Ver abajo. */
  now: number
}

export function useEligibilityProof(address?: string) {
  const [state, setState] = useState<ProverState>({ status: 'idle' })
  const [credential, setCredential] = useState<StoredCredential | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    setCredential(address ? getCredential(address) : null)
  }, [address])

  // El worker se termina al desmontar: si el usuario navega mientras prueba,
  // dejar el hilo vivo se come un core hasta que la pestaña se cierre.
  useEffect(() => () => workerRef.current?.terminate(), [])

  const prove = useCallback(async (input: ProveInput): Promise<EligibilityProof | null> => {
    if (!address) {
      setState({ status: 'error', message: 'Conectá tu wallet primero.' })
      return null
    }

    const stored = getCredential(address)
    if (!stored) {
      setState({
        status: 'error',
        message: 'No hay una credencial KYC guardada en este navegador para esta wallet.',
        problems: ['Emitila desde la pantalla de verificación de identidad.'],
      })
      return null
    }
    if (isExpired(stored)) {
      setState({ status: 'error', message: 'La credencial venció. Pedí una nueva al emisor.' })
      return null
    }

    setState({ status: 'working', step: 'Consultando el árbol del emisor…' })

    try {
      // El camino de Merkle se pide en el momento: la raíz cambia cada vez que
      // el emisor emite o revoca, y una prueba contra una raíz vieja la rechaza
      // el contrato con `RaizNoCoincide`.
      const [circuit, merkle] = await Promise.all([
        api.circuit(),
        api.issuer.path(stored.leaf),
      ])

      return await new Promise<EligibilityProof | null>((resolve) => {
        workerRef.current?.terminate()
        const worker = new Worker(new URL('./prover.worker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker

        worker.onmessage = (event: MessageEvent<ProveResponse>) => {
          const message = event.data
          if (message.type === 'progress') {
            setState({ status: 'working', step: message.step })
            return
          }
          if (message.type === 'error') {
            setState({ status: 'error', message: message.message, problems: message.problems })
            worker.terminate()
            resolve(null)
            return
          }
          const proof: EligibilityProof = {
            proof: message.proof as `0x${string}`,
            publicInputs: message.publicInputs as `0x${string}`[],
            nullifier: message.nullifier,
            elapsedMs: message.elapsedMs,
          }
          setState({ status: 'done', proof })
          worker.terminate()
          resolve(proof)
        }

        worker.onerror = () => {
          setState({
            status: 'error',
            message: 'No se pudo iniciar el generador de pruebas.',
            problems: [
              'Barretenberg necesita SharedArrayBuffer, que exige aislamiento de origen cruzado.',
              'En desarrollo lo habilitan las cabeceras COOP/COEP de vite.config.ts.',
            ],
          })
          worker.terminate()
          resolve(null)
        }

        const request: ProveRequest = {
          type: 'prove',
          circuit,
          credential: {
            secret: stored.secret,
            jurisdiction: stored.jurisdiction,
            netWorth: stored.netWorth,
            expiresAt: stored.expiresAt,
          },
          merkle: { ...merkle, leaf: stored.leaf },
          projectId: input.projectId,
          investorAddress: address,
          minNetWorth: input.minNetWorth,
          allowedJurisdiction: input.allowedJurisdiction,
          now: input.now,
        }
        worker.postMessage(request)
      })
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Falló la preparación de la prueba.',
      })
      return null
    }
  }, [address])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, prove, reset, credential, hasCredential: credential !== null }
}
