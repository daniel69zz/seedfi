import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { IdCard, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { api, ApiError, type Investor } from '../../../shared/api/backend'
import { getCredential, saveCredential, forgetCredential, isExpired, type StoredCredential } from '../../../features/zk-eligibility/model/credentialStore'

const JURISDICTIONS = [
  [68, 'Bolivia'], [32, 'Argentina'], [76, 'Brasil'], [152, 'Chile'],
  [604, 'Perú'], [840, 'Estados Unidos'], [724, 'España'],
] as const

const UN_ANIO = 365 * 24 * 60 * 60

/**
 * Identidad: registro, KYC y emisión de la credencial verificable.
 *
 * Es la pantalla donde se ve, en un solo lugar, que son DOS cosas distintas:
 *
 *   · el tamizaje AML, que la plataforma AFIRMA y escribe en el vault;
 *   · la credencial ZK, que el inversionista PRUEBA y que ni el operador puede
 *     fabricar.
 *
 * Tener las dos juntas acá es deliberado: en cuanto se separan, la gente asume
 * que son lo mismo.
 */
export function IdentityPage() {
  const { address, isConnected } = useAccount()
  const [investor, setInvestor] = useState<Investor | null>(null)
  const [credential, setCredential] = useState<StoredCredential | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [form, setForm] = useState({ displayName: '', email: '', jurisdiction: 68, netWorth: '250000' })

  const load = useCallback(async () => {
    if (!address) { setInvestor(null); return }
    setCredential(getCredential(address))
    try {
      const { investor: found } = await api.investors.detail(address)
      setInvestor(found)
    } catch (caught) {
      // 404 es el caso normal de una wallet nueva, no un error que mostrar.
      if (!(caught instanceof ApiError && caught.status === 404)) {
        setError(caught instanceof Error ? caught.message : 'Error al consultar el inversionista.')
      }
      setInvestor(null)
    }
  }, [address])

  useEffect(() => { void load() }, [load])

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(null); setFlash(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falló la operación.')
    } finally {
      setBusy(null)
    }
  }

  if (!isConnected || !address) {
    return (
      <section className="card">
        <h2><IdCard size={20} aria-hidden /> Identidad</h2>
        <p className="card__lead">Conectá tu wallet para registrarte y obtener tu credencial.</p>
      </section>
    )
  }

  return (
    <div className="stack">
      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p>{flash}</p></div>}

      {/* ── 1. Registro ─────────────────────────────────────────────── */}
      <section className="card">
        <h2>1 · Registro</h2>
        {investor ? (
          <p className="card__lead">
            Registrado como <strong>{investor.displayName}</strong> ({investor.email}).
          </p>
        ) : (
          <>
            <p className="card__lead">Todavía no estás registrado con esta wallet.</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="displayName">Nombre o razón social</label>
                <input id="displayName" value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="email">Correo</label>
                <input id="email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn--primary"
                disabled={busy !== null || !form.displayName || !form.email}
                onClick={() => run('register', async () => {
                  await api.investors.register({ address, displayName: form.displayName, email: form.email })
                  await load()
                  setFlash('Registro creado.')
                })}>
                {busy === 'register' ? 'Registrando…' : 'Registrarme'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── 2. Tamizaje AML ─────────────────────────────────────────── */}
      <section className="card">
        <h2>2 · Tamizaje AML <span className="pill pill--pending">lo afirma la plataforma</span></h2>
        <p className="card__lead">
          Es la obligación regulatoria del operador, y se escribe en el vault con su firma.
          Podría mentir: por eso <strong>no alcanza por sí sola</strong> para invertir.
        </p>
        <div className="row">
          <span className={`pill ${investor?.kycStatus === 'APPROVED' ? 'pill--ok' : 'pill--pending'}`}>
            {investor?.kycStatus ?? 'SIN REGISTRO'}
          </span>
          <button type="button" className="btn" disabled={!investor || busy !== null || investor.kycStatus === 'APPROVED'}
            onClick={() => run('kyc', async () => {
              const { txHash } = await api.investors.setKyc(address, true)
              await load()
              setFlash(`KYC aprobado on-chain. tx ${txHash}`)
            })}>
            <ShieldCheck size={16} aria-hidden />
            {busy === 'kyc' ? 'Enviando…' : 'Aprobar KYC (demo)'}
          </button>
        </div>
        <p className="field__hint" style={{ marginTop: '.75rem' }}>
          En la demo lo aprueba un botón. En producción lo hace el proveedor de KYC tras verificar documentos.
        </p>
      </section>

      {/* ── 3. Credencial ZK ────────────────────────────────────────── */}
      <section className="card">
        <h2>3 · Credencial verificable <span className="pill pill--ok">la probás vos</span></h2>

        {credential && !isExpired(credential) ? (
          <>
            <p className="card__lead">
              Tenés una credencial guardada <strong>en este navegador</strong>. El servidor no la tiene.
            </p>
            <div className="grid-3">
              <div className="metric">
                <p className="metric__value">{JURISDICTIONS.find(([c]) => c === credential.jurisdiction)?.[1] ?? credential.jurisdiction}</p>
                <p className="metric__label">Jurisdicción</p>
              </div>
              <div className="metric">
                <p className="metric__value">•••••</p>
                <p className="metric__label">Patrimonio (nunca se revela)</p>
              </div>
              <div className="metric">
                <p className="metric__value">{new Date(credential.expiresAt * 1000).toLocaleDateString('es-BO')}</p>
                <p className="metric__label">Vence</p>
              </div>
            </div>
            <p className="mono" style={{ marginTop: '1rem' }}>hoja: {credential.leaf}</p>
            <button type="button" className="btn btn--danger" style={{ marginTop: '.5rem' }}
              onClick={() => { forgetCredential(address); setCredential(null); setFlash('Credencial borrada de este navegador.') }}>
              <Trash2 size={16} aria-hidden /> Borrar de este navegador
            </button>
          </>
        ) : (
          <>
            {credential && <div className="notice notice--warn"><p>La credencial guardada venció. Emití una nueva.</p></div>}
            <p className="card__lead">
              El emisor verifica tus datos una vez y publica una raíz. Vos guardás un secreto.
              A partir de ahí probás que cumplís sin revelar nada.
            </p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="jurisdiction">Jurisdicción de residencia</label>
                <select id="jurisdiction" value={form.jurisdiction}
                  onChange={(e) => setForm({ ...form, jurisdiction: Number(e.target.value) })}>
                  {JURISDICTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="netWorth">Patrimonio verificado (USD)</label>
                <input id="netWorth" inputMode="numeric" value={form.netWorth}
                  onChange={(e) => setForm({ ...form, netWorth: e.target.value.replace(/\D/g, '') })} />
                <p className="field__hint">El emisor lo ve una vez. No se guarda, no se publica, no se revela.</p>
              </div>
            </div>
            <button type="button" className="btn btn--primary" style={{ marginTop: '1rem' }}
              disabled={!investor || busy !== null || !form.netWorth}
              onClick={() => run('credential', async () => {
                const response = await api.investors.issueCredential(address, {
                  jurisdiction: form.jurisdiction,
                  netWorth: form.netWorth,
                  expiresAt: Math.floor(Date.now() / 1000) + UN_ANIO,
                })
                // Se guarda ACÁ, en el dispositivo. Es la única copia.
                const stored: StoredCredential = {
                  secret: response.secret.secret,
                  jurisdiction: response.secret.jurisdiction,
                  netWorth: response.secret.netWorth,
                  expiresAt: response.secret.expiresAt,
                  leaf: response.credential.leaf,
                  issuedAt: new Date().toISOString(),
                }
                saveCredential(address, stored)
                setCredential(stored)
                setFlash('Credencial emitida y guardada en este navegador. El servidor solo conserva la hoja.')
              })}>
              <KeyRound size={16} aria-hidden />
              {busy === 'credential' ? 'Emitiendo…' : 'Emitir credencial'}
            </button>
            {!investor && <p className="field__hint" style={{ marginTop: '.5rem' }}>Registrate primero.</p>}
          </>
        )}
      </section>
    </div>
  )
}
