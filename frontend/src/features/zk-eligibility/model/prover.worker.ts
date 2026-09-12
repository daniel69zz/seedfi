// ---------------------------------------------------------------------------
//  Worker de generación de pruebas
// ---------------------------------------------------------------------------
//
//  Probar tarda unos segundos y ocupa el hilo entero. En el hilo principal, la
//  pestaña se congela: ni un spinner gira. Acá corre aparte y la UI sigue viva.
//
//  El secreto de la credencial entra a este worker y no sale: lo único que se
//  devuelve es la prueba y los siete inputs públicos.

import {
  initPoseidon, generateEligibilityProof, checkEligibilityLocally,
  type Credential, type MerkleProof,
} from '@s2d/zk'

export interface ProveRequest {
  type: 'prove'
  circuit: { bytecode: string; abi: unknown }
  credential: { secret: string; jurisdiction: number; netWorth: string; expiresAt: number }
  merkle: { root: string; path: string[]; indexBits: boolean[]; index: number; leaf: string }
  projectId: number
  investorAddress: string
  minNetWorth: string
  allowedJurisdiction: number
  now: number
}

export type ProveResponse =
  | { type: 'progress'; step: string }
  | { type: 'done'; proof: string; publicInputs: string[]; nullifier: string; elapsedMs: number }
  | { type: 'error'; message: string; problems?: string[] }

const post = (message: ProveResponse) => self.postMessage(message)

self.onmessage = async (event: MessageEvent<ProveRequest>) => {
  const request = event.data
  if (request.type !== 'prove') return

  const started = performance.now()
  try {
    post({ type: 'progress', step: 'Cargando el motor criptográfico…' })
    await initPoseidon()

    const credential: Credential = {
      secret: BigInt(request.credential.secret),
      jurisdiction: request.credential.jurisdiction,
      netWorth: BigInt(request.credential.netWorth),
      expiresAt: request.credential.expiresAt,
    }

    const merkleProof: MerkleProof = {
      root: BigInt(request.merkle.root),
      path: request.merkle.path.map((p) => BigInt(p)),
      indexBits: request.merkle.indexBits,
      leaf: BigInt(request.merkle.leaf),
      index: request.merkle.index,
    }

    const inputs = {
      credential,
      merkleProof,
      projectId: request.projectId,
      investorAddress: request.investorAddress,
      minNetWorth: BigInt(request.minNetWorth),
      allowedJurisdiction: request.allowedJurisdiction,
      now: request.now,
    }

    // Chequeo previo en castellano. El circuito valida lo mismo, pero un
    // `assert` fallido adentro devuelve un error opaco de barretenberg.
    post({ type: 'progress', step: 'Verificando la credencial…' })
    const problems = checkEligibilityLocally(inputs)
    if (problems.length > 0) {
      post({ type: 'error', message: 'La credencial no cumple las condiciones de esta ronda.', problems })
      return
    }

    post({ type: 'progress', step: 'Generando la prueba de conocimiento cero…' })
    const proof = await generateEligibilityProof(request.circuit, inputs)

    post({
      type: 'done',
      proof: proof.proof,
      publicInputs: proof.publicInputs,
      nullifier: proof.nullifier,
      elapsedMs: Math.round(performance.now() - started),
    })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : 'Falló la generación de la prueba.' })
  }
}
