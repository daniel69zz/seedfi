import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileCheck2, FileX2, Send, Upload, AlertTriangle } from 'lucide-react'
import type { ProjectDossier } from '@s2d/shared'
import { formatAmount } from '@s2d/shared'
import { api, type ChainState, type MilestoneReview } from '../../../shared/api/backend'

const EVIDENCE_KINDS = ['INFORME', 'FOTOGRAFIA', 'FACTURA', 'CERTIFICADO', 'PLANO', 'CONTRATO', 'OTRO'] as const

/**
 * Bandeja del verificador  (backlog T10)
 *
 * Tres actos que la UI mantiene SEPARADOS a propósito:
 *
 *   · subir evidencia    — lo hace el desarrollador;
 *   · firmar             — lo hace el verificador, y firma el HASH del paquete;
 *   · transmitir a la cadena — lo puede hacer cualquiera.
 *
 * Juntarlos en un botón "aprobar" sería más cómodo y borraría justamente la
 * distinción que hace que el sistema no dependa de una sola parte.
 */
export function VerifyPage() {
  const [projects, setProjects] = useState<ProjectDossier[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [chain, setChain] = useState<ChainState | null>(null)
  const [review, setReview] = useState<MilestoneReview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [verifierKey, setVerifierKey] = useState('')
  const [evidence, setEvidence] = useState({ kind: 'INFORME', filename: '', notes: '' })

  const project = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId])

  useEffect(() => {
    void api.projects.list(['PUBLISHED', 'FUNDING', 'ACTIVE'])
      .then(({ projects: found }) => {
        setProjects(found)
        if (found[0]) setSelectedId(found[0].id)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los proyectos.'))
  }, [])

  const load = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const state = await api.projects.chain(project.id)
      setChain(state)
      setReview(await api.projects.milestoneReview(project.id, state.nextMilestone))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el hito.')
      setReview(null)
    }
  }, [project])

  useEffect(() => { void load() }, [load])

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label); setError(null); setFlash(null)
    try {
      const message = await action()
      await load()
      if (message) setFlash(message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falló la operación.')
    } finally {
      setBusy(null)
    }
  }

  if (projects.length === 0) {
    return <section className="card"><h2>Verificar hitos</h2>
      <p className="card__lead">{error ?? 'No hay proyectos publicados todavía.'}</p></section>
  }

  const pending = review?.attestations.filter((a) => !a.submittedTx) ?? []
  const notActive = chain && chain.status !== 'ACTIVE'

  return (
    <div className="stack">
      <section className="card">
        <h2>Proyecto</h2>
        <div className="field">
          <label htmlFor="vproject">Proyecto</label>
          <select id="vproject" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.status}</option>)}
          </select>
        </div>
        {chain && (
          <div className="grid-3" style={{ marginTop: '1.25rem' }}>
            <div className="metric"><p className="metric__value">{chain.status}</p><p className="metric__label">Estado on-chain</p></div>
            <div className="metric"><p className="metric__value">{chain.nextMilestone + 1}/{chain.milestones.length}</p><p className="metric__label">Hito en turno</p></div>
            <div className="metric metric--highlight"><p className="metric__value">{formatAmount(chain.locked)}</p><p className="metric__label">Sigue en el escrow</p></div>
          </div>
        )}
      </section>

      {error && <div className="notice notice--error"><p><strong>{error}</strong></p></div>}
      {flash && <div className="notice notice--ok"><p>{flash}</p></div>}

      {notActive && (
        <div className="notice notice--warn">
          <p><AlertTriangle size={16} aria-hidden /> El proyecto está en <strong>{chain.status}</strong>.
          Los hitos solo se acreditan con la ronda cerrada (<code>ACTIVE</code>).</p>
        </div>
      )}

      {review && (
        <>
          <section className="card">
            <h2>Hito {review.milestone.index} · {review.milestone.title}</h2>
            <p className="card__lead">{review.milestone.description}</p>
            <div className="grid-3">
              <div className="metric">
                <p className="metric__value">{review.milestone.bps / 100} %</p>
                <p className="metric__label">Del capital recaudado</p>
              </div>
              <div className="metric">
                <p className="metric__value">{review.milestone.role}</p>
                <p className="metric__label">Rol que debe acreditar</p>
              </div>
              <div className="metric">
                <p className="metric__value">{new Date(review.milestone.deadline).toLocaleDateString('es-BO')}</p>
                <p className="metric__label">Vence</p>
              </div>
            </div>

            <h3>Evidencia pactada</h3>
            <div className="row">
              {review.requiredEvidence.map((kind) => (
                <span key={kind} className={`pill ${review.missingKinds.includes(kind) ? 'pill--bad' : 'pill--ok'}`}>
                  {kind}{review.missingKinds.includes(kind) ? ' · falta' : ''}
                </span>
              ))}
            </div>
            <p className="field__hint" style={{ marginTop: '.5rem' }}>
              Se pactó al abrir la ronda, no ahora que toca cobrar.
            </p>

            {review.evidence.length > 0 && (
              <div className="table-scroll" style={{ marginTop: '1rem' }}>
                <table className="data">
                  <thead><tr><th>Archivo</th><th>Tipo</th><th>sha256</th><th>IPFS</th></tr></thead>
                  <tbody>
                    {review.evidence.map((e) => (
                      <tr key={e.id}>
                        <td>{e.filename}</td>
                        <td><span className="pill">{e.kind}</span></td>
                        <td className="mono" title={e.sha256}>{e.sha256.slice(0, 10)}…</td>
                        <td>
                          {e.ipfsCid ? (
                            <a href={`https://gateway.pinata.cloud/ipfs/${e.ipfsCid}`} target="_blank" rel="noreferrer" className="mono">
                              {e.ipfsCid.slice(0, 8)}…
                            </a>
                          ) : (
                            <button className="btn btn--small" onClick={() => void run('pin', async () => {
                              await api.evidence.pin(e.id)
                              await load()
                              return 'Evidencia anclada en IPFS.'
                            })}>
                              Pin IPFS
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {review.bundleHash && (
              <p className="mono" style={{ marginTop: '1rem' }}>
                hash del paquete: {review.bundleHash}
              </p>
            )}
          </section>

          {/* ── subir evidencia ───────────────────────────────────── */}
          <section className="card">
            <h2><Upload size={20} aria-hidden /> Subir evidencia</h2>
            <p className="card__lead">
              El <code>sha256</code> lo calcula el servidor sobre los bytes recibidos.
              Aceptarlo del cliente sería dejar que quien sube elija qué se firma.
            </p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="kind">Tipo</label>
                <select id="kind" value={evidence.kind} onChange={(e) => setEvidence({ ...evidence, kind: e.target.value })}>
                  {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="file">Archivo</label>
                <input id="file" type="file" onChange={(e) => setEvidence({ ...evidence, filename: e.target.files?.[0]?.name ?? '' })} />
              </div>
            </div>
            <div className="field" style={{ marginTop: '.75rem' }}>
              <label htmlFor="notes">Notas</label>
              <textarea id="notes" rows={2} value={evidence.notes}
                onChange={(e) => setEvidence({ ...evidence, notes: e.target.value })} />
            </div>
            <button type="button" className="btn" style={{ marginTop: '1rem' }}
              disabled={busy !== null}
              onClick={() => void run('upload', async () => {
                const input = document.getElementById('file') as HTMLInputElement | null
                const file = input?.files?.[0]
                if (!file) throw new Error('Elegí un archivo.')
                const bytes = new Uint8Array(await file.arrayBuffer())
                let binary = ''
                for (const byte of bytes) binary += String.fromCharCode(byte)
                await api.projects.addEvidence(project!.id, {
                  milestoneIndex: review.milestone.index,
                  kind: evidence.kind,
                  filename: file.name,
                  contentType: file.type || 'application/octet-stream',
                  sizeBytes: file.size,
                  sha256: `0x${'00'.repeat(32)}`, // el servidor lo recalcula
                  uploadedBy: 'frontend',
                  notes: evidence.notes,
                  contentBase64: btoa(binary),
                })
                if (input) input.value = ''
                return 'Evidencia registrada. El hash del paquete cambió.'
              })}>
              {busy === 'upload' ? 'Subiendo…' : 'Subir'}
            </button>
          </section>

          {/* ── firmar ───────────────────────────────────────────── */}
          <section className="card">
            <h2>Acreditar el hito</h2>
            <p className="card__lead">
              El verificador firma el <strong>hash del paquete de evidencia</strong>, no un texto libre.
              Sin eso, después nadie puede demostrar contra qué firmó.
            </p>

            <div className="table-scroll">
              <table className="data">
                <thead><tr><th>Verificador</th><th>Rol</th><th>Matrícula</th></tr></thead>
                <tbody>
                  {review.verifiers.map((v) => (
                    <tr key={v.address}>
                      <td>{v.name}<br /><span className="mono">{v.address}</span></td>
                      <td><span className={`pill ${v.role === review.milestone.role ? 'pill--ok' : 'pill--pending'}`}>{v.role}</span></td>
                      <td>{v.license}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="vkey">Llave privada del verificador</label>
              <input id="vkey" type="password" value={verifierKey} placeholder="0x…"
                onChange={(e) => setVerifierKey(e.target.value)} />
              <p className="field__hint">
                ⚠️ Solo en la demo. En producción la firma se produce en la wallet del verificador
                y llega firmada. Una plataforma que custodia estas llaves puede acreditar sus propios
                hitos, y toda la separación entre operar y acreditar se vuelve decorativa.
              </p>
            </div>

            <div className="row" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn--primary"
                disabled={busy !== null || !verifierKey || review.missingKinds.length > 0 || !!notActive}
                onClick={() => void run('attest-ok', async () => {
                  await api.projects.attest(project!.id, review.milestone.index, { approved: true, verifierKey })
                  return 'Attestation firmada. Falta transmitirla a la cadena.'
                })}>
                <FileCheck2 size={16} aria-hidden />
                {busy === 'attest-ok' ? 'Firmando…' : 'Firmar aprobación'}
              </button>

              <button type="button" className="btn btn--danger"
                disabled={busy !== null || !verifierKey || !!notActive}
                onClick={() => void run('attest-no', async () => {
                  await api.projects.attest(project!.id, review.milestone.index, { approved: false, verifierKey })
                  return 'Rechazo firmado. Al transmitirlo, el capital no liberado se congela para reembolso.'
                })}>
                <FileX2 size={16} aria-hidden />
                {busy === 'attest-no' ? 'Firmando…' : 'Firmar rechazo'}
              </button>
            </div>

            {review.missingKinds.length > 0 && (
              <p className="field__hint" style={{ marginTop: '.75rem' }}>
                Falta evidencia pactada. Firmar un hito sin ella deja una acreditación
                que después nadie puede contrastar contra nada.
              </p>
            )}
          </section>

          {/* ── transmitir ───────────────────────────────────────── */}
          {pending.length > 0 && (
            <section className="card">
              <h2><Send size={20} aria-hidden /> Transmitir a la cadena</h2>
              <p className="card__lead">
                <code>releaseMilestone</code> autoriza por la <strong>firma</strong>, no por el remitente:
                esta transacción la puede enviar cualquiera.
              </p>
              <div className="table-scroll">
                <table className="data">
                  <thead><tr><th>Digest</th><th>Decisión</th><th>Firmante</th><th /></tr></thead>
                  <tbody>
                    {pending.map((a) => (
                      <tr key={a.digest}>
                        <td className="mono">{a.digest.slice(0, 18)}…</td>
                        <td><span className={`pill ${a.approved ? 'pill--ok' : 'pill--bad'}`}>{a.approved ? 'Aprobado' : 'Rechazado'}</span></td>
                        <td className="mono">{a.signer.slice(0, 10)}…</td>
                        <td>
                          <button type="button" className="btn" disabled={busy !== null}
                            onClick={() => void run(`submit-${a.digest}`, async () => {
                              const { txHash } = await api.attestations.submit(a.digest)
                              return `Transmitida. tx ${txHash}`
                            })}>
                            {busy === `submit-${a.digest}` ? 'Enviando…' : 'Transmitir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
