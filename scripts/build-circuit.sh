#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Compila el circuito y regenera el verificador Solidity
# ---------------------------------------------------------------------------
#  El `-t evm` de los dos comandos de bb NO es opcional ni intercambiable: fija
#  keccak como oráculo de Fiat-Shamir y activa el modo ZK. Tiene que ser el mismo
#  target con el que el frontend genera las pruebas (`verifierTarget: 'evm'`);
#  con otro, la prueba es válida y el contrato la rechaza igual.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT="$ROOT/circuits/eligibility"
OUT="$ROOT/contracts/src/verifiers/EligibilityVerifier.sol"

export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"

for tool in nargo bb; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Falta '$tool'." >&2
    echo "  nargo:  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup" >&2
    echo "  bb:     curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash && bbup -v 5.2.0" >&2
    exit 1
  }
done

cd "$CIRCUIT"

echo "==> 1/4  tests del circuito"
nargo test

echo "==> 2/4  compilar"
nargo compile

echo "==> 3/4  clave de verificación"
mkdir -p target/vk
bb write_vk -b target/eligibility.json -o target/vk -t evm

echo "==> 4/4  verificador Solidity"
bb write_solidity_verifier -k target/vk/vk -o "$OUT" -t evm

echo
echo "Verificador regenerado: ${OUT#"$ROOT/"}  ($(wc -l < "$OUT" | tr -d ' ') líneas)"
echo
echo "ATENCIÓN: cambió el circuito, así que hay que desplegar un verificador y un"
echo "registro NUEVOS. El vault NO se migra — se lo reapunta con setEligibilityGate."
