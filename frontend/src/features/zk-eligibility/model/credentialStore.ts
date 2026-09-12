// ---------------------------------------------------------------------------
//  Custodia local de la credencial KYC
// ---------------------------------------------------------------------------
//
//  El secreto de la credencial vive en el navegador del titular y en ningún
//  otro lado. El backend lo entrega UNA vez al emitirla y no lo guarda.
//
//  `localStorage` es el lugar correcto para una demo y el incorrecto para
//  producción: cualquier XSS en este origen lo lee. En producción esto va a una
//  wallet, una extensión o un almacén cifrado con una clave derivada de una
//  firma del usuario. Lo que NO cambia es dónde vive: en el dispositivo.

export interface StoredCredential {
  secret: string
  jurisdiction: number
  netWorth: string
  expiresAt: number
  /** Hoja del árbol. Es lo que se usa para pedir el camino de Merkle. */
  leaf: string
  issuedAt: string
}

const KEY = 'seedfi.credentials'

type Store = Record<string, StoredCredential>

function read(): Store {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

function write(store: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Modo privado o cuota llena: la app tiene que seguir andando. El usuario
    // va a tener que re-emitir la credencial, y eso es mejor que un crash.
  }
}

export function saveCredential(address: string, credential: StoredCredential): void {
  const store = read()
  store[address.toLowerCase()] = credential
  write(store)
}

export function getCredential(address: string): StoredCredential | null {
  return read()[address.toLowerCase()] ?? null
}

export function forgetCredential(address: string): void {
  const store = read()
  delete store[address.toLowerCase()]
  write(store)
}

export function isExpired(credential: StoredCredential): boolean {
  return credential.expiresAt <= Math.floor(Date.now() / 1000)
}
