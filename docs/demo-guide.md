# Guion de Pitch y Demo: Seed 2 Deed

**Tiempo estimado:** 10-12 minutos
**Audiencia:** Jueces de hackathon, inversionistas, desarrolladores.

---

## 1. El gancho (30 segundos)

«Invertir en bienes raíces en Latinoamérica está roto.
Si eres inversionista, entregas tu capital a ciegas y cruzas los dedos para que los fondos se usen correctamente. Si la obra se frena, tu dinero queda atrapado por años en litigios.
Si eres un desarrollador honesto, no puedes acceder a capital internacional porque no hay forma de demostrar confianza a distancia.
Y los intermediarios actuales extraen valor sin asumir responsabilidad cuando las cosas salen mal.

Seed 2 Deed no es otra plataforma de crowdfunding. Es **infraestructura de financiamiento programable** que resuelve la confianza a través de código.»

---

## 2. La solución (1 minuto)

«Presentamos Seed 2 Deed: un **escrow programable con cumplimiento regulatorio de conocimiento cero (ZK)**.

Nuestro sistema ofrece tres garantías inmutables escritas en la blockchain:
1. **El dinero solo se mueve por tramos:** Se libera contra hitos de obra verificados por terceros independientes.
2. **Cumplimiento sin revelar identidad:** Probamos que el inversionista está calificado para invertir sin exponer su patrimonio o datos personales, usando criptografía de conocimiento cero.
3. **La garantía definitiva:** Si algo falla en la obra y un hito se rechaza, el capital no liberado **vuelve automáticamente a los inversionistas**. Sin pedirle permiso a la plataforma, sin comisiones de salida y sin juicios.»

---

## 3. Preparación de la Demo (Checklist previo)

Antes de proyectar la pantalla, asegúrate de tener:

```bash
# Terminal 1: Iniciar la blockchain local
npm run chain

# Terminal 2: Desplegar contratos y sembrar datos iniciales
npm run contracts:deploy:local
npm run seed -- --reset

# Terminal 3: Levantar aplicaciones
npm run dev:backend    # :4000
npm run dev:frontend   # :5173
```

- [ ] MetaMask (u otra wallet) instalada con la red Localhost (`31337`, `http://127.0.0.1:8545`).
- [ ] Importar las cuentas de demostración en la wallet (ver sección 8 al final del documento).
- [ ] Asegurarse de tener seleccionada la cuenta del **Inversionista A** para empezar.

---

## 4. Guion de la Demo en Vivo (5-7 minutos)

### Paso 1: El Escaparate (Mock)
*Navega a `http://localhost:5173/opportunities`*
«Esta es la cara pública. Un marketplace donde los proyectos son curados. Esto es lo que cualquier usuario ve, pero lo importante ocurre bajo el capó.»

### Paso 2: La Aplicación Real
*Navega a `/app`*
«A partir de aquí, **todo lo que ven interactúa con contratos reales en la blockchain**. No hay bases de datos mintiendo sobre los saldos. Cada número tiene un hash de transacción.»

### Paso 3: Identidad y ZK
*Navega a `/app/identity`*
«El primer paso de un inversionista. La plataforma hace el KYC y emite una credencial verificable. El secreto se guarda **localmente en el navegador**, el servidor solo guarda un hash. El usuario es dueño de su dato.»

### Paso 4: Invertir sin revelar quién eres
*Navega a `/app/invest`*
«Aquí está la magia de Conocimiento Cero.
El contrato exige residencia válida y un patrimonio mínimo para esta ronda (ej. 100k USDT).
Presionamos **Generar prueba**. En este instante, el navegador está demostrando matemáticamente que cumplimos los requisitos, **sin enviar el monto de nuestro patrimonio a la red**.
*(Aprobamos USDT e invertimos)*
El dinero no va al desarrollador. Va a un **Vault** inmutable.»

### Paso 5: Verificación de Hitos
*Navega a `/app/verify` (Puedes cambiar a la cuenta del Verificador Supervisor o mostrarlo explicativamente)*
«La obra avanza. El desarrollador sube la evidencia (fotos, informes). El servidor calcula un hash criptográfico de esos documentos.
El inspector independiente revisa y **firma el hash de la evidencia**, no un texto libre. Si alguien cambia una coma del informe, la firma se invalida.»

### Paso 6: El Panel de Control
*Navega a `/app` (Dashboard)*
«En el panel vemos la realidad on-chain. Vemos cuánto está en el escrow y cuánto se ha liberado. Todo auditable.»

### Paso 7: LA DEMO CLAVE - El Escenario de Fracaso
«Cualquier sistema funciona cuando las cosas van bien. Seed 2 Deed brilla cuando las cosas van mal.
Supongamos que el inspector va a la obra para el siguiente hito y descubre que la obra está paralizada.»
*(En `/app/verify`, simula el rechazo de un hito o explica que un hito fue rechazado).*
«El hito es **RECHAZADO**. El estado del contrato cambia automáticamente a `MILESTONE_FAILED`.
En este momento, cualquier inversionista puede ir a su panel y ejecutar `refundRemaining`.
*(Muestra el botón de recuperar capital en el Dashboard)*
Al presionarlo, el 100% del capital que no se había liberado vuelve a su billetera.
**Permissionless.** No requiere la firma de nuestra plataforma. No cobra comisión de salida. El dinero vuelve porque las matemáticas y el código lo dictan, no porque nosotros lo autorizamos. Esto es verdadera custodia sin custodio.»

---

## 5. Profundidad Técnica (2 minutos)
*(Para los jueces técnicos)*

«Para lograr esto, construimos una arquitectura sólida:
1. **Circuitos Noir (ZK):** Compilamos las pruebas en el navegador (WASM multihilo). Validamos hojas en un árbol de Merkle con Poseidon2 para comprobar elegibilidad on-chain sin revelar datos públicos.
2. **Firmas EIP-712:** Los verificadores firman el estado exacto (hashes de evidencia + nonce) evitando ataques de repetición y garantizando responsabilidad legal.
3. **Escrow Programable (ProjectVault):** Un contrato inteligente sin función `withdraw()` para el administrador. Ni siquiera nosotros podemos mover el dinero. Las comisiones están topeadas directamente en el bytecode (ej. máximo 300 bps de originación).»

---

## 6. Cierre (30 segundos)

«Seed 2 Deed no es un experimento DeFi para especular con tokens. Es **infraestructura financiera para la economía real**.
Alineamos los incentivos: la plataforma no cobra comisión de éxito hasta que el inversionista recupera su capital. Protegemos al inversor y abrimos las puertas al financiamiento global para desarrolladores honestos en LATAM.
Gracias.»

---

## 7. Preguntas Frecuentes (Q&A)

**Q: ¿Qué pasa si el verificador desaparece o se corrompe?**
A: Cualquier persona puede llamar a la función `expireMilestone` si el plazo límite se cumple sin una acreditación. El capital no queda atrapado; si el hito vence, se habilita el reembolso del saldo restante para los inversionistas. Además, la evidencia hasheada garantiza que un verificador corrupto deje un rastro criptográfico si aprueba algo falso.

**Q: ¿Cómo gana dinero la plataforma?**
A: Cobramos un *fee* de originación (topeado por contrato) al liberar los hitos, y un *fee* de éxito **solo sobre los retornos** (intereses), nunca sobre el capital principal. Si el proyecto falla, no ganamos.

**Q: ¿Por qué ZK y no simplemente una base de datos tradicional para el KYC?**
A: Las bases de datos son hackeables. Al no guardar el patrimonio de los usuarios (solo la hoja del árbol de Merkle), eliminamos el riesgo de filtraciones masivas de datos financieros. Además, permite a los usuarios interactuar con contratos inteligentes de forma privada.

---

## 8. Cuentas de Demostración (Anvil)

*Usa la llave privada para importar en MetaMask. La red debe ser `Localhost 8545` (Chain ID 31337).*

| Rol | Dirección | Llave Privada (¡SOLO DEMO!) |
|---|---|---|
| **Operador** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Constructora** | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Verificador Legal** | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **Supervisor Obra** | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| **Inversionista A** | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| **Inversionista D (Rechazada)** | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |

*(La Inversionista D tiene KYC aprobado, pero el sistema ZK rechazará su inversión por no alcanzar el patrimonio mínimo de la ronda, demostrando la efectividad de las pruebas ZK).*
