import { LOADING_TIMING } from '../config/loadingAnimation'

// Temporary request latency. Replace at the data boundary when an API is available.
export function fakeLoading(ms: number = LOADING_TIMING.simulatedDuration, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Carga cancelada', 'AbortError')); return }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, Number.isFinite(ms) ? Math.max(0, ms) : LOADING_TIMING.simulatedDuration)
    function cancel() {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      reject(new DOMException('Carga cancelada', 'AbortError'))
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}
