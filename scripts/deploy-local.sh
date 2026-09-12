#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Despliegue local completo sobre Anvil
# ---------------------------------------------------------------------------
#  Encadena los dos scripts de Foundry (van separados por un choque de pragmas,
#  ver DeployVerifier.s.sol) y deja `contracts/deployments/<chainId>.json`, que
#  es de donde el backend y el frontend leen las direcciones. Nadie las copia a
#  mano: así es como se termina apuntando la UI a un vault viejo sin notarlo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC="${RPC_URL:-http://127.0.0.1:8545}"
# Cuenta 0 de Anvil. Es pública y conocida: JAMÁS en una red con valor real.
export PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

cd "$ROOT/contracts"

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "No hay nodo en $RPC. Levantá uno con:  npm run chain" >&2
  exit 1
fi

CHAIN_ID="$(cast chain-id --rpc-url "$RPC")"

echo "==> 1/2  verificador UltraHonk"
forge script script/DeployVerifier.s.sol --rpc-url "$RPC" --broadcast --silent
VERIFIER="$(python3 -c "import json;print(json.load(open('deployments/verifier-${CHAIN_ID}.json'))['verifier'])")"
export VERIFIER_ADDRESS="$VERIFIER"
echo "    $VERIFIER"

echo "==> 2/2  token, registro de elegibilidad y vault"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --silent

echo
echo "Direcciones en contracts/deployments/${CHAIN_ID}.json:"
cat "deployments/${CHAIN_ID}.json"
echo
