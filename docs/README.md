# Documentación — SeedFi

| Documento | Qué contiene | Para quién |
|-----------|--------------|------------|
| [`arquitectura.md`](arquitectura.md) | Capas, actores, flujo completo, decisiones de diseño y modelo de confianza | Todos. **Empezá acá** |
| [`esquemas.md`](esquemas.md) | Los cinco esquemas de datos, con diagramas | Backend, frontend |
| [`contratos.md`](contratos.md) | Superficie de los contratos, invariantes, modelo de amenaza | Smart contracts, auditoría |
| [`zk.md`](zk.md) | El circuito, generación y verificación de pruebas | ZK, frontend |
| [`api.md`](api.md) | Los 29 endpoints, con ejemplos reales | Frontend |
| [`operacion.md`](operacion.md) | Despliegue, demo, troubleshooting | Todos |
| [`guia-presentacion.md`](guia-presentacion.md) | Manual de flujos, estado en HashKey Testnet, guion de demo y Q&A | Quien presenta |
| [`pitch-5min.md`](pitch-5min.md) | Guion de pitch deck de 5 minutos: problema, contexto boliviano, solución | Quien presenta |

---

## Las tres ideas, si solo leés esto

**1 · El escrow libera por tramos, no de una vez.** Un escrow que entrega el
100 % al cerrar la ronda es una transferencia bancaria con pasos extra. El
control existe porque queda capital adentro: si el hito 3 falla, lo de los hitos
4 y 5 vuelve al inversionista.

**2 · El operador es un intermediario declarado, con cuatro puertas cerradas en
código.** No custodia, no puede liberar, no puede subir su comisión, y no puede
impedir un reembolso. No son promesas: son ausencias verificables en el bytecode
—no hay `withdraw`, no hay proxy— y una línea que le prohíbe designarse
verificador a sí mismo.

**3 · La elegibilidad se prueba, no se declara.** No existe un `setEligible`. El
inversionista genera una prueba de conocimiento cero en su propio dispositivo, y
el contrato aprende un bit. En la demo, una inversionista con KYC aprobado no
puede entrar porque su patrimonio no alcanza — y la plataforma nunca supo cuánto
tiene.

---

## Por dónde entrar según lo que vayas a hacer

```text
   Construir la UI            →  api.md  ·  esquemas.md §1  ·  zk.md §6
   Tocar la app /app          →  ../frontend/README.md
   Tocar los contratos        →  contratos.md  ·  arquitectura.md §5
   Tocar el circuito          →  zk.md  ·  contratos.md § EligibilityRegistry
   Entender el producto       →  arquitectura.md  ·  ../README.md
   Levantar la demo           →  operacion.md §2
   Preparar el pitch          →  guia-presentacion.md  ·  arquitectura.md §6-7
```

---

## Nota sobre estos documentos

Están generados desde el código y cada tabla lleva la ruta del archivo del que
salió. **Si algo no coincide, manda el código.**

Los números de rendimiento, tamaños y conteos de tests son medidos, no
estimados. Se verifican con:

```bash
npm run contracts:test    # 30 tests
npm run circuit:test      #  6 tests
npm run e2e               # flujo completo, sin mocks
```
