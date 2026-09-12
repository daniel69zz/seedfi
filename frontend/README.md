# Frontend — Seed 2 Deed

React 19 · Vite · wagmi + viem · Feature-Sliced Design

```bash
npm run dev:frontend    # :5173  (necesita el backend en :4000)
```

---

## Dos aplicaciones en un mismo bundle

| Ruta | Datos | Estado |
|------|-------|--------|
| `/`, `/opportunities`, `/company/*`, `/admin/*` | mocks en `shared/data/` | catálogo de demostración |
| **`/app/*`** | backend real + contratos desplegados | **la aplicación** |

Conviven a propósito: el marketplace mock sirve para mostrar la propuesta
completa, y `/app` es lo que de verdad mueve dinero. Mezclarlos haría imposible
saber qué está funcionando de verdad durante una demo.

### Pantallas de `/app`

| Ruta | Backlog | Qué hace |
|------|---------|----------|
| `/app` | T14 | Saldos, hitos e historial, **leídos de la cadena** |
| `/app/identity` | — | Registro, KYC y emisión de la credencial |
| `/app/invest` | T8 · T9 | Prueba ZK → aprobar USDT → invertir |
| `/app/developer/new` | T7 | Crear dossier, validarlo, publicarlo |
| `/app/verify` | T10 | Evidencia → firma → transmisión |

---

## Las tres decisiones que hay que conocer

### 1 · Las direcciones de contratos NO están en el código

Salen de `GET /api/health`, que las lee de `contracts/deployments/<chainId>.json`.
`DeploymentProvider` las resuelve al arrancar y `useDeployment()` las expone.

Una dirección hardcodeada es la forma más común de terminar apuntando la UI a un
vault viejo después de un redespliegue, sin que nadie lo note hasta que una
transacción revierte.

### 2 · La prueba ZK se genera acá, en un worker

`features/zk-eligibility/` — el secreto de la credencial vive en `localStorage`
y **nunca sale del dispositivo**. El worker recibe el secreto y devuelve solo la
prueba y los siete inputs públicos.

Probar tarda ~20 s en el navegador. En el hilo principal la pestaña se congela
entera; por eso va en `prover.worker.ts`.

> Barretenberg necesita `SharedArrayBuffer`, que exige aislamiento de origen
> cruzado. Lo habilitan las cabeceras COOP/COEP de `vite.config.ts` — **y hay
> que servirlas también en producción**, o el prover no arranca.

Autoprueba: <http://localhost:5173/zk-selftest.html> (usa el worker real).

### 3 · `now` sale del bloque, no del navegador

```ts
const block = await publicClient.getBlock()
// …now: Number(block.timestamp)
```

El contrato exige que la prueba sea reciente respecto de **su** reloj. Un host
desfasado produce `PruebaVencida()` sin ninguna pista de por qué.

---

## Estructura

```text
src/
├── shared/
│   ├── api/backend.ts          cliente del backend (T13) — único punto de contacto
│   └── web3/                   wagmi config · direcciones · DeploymentProvider
├── features/
│   ├── wallet/                 conectar + aviso de red equivocada
│   └── zk-eligibility/         credencial local · worker · hook
└── pages/app/ui/               las cinco pantallas
```

`AppShell.css` trae las piezas compartidas (`.card`, `.metric`, `.btn`,
`.notice`, `.pill`, `table.data`) sobre los tokens de `app/styles/variables.css`.

---

## Verificar

```bash
npx tsc -b --force      # tipos
npm run build -w frontend
npm run lint -w frontend
```

---

## Lo que falta

| Falta | Nota |
|-------|------|
| Autenticación real | El backend no tiene ninguna; la UI tampoco |
| `verifierKey` en un input | Solo demo. En producción la firma sale de la wallet del verificador |
| Code splitting | El bundle supera 500 kB por bb.js. Cargar el prover bajo demanda |
| Estados de carga | Varias pantallas muestran vacío mientras piden datos |
| Tests | No hay |
| El marketplace mock no lee del backend | `/opportunities` sigue con datos fijos |
