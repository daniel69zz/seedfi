// ---------------------------------------------------------------------------
//  Autoprueba del prover en el navegador
// ---------------------------------------------------------------------------
//  Importa EL MISMO worker que usa la aplicación. Una copia del worker
//  probaría una copia: el día que diverjan, esta página seguiría en verde
//  mientras la app falla.
import { initPoseidon, credentialLeaf } from '@s2d/zk'
import type { ProveRequest, ProveResponse } from './features/zk-eligibility/model/prover.worker'

const out = document.getElementById('out') as HTMLPreElement
out.textContent = ''
const log = (message: string) => { out.textContent += `${message}\n`; console.log('[zk-selftest]', message) }

async function main() {
  log(`crossOriginIsolated = ${window.crossOriginIsolated}`)
  log(`SharedArrayBuffer   = ${typeof SharedArrayBuffer !== 'undefined'}`)

  const [projectsRes, circuitRes, credsRes] = await Promise.all([
    fetch('/api/projects'), fetch('/api/circuit/eligibility'), fetch('/demo-credentials.json'),
  ])
  const { projects } = await projectsRes.json() as { projects: { name: string; onChainId: number; status: string; eligibility: { minNetWorth: string; allowedJurisdiction: number } }[] }
  const circuit = await circuitRes.json()
  const creds = await credsRes.json() as { credentials: Record<string, { secret: string; jurisdiction: number; netWorth: string; expiresAt: number }> }

  const project = projects.find((p) => p.status === 'FUNDING' || p.status === 'PUBLISHED')
  if (!project) throw new Error('no hay ronda abierta; corré  npm run seed -- --reset')
  log(`proyecto      ${project.name} (onChainId ${project.onChainId})`)

  const address = Object.keys(creds.credentials)[0]!
  const raw = creds.credentials[address]!
  log(`inversionista ${address}`)

  await initPoseidon()
  const leaf = `0x${credentialLeaf({
    secret: BigInt(raw.secret), jurisdiction: raw.jurisdiction,
    netWorth: BigInt(raw.netWorth), expiresAt: raw.expiresAt,
  }).toString(16).padStart(64, '0')}`

  const pathResponse = await fetch(`/api/issuer/path/${leaf}`)
  const merkle = await pathResponse.json() as { root?: string; path: string[]; indexBits: boolean[]; index: number; error?: string }
  if (!pathResponse.ok || !merkle.root) {
    // El caso habitual: `public/demo-credentials.json` quedó de un seed
    // anterior y su hoja ya no está en el árbol vigente. Vale la pena decirlo
    // con el comando exacto en vez de dejar un `undefined` tres líneas abajo.
    throw new Error(
      `${merkle.error ?? 'no se pudo obtener el camino de Merkle'}\n`
      + '  Las credenciales de demo están desactualizadas. Actualizalas con:\n'
      + '  cp backend/data/demo-credentials.json frontend/public/',
    )
  }
  const merkleProof = { ...merkle, root: merkle.root, leaf }
  log(`raíz emisor   ${merkleProof.root.slice(0, 20)}…`)

  const started = performance.now()
  const worker = new Worker(new URL('./features/zk-eligibility/model/prover.worker.ts', import.meta.url), { type: 'module' })

  worker.onmessage = (event: MessageEvent<ProveResponse>) => {
    const message = event.data
    if (message.type === 'progress') { log(`  · ${message.step}`); return }
    if (message.type === 'error') {
      log(`\nFALLO: ${message.message}`)
      message.problems?.forEach((p) => log(`  ${p}`))
      out.insertAdjacentHTML('beforeend', '<span class="bad">RESULTADO: FALLO</span>')
      return
    }
    log(`\nprueba generada en ${Math.round(performance.now() - started)} ms`)
    log(`  bytes        ${message.proof.length / 2 - 1}`)
    log(`  públicos     ${message.publicInputs.length}`)
    log(`  nullifier    ${message.nullifier}`)
    // Lo deja accesible para verificarlo contra el contrato desde fuera.
    ;(window as unknown as Record<string, unknown>).__zkResult = message
    out.insertAdjacentHTML('beforeend', '<span class="ok">RESULTADO: EXITO</span>')
  }

  worker.onerror = (event) => {
    log(`\nERROR DEL WORKER: ${event.message}`)
    out.insertAdjacentHTML('beforeend', '<span class="bad">RESULTADO: FALLO</span>')
  }

  const request: ProveRequest = {
    type: 'prove', circuit,
    credential: raw,
    merkle: merkleProof,
    projectId: project.onChainId,
    investorAddress: address,
    minNetWorth: project.eligibility.minNetWorth,
    allowedJurisdiction: project.eligibility.allowedJurisdiction,
    now: Math.floor(Date.now() / 1000),
  }
  worker.postMessage(request)
}

main().catch((error) => {
  log(`\nFALLO: ${error instanceof Error ? error.message : String(error)}`)
  out.insertAdjacentHTML('beforeend', '<span class="bad">RESULTADO: FALLO</span>')
})
