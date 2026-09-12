# Seed 2 Deed

**Infraestructura de financiamiento programable para proyectos inmobiliarios.**

Conecta desarrolladores que necesitan capital con inversionistas: liquida en
stablecoins, custodia en escrow programable y libera el dinero por tramos,
conforme verificadores independientes acreditan el avance de la obra.

La blockchain no reemplaza al Registro de Derechos Reales ni al inspector de
obra. Se usa para lo que sí resuelve: **custodia sin custodio, desembolso
condicionado y una auditoría que nadie puede reescribir.**

---

## Arrancar

```bash
npm install

npm run chain                    # terminal 1 — Anvil en :8545
```

```bash
npm run contracts:deploy:local   # terminal 2
npm run seed -- --reset
npm run e2e
```

Si el último comando termina en `TODO VERDE`, **todo el sistema funciona**:
contratos, pruebas de conocimiento cero, firmas EIP-712 y el flujo completo de
punta a punta.

Para levantar las aplicaciones:

```bash
npm run dev:backend    # API en :4000
npm run dev:frontend   # UI  en :5173
```

---

## Requisitos

| Herramienta | Versión | ¿Obligatoria? |
|-------------|---------|---------------|
| **Node** | ≥ 20 (probado en 26.5) | Sí |
| **Foundry** | `forge` 1.8+ | Sí |
| Noir (`nargo`) | `1.0.0-beta.26` | Solo para modificar el circuito |
| Barretenberg (`bb`) | `5.2.0` | Solo para modificar el circuito |

```bash
# Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Noir + Barretenberg  (opcionales)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash && bbup -v 5.2.0
```

```bash
node --version && forge --version    # verificar
```

> El verificador Solidity ya está commiteado, así que **Noir y bb no hacen falta**
> para correr nada de lo de arriba.

---

## Paso a paso

### 1 · Dependencias

```bash
npm install
```

Instala los cuatro workspaces: `contracts` (vía Foundry), `packages/shared`,
`packages/zk`, `backend` y `frontend`.

### 2 · Cadena local

```bash
npm run chain
```

Anvil en `:8545`, chainId `31337`, bloques cada 2 s. **Dejalo corriendo.**

### 3 · Desplegar los contratos

```bash
npm run contracts:deploy:local
```

```text
==> 1/2  verificador UltraHonk
    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
==> 2/2  token, registro de elegibilidad y vault

Direcciones en contracts/deployments/31337.json:
{ "vault": "0x5FC8…", "usdt": "0xCf7E…", "eligibility": "0xDc64…", … }
```

Escribe `contracts/deployments/31337.json`. **Backend y frontend leen de ahí**:
nadie copia direcciones a mano, que es como se termina apuntando la UI a un vault
viejo sin notarlo.

### 4 · Sembrar la demo

```bash
npm run seed -- --reset
```

Crea el proyecto **Edificio Aurora** (Cochabamba, meta 900.000 USDT, 5 hitos), lo
pasa por todo el ciclo de due diligence, registra dos verificadores, emite
credenciales KYC a cuatro inversionistas y publica la ronda en cadena.

Al terminar imprime los secretos de las credenciales y los vuelca en
`backend/data/demo-credentials.json` *(gitignoreado)*.

### 5 · Probar el flujo completo

```bash
npm run e2e
```

Sin mocks: pruebas ZK reales, contratos reales, firmas reales.

```text
ESCENARIO A — camino feliz
  Lucía Nogales rechazada · patrimonio insuficiente, sin revelarlo
  3 inversionistas: prueba ZK → invest → ronda cierra en 900.000 → ACTIVE
  5 hitos liberados contra firmas de DOS verificadores distintos
  Repago en dos cuotas · claim a prorrata · 0 unidades de polvo de redondeo

ESCENARIO B — el freno
  Hito RECHAZADO → MILESTONE_FAILED
  refundRemaining: 100 % de lo no liberado, a prorrata, sin comisión
  Ninguna transacción necesitó la firma del operador
```

El escenario B es el que importa. Cualquier plataforma puede demostrar que el
dinero entra; **lo que hay que demostrar es qué pasa cuando algo sale mal.**

---

## Verificar

```bash
npm run contracts:test    # 30 tests de contratos
npm run circuit:test      #  6 tests del circuito
npm run e2e               # flujo completo contra la cadena
```

---

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run chain` | Anvil, chainId 31337 |
| `npm run contracts:deploy:local` | Despliega los 4 contratos |
| `npm run seed -- --reset` | Limpia la base y siembra la demo |
| `npm run e2e` | Flujo completo end-to-end |
| `npm run dev:backend` | API en `:4000` |
| `npm run dev:frontend` | UI en `:5173` |
| `npm run contracts:build` · `contracts:test` | Compilar · testear contratos |
| `npm run circuit:test` · `circuit:build` | Testear · recompilar el circuito **y el verificador** |
| `node scripts/sync-abi.mjs` | Regenera los ABIs tipados desde `contracts/out` |

---

## Cuentas de la demo

Las diez determinísticas de Anvil (`backend/src/demo-accounts.ts`). Su mnemónico
es **público**: nunca uses estas llaves en una red con valor real.

| Rol | # | Dirección | Patrimonio declarado |
|-----|---|-----------|----------------------|
| Operador / tesorería | 0 | `0xf39Fd6e5…` | — |
| Constructora | 1 | `0x70997970…` | — |
| Verificador **LEGAL** | 2 | `0x3C44CdDd…` | — |
| Verificador **SUPERVISOR** | 3 | `0x90F79bf6…` | — |
| Inversionista A | 4 | `0x15d34AAf…` | 380.000 |
| Inversionista B | 5 | `0x9965507D…` | 2.400.000 |
| Inversionista C | 6 | `0x976EA740…` | 145.000 |
| Inversionista D | 7 | `0x14dC7996…` | **60.000** |

**D existe para demostrar el rechazo.** Tiene el KYC aprobado por la plataforma
y aun así el circuito no le deja generar una prueba, porque no alcanza el
patrimonio mínimo de la ronda — y su patrimonio no se revela en ningún lado.

---

## Problemas comunes

| Síntoma | Solución |
|---------|----------|
| `No hay nodo en http://127.0.0.1:8545` | `npm run chain` |
| `No hay despliegue para la red 31337` | `npm run contracts:deploy:local` |
| `no hay proyecto sembrado` | `npm run seed -- --reset` |
| `El circuito no está compilado` *(503)* | `npm run circuit:build` |
| Reiniciaste Anvil y el backend sirve datos viejos | La base sobrevive, la cadena no: redesplegá y `npm run seed -- --reset` |
| `PruebaVencida()` | Tomá `now` del **bloque**, no del reloj del host |

### Reset completo

```bash
pkill -f anvil
rm -rf backend/data contracts/deployments contracts/broadcast
npm run chain &
sleep 3 && npm run contracts:deploy:local && npm run seed -- --reset && npm run e2e
```

Más casos en [`docs/operacion.md`](docs/operacion.md#8-troubleshooting).

---

## Estado conocido

> ⚠️ **`npm run build` falla en el frontend.** Hay 8 errores de tipos
> preexistentes en `OpportunityCard.tsx`, `OpportunityStats.tsx`,
> `useOpportunitySort.ts` y `MarketplaceFilters.tsx`: referencian
> `assessedBy`, `totalReturnPct` y los sorts `apy-desc`/`apy-asc`, que no existen
> en el tipo `Opportunity`.
>
> **No afecta a nada de lo de arriba**: `npm run dev:frontend` y `vite build`
> funcionan, porque Vite no corre el typecheck. Backend, contratos y circuito
> compilan limpio.

---

## Qué lo diferencia

Seed 2 Deed **es** un intermediario: cura los proyectos, corre el KYC/KYB y cobra
por hacerlo. No lo disimula. Lo que cambia son cinco puertas cerradas **en
código**, no en los términos y condiciones:

| | Garantía | Cómo se verifica |
|---|----------|------------------|
| 1 | **No custodia.** El capital está en el contrato | No existe `withdraw()`, `pause()`, rescate ni proxy |
| 2 | **No puede liberar.** Solo un verificador firma un hito | `grantVerifier` revierte si el verificador es el operador |
| 3 | **Comisión topeada.** Máximos inmutables en el bytecode | `MAX_ORIGINATION_BPS = 300` · `MAX_SUCCESS_BPS = 2000` |
| 4 | **Los reembolsos no pagan comisión ni piden permiso** | `refund` y `refundRemaining` son permissionless |
| 5 | **No puede fabricar elegibilidad** | No existe `setEligible`: la única entrada es una prueba ZK |

Y una que alinea los incentivos: la comisión de éxito se cobra **solo sobre el
retorno, jamás sobre el capital**. Mientras la constructora no haya devuelto todo
lo que le prestaron, la plataforma no gana un centavo — primero cobra el
inversionista.

---

## Documentación

| Documento | Qué contiene |
|-----------|--------------|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Capas, actores, flujo completo, decisiones y modelo de confianza. **Empezá acá** |
| [`docs/esquemas.md`](docs/esquemas.md) | Los cinco esquemas de datos, con diagramas |
| [`docs/contratos.md`](docs/contratos.md) | Superficie de los contratos, invariantes, modelo de amenaza |
| [`docs/zk.md`](docs/zk.md) | El circuito de elegibilidad, generación y verificación de pruebas |
| [`docs/api.md`](docs/api.md) | Los 29 endpoints, con ejemplos reales |
| [`docs/operacion.md`](docs/operacion.md) | Despliegue a testnet, configuración, troubleshooting |

---

## Estructura

```text
seed2deed/
├── contracts/          Solidity + Foundry · 30 tests
│   ├── src/            ProjectVault · EligibilityRegistry · MockUSDT
│   ├── src/verifiers/  UltraHonk generado desde el circuito
│   └── script/         despliegue en dos pasos
├── circuits/
│   └── eligibility/    circuito Noir · 6 tests
├── packages/
│   ├── shared/         dominio, validación, ABIs generados
│   └── zk/             Poseidon2, árbol de credenciales, pruebas
├── backend/            Fastify + node:sqlite + viem · 29 endpoints
├── frontend/           React 19 + Vite
├── docs/
└── scripts/
```

---

## Estado del backlog

| ID | Tarea | |
|----|-------|---|
| T1 | Schema del dossier | ✅ |
| T2 | Scaffolding del monorepo | ✅ |
| T3 | EscrowContract | ✅ |
| T4 | Circuito Noir de elegibilidad | ✅ |
| T5 | ZK Verifier on-chain | ✅ |
| T6 | API backend | ✅ |
| T11 | Deploy a testnet | ✅ |
| T15 | Datos semilla | ✅ |
| T16 | E2E del flujo completo | ✅ |
| T7 · T8 · T9 · T10 | Vistas del frontend | ⬜ |
| T12 · T13 | Integración frontend ↔ contratos / backend | ⬜ |
| T14 | Dashboard de estado | ⬜ |
| T17 | Guion de pitch | ⬜ |
| T18 · T19 | IPFS · waterfall automático *(stretch)* | ⬜ |

---

## Despliegue a testnet

```bash
cd contracts
export PRIVATE_KEY=0x…
export RPC=https://api.avax-test.network/ext/bc/C/rpc

forge script script/DeployVerifier.s.sol --rpc-url $RPC --broadcast
export VERIFIER_ADDRESS=$(python3 -c "import json;print(json.load(open('deployments/verifier-43113.json'))['verifier'])")
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
```

Redes soportadas: Anvil `31337` · Avalanche Fuji `43113` · Base Sepolia `84532`
· Ethereum Sepolia `11155111`.

Detalle completo, incluido **por qué el despliegue son dos pasos**, en
[`docs/operacion.md`](docs/operacion.md#4-despliegue).
