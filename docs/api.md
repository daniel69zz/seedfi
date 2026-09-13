# API HTTP

Base: `http://localhost:4000` · 29 endpoints · `backend/src/routes/`

Todos los montos viajan como **string decimal en unidades mínimas** (USDT, 6
decimales). Ver [esquemas.md](esquemas.md#convenciones-que-atraviesan-todos-los-esquemas).

---

## Errores

Un único traductor de errores a HTTP (`backend/src/index.ts`). Sin eso, cada ruta
termina con su propio `try/catch` y tarde o temprano alguno deja escapar un stack
trace con la ruta del filesystem — o peor, responde `200` con un cuerpo de error.

| Código | Cuándo | Cuerpo |
|--------|--------|--------|
| `400` | Dato inválido, o revert de la EVM | `{ error, details? }` |
| `403` | Firmante no autorizado para ese hito | `{ error }` |
| `404` | No existe | `{ error }` |
| `409` | Conflicto de estado | `{ error }` |
| `422` | El dossier no pasa la validación | `{ error, details: ValidationIssue[] }` |
| `503` | Sin contratos desplegados | `{ error }` |

Un revert de la EVM se traduce con su `shortMessage`, que sí le sirve a quien
está del otro lado; el stack de viem, no.

```json
{ "error": "El proyecto está en UNDER_REVIEW y ya no se puede editar. Un dossier con capital comprometido —o en revisión— no cambia bajo los pies de quien lo está evaluando." }
```

---

## Salud

### `GET /api/health`

```json
{
  "ok": true,
  "chainId": 133,
  "rpcUrl": "https://testnet.hsk.xyz",
  "deployed": true,
  "contracts": {
    "vault": "0xf1Da8fA04bE703cC52bc8Ac269a439111FeaD838",
    "usdt": "0x3A1dFe4C26c41c34Ae7DdbCd389b722EE5d00A6D",
    "eligibility": "0x2820abe6f9e299CDb8Fb46Fbc1F40C4401B5d346",
    "verifier": "0x4BC765ABB1D686d1e7bEf955095A69735F42394b",
    "operator": "0x08eDd01f987bEAF8E3F40EFe7b9851d123872B45",
    "feeRecipient": "0x08eDd01f987bEAF8E3F40EFe7b9851d123872B45",
    "chainId": 133,
    "blockNumber": 33043874
  },
  "ipfs": false
}
```

Respuesta real contra HashKey Chain Testnet. En Anvil, `chainId` es `31337` y
`rpcUrl` es `http://127.0.0.1:8545`. `ipfs` indica si hay `PINATA_JWT`
configurado.

`deployed: false` **no es un fallo**: el backend sirve dossiers sin cadena. Lo
que no funciona sin cadena está marcado ruta por ruta con un `503`.

### `POST /api/sync`

Fuerza una pasada del indexador.

```json
{ "fromBlock": 42, "toBlock": 57, "events": 6,
  "statusChanges": [{ "projectId": "S2D-f6d5bd7b", "from": "FUNDING", "to": "ACTIVE" }] }
```

---

## Proyectos

### `GET /api/projects`

Query: `?status=DRAFT,SUBMITTED` · `?developerId=dev-vallesur`

```json
{ "projects": [ /* ProjectDossier[] */ ] }
```

### `GET /api/marketplace`

Solo `PUBLISHED · FUNDING · ACTIVE · COMPLETED`. **Lo que ya pasó due diligence.**

### `GET /api/projects/:id`

Acepta el `id` (`S2D-…`) o el `onChainId`.

```json
{
  "project":     { /* ProjectDossier */ },
  "validation":  [ { "field": "property.encumbrances", "message": "…", "severity": "WARNING" } ],
  "evidence":    [ /* Evidence[] */ ],
  "reviewNotes": [ /* ReviewNote[] */ ],
  "events":      [ /* eventos on-chain indexados */ ]
}
```

### `POST /api/projects` → `201`

Cuerpo: `ProjectDossier` sin `id`, `onChainId`, `status`, `createdAt`,
`updatedAt`, `publishedAt`.

Devuelve `{ project, validation }`. **Un borrador incompleto tiene que poder
guardarse**: la validación se devuelve como resultado, no rechaza. La barrera
está al presentarlo.

### `PATCH /api/projects/:id`

Solo en `DRAFT` o `CHANGES_REQUESTED` → si no, `409`.

`id`, `onChainId` y `status` no se tocan por patch: el id ya puede estar
referenciado en cadena, y el estado se mueve por transiciones.

### `POST /api/projects/:id/risk`

```json
{ "scores": { "legal": 82, "financial": 71, "developer": 78,
              "market": 66, "property": 74, "construction": 70, "liquidity": 55 },
  "rationale": "Terreno pagado y escriturado al SPV…",
  "assessedBy": "comite@seedfi.bo" }
```

Calcula `total` ponderado y `grade`. Escribe aunque el dossier esté congelado:
**la calificación es del comité, no una edición del desarrollador**.

### `POST /api/projects/:id/submit`

`DRAFT | CHANGES_REQUESTED → SUBMITTED`. **Corre la validación bloqueante.**

`422` con el detalle:

```json
{ "error": "El dossier tiene errores que impiden presentarlo.",
  "details": [ { "field": "sourcesAndUses",
    "message": "Las fuentes (2250000000000) no cubren los usos (2342000000000). Faltan 92000000000 unidades y alguien va a tener que ponerlas.",
    "severity": "ERROR" } ] }
```

### `POST /api/projects/:id/review`

```json
{ "decision": "APPROVED", "note": "Aprobado con calificación A…", "author": "comite@seedfi.bo" }
```

`decision`: `UNDER_REVIEW | CHANGES_REQUESTED | APPROVED | REJECTED`

**La nota es obligatoria.** Un «rechazado» sin motivo no le sirve a nadie: ni al
desarrollador para corregir, ni al comité para revisarlo después.

### `POST /api/projects/:id/publish`

> ⚠️ **Punto sin retorno.** A partir de acá los hitos, la meta, el plazo y las
> comisiones quedan grabados en el vault y no se pueden cambiar.

Solo desde `APPROVED`. Revalida el dossier entero aunque ya se haya validado al
presentarlo.

Ejecuta tres transacciones: `createProject` → `grantVerifier × N` → `setPolicy`.

```json
{ "project": { /* … status: "PUBLISHED" */ },
  "transactions": { "createProject": "0xe5aa…", "grantVerifiers": ["0x…"], "setPolicy": "0x…" } }
```

### `GET /api/projects/:id/chain`

**Lo que dice la cadena, no la base de datos.**

```json
{
  "vault": "0xf1Da…", "chainId": 133, "status": "ACTIVE",
  "target": "900000000000", "raised": "900000000000",
  "released": "180000000000", "locked": "720000000000",
  "frozenRemaining": "0", "totalRepaid": "0",
  "nextMilestone": 1, "originationBps": 200, "successBps": 1500,
  "milestones": [
    { "index": 0, "bps": 2000, "role": "LEGAL", "deadline": "2026-11-11T…",
      "released": true, "state": "RELEASED", "amount": "180000000000" }
  ],
  "events": [ /* … */ ]
}
```

`locked = raised − released` es **el número que le importa al inversionista**: es
lo que puede recuperar si un hito falla.

`amount` se calcula sobre lo **recaudado**, no sobre la meta: si la ronda cerró
por encima del objetivo, cada hito libera proporcionalmente más.

---

## Evidencia

### `POST /api/projects/:id/evidence` → `201`

```json
{ "milestoneIndex": 0, "kind": "CERTIFICADO",
  "filename": "certificado-gravamenes.pdf", "contentType": "application/pdf",
  "sizeBytes": 184320, "uploadedBy": "dev-vallesur",
  "notes": "Emitido por Derechos Reales Cochabamba",
  "contentBase64": "…" }
```

`kind`: `INFORME | FOTOGRAFIA | FACTURA | CERTIFICADO | PLANO | CONTRATO | OTRO`

> **El `sha256` se calcula en el servidor sobre los bytes recibidos y no se
> acepta del cliente.** Aceptarlo sería dejar que quien sube la evidencia elija
> qué se firma.

### `GET /api/projects/:id/evidence/:milestoneIndex/bundle`

```json
{ "milestoneIndex": 0, "evidence": [ /* … */ ],
  "bundleHash": "0x9f2c…" }
```

El `bundleHash` se construye ordenando los `sha256` individuales y hasheando la
concatenación. El orden lo hace **determinista** —dos personas llegan al mismo
hash— y agregar o quitar **un** archivo lo cambia entero. Eso es lo que impide
que alguien firme un hito y después cambie qué había adentro.

`409` si el hito no tiene evidencia: firmar sin evidencia deja una acreditación
que después nadie puede contrastar contra nada.

---

## Verificación de hitos

### `GET /api/projects/:id/milestones/:index/review`

La bandeja del verificador.

```json
{
  "milestone": { "index": 0, "title": "Cierre legal y societario", "bps": 2000, "role": "LEGAL" },
  "evidence": [ /* … */ ],
  "requiredEvidence": ["CERTIFICADO", "CONTRATO"],
  "missingKinds": [],
  "bundleHash": "0x9f2c…",
  "attestations": [],
  "verifiers": [ { "address": "0x3C44…", "name": "Dra. Carla Peñaranda", "role": "LEGAL" } ]
}
```

`missingKinds` existe para que el verificador no tenga que recordar de memoria
qué se acordó exigir hace ocho meses al abrir la ronda.

### `POST /api/projects/:id/milestones/:index/attest` → `201`

```json
{ "approved": true, "verifierKey": "0x5de4…" }
```

> ⚠️ **`verifierKey` viaja en el cuerpo SOLO en la demo.** En producción la firma
> se produce en la wallet del verificador —Metamask, hardware wallet, multisig— y
> acá llega firmada.
>
> Una plataforma que custodia las llaves de sus verificadores **puede acreditar
> sus propios hitos**, y toda la separación entre operar y acreditar se vuelve
> decorativa.

Valida antes de firmar: que el firmante esté registrado en el proyecto y que su
rol coincida con el del hito. El contrato lo rechazaría igual; se corta acá para
no gastar gas.

```json
{ "attestation": { "digest": "0x…", "evidenceHash": "0x…", "approved": true,
    "nonce": "…", "expiresAt": 1789..., "signature": "0x…", "signer": "0x3C44…",
    "submittedTx": null } }
```

Vigencia por defecto: **7 días**. Una firma sin vencimiento es una firma eterna.

El `nonce` es aleatorio de 256 bits: dos firmas del mismo hito con la misma
evidencia dan digests distintos, así que una firma revocada no bloquea la
siguiente.

### `POST /api/attestations/:digest/submit`

Manda la attestation a la cadena → `releaseMilestone` o `failMilestone`.

```json
{ "txHash": "0x…", "blockNumber": 58, "status": "success" }
```

> **Esto es una comodidad, no una llave.** `releaseMilestone` autoriza por la
> firma y no por el remitente: cualquiera puede transmitirla. Si este servidor se
> cae, un tramo ya firmado sigue siendo liberable.

### `POST /api/projects/:id/expire`

Congela el capital de un hito vencido. **Atajo de UI**: `expireMilestone` es
permissionless en el contrato y cualquiera puede llamarlo directo — y ese es
justamente el punto.

---

## Inversionistas y KYC

### `POST /api/investors` → `201`

```json
{ "address": "0x15d3…", "displayName": "María Fernanda Aguilar", "email": "mf.aguilar@example.bo" }
```

### `GET /api/investors/:address`

```json
{ "investor": { "address": "0x15d3…", "kycStatus": "APPROVED", "kycSyncedAt": "…" },
  "credentials": [ { "id": "…", "leafIndex": 0, "leaf": "0x1bd3…", "revokedAt": null } ] }
```

### `POST /api/investors/:address/kyc`

```json
{ "approved": true }
```

Escribe `setKyc` en el vault. Es lo que la plataforma **afirma** sobre una
wallet — distinto de lo que el inversionista **prueba** con el circuito.

---

## Credenciales ZK

### `POST /api/investors/:address/credential` → `201`

```json
{ "jurisdiction": 68, "netWorth": "380000", "expiresAt": 1820769805 }
```

```json
{
  "credential": { "id": "…", "leafIndex": 0, "leaf": "0x1bd3…", "revokedAt": null },
  "secret": { "secret": "0x2b86…", "jurisdiction": 68, "netWorth": "380000", "expiresAt": 1820769805 },
  "issuerRoot": "0x17e3…",
  "aviso": "Guardá `secret` ahora: el servidor no lo almacena y no hay forma de recuperarlo."
}
```

> **`secret` vuelve una sola vez.** Quien lo pierda necesita una credencial
> nueva. Es el precio de que un backend comprometido no pueda suplantar a nadie.

### `DELETE /api/credentials/:id`

Revoca: pone la hoja en `0` y republica la raíz.

```json
{ "revoked": "…", "issuerRoot": "0x8a1f…" }
```

### `GET /api/issuer/root`

```json
{ "root": "0x17e3…", "credentials": 4 }
```

### `GET /api/issuer/path/:leaf`

El camino de Merkle, para armar la prueba **en el dispositivo**.

```json
{ "root": "0x17e3…", "path": ["0x…", /* 8 */], "indexBits": [false, true, …], "index": 1 }
```

Es público por diseño: revela la **posición** en el árbol, no el contenido de la
credencial. Y quien lo pide ya tiene que conocer su propia hoja para saber cuál
pedir.

### `POST /api/issuer/publish/:onChainId`

```json
{ "minNetWorth": "100000", "jurisdiction": 68 }
```

Publica la raíz vigente como política de una ronda. Republicarla es también el
mecanismo de revocación.

### `GET /api/circuit/eligibility`

El circuito compilado, para el navegador. Ver
[zk.md](zk.md#8-regenerar-el-verificador) sobre por qué va por acá y no en el
bundle. `503` si no está compilado.

---

## Índice completo

| Método | Ruta |
|--------|------|
| `GET` | `/api/health` |
| `POST` | `/api/sync` |
| `GET` | `/api/projects` |
| `GET` | `/api/marketplace` |
| `GET` | `/api/projects/:id` |
| `POST` | `/api/projects` |
| `PATCH` | `/api/projects/:id` |
| `POST` | `/api/projects/:id/risk` |
| `POST` | `/api/projects/:id/submit` |
| `POST` | `/api/projects/:id/review` |
| `POST` | `/api/projects/:id/publish` |
| `GET` | `/api/projects/:id/chain` |
| `POST` | `/api/projects/:id/evidence` |
| `GET` | `/api/projects/:id/evidence/:milestoneIndex/bundle` |
| `GET` | `/api/projects/:id/milestones/:index/review` |
| `POST` | `/api/projects/:id/milestones/:index/attest` |
| `POST` | `/api/attestations` |
| `POST` | `/api/attestations/:digest/submit` |
| `POST` | `/api/projects/:id/expire` |
| `GET` | `/api/investors` |
| `GET` | `/api/investors/:address` |
| `POST` | `/api/investors` |
| `POST` | `/api/investors/:address/kyc` |
| `POST` | `/api/investors/:address/credential` |
| `DELETE` | `/api/credentials/:id` |
| `GET` | `/api/issuer/root` |
| `GET` | `/api/issuer/path/:leaf` |
| `POST` | `/api/issuer/publish/:onChainId` |
| `GET` | `/api/circuit/eligibility` |

---

## Lo que falta

| Falta | Nota |
|-------|------|
| Autenticación | **No hay ninguna.** Todas las rutas son abiertas. Antes de exponer esto a una red hace falta auth por wallet (SIWE) y autorización por rol |
| Rate limiting | |
| `POST /api/attestations` | Devuelve `501`: recibir firmas producidas por fuera es el camino de producción y está sin implementar |
| Esquemas JSON | Fastify soporta validación por esquema; las rutas hoy castean el cuerpo |
| OpenAPI | |
