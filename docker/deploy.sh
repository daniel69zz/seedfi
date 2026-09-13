#!/bin/sh
# ---------------------------------------------------------------------------
#  Despliegue sobre la cadena del compose
# ---------------------------------------------------------------------------
#  Es `scripts/deploy-local.sh` sin las dos cosas que la imagen de Foundry no
#  trae: bash y python3. El resto es idéntico —los dos scripts de Foundry van
#  separados por el choque de pragmas que explica DeployVerifier.s.sol— y deja
#  `deployments/<chainId>.json`, que es de donde el backend lee las direcciones.
#  Ese directorio es un volumen compartido con el backend: nadie copia una
#  dirección a mano, que es como se termina apuntando la UI a un vault viejo.
set -eu

RPC="${RPC_URL:-http://anvil:8545}"
# Cuenta 0 de Anvil. Es pública y conocida: JAMÁS en una red con valor real.
export PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

cd /repo/contracts

# El healthcheck del compose cubre el caso normal; esto cubre el arranque en
# frío, cuando Anvil abrió el puerto pero todavía no contesta.
intento=0
until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do
  intento=$((intento + 1))
  if [ "$intento" -ge 30 ]; then
    echo "No hay nodo en $RPC" >&2
    exit 1
  fi
  sleep 1
done

CHAIN_ID="$(cast chain-id --rpc-url "$RPC")"

echo "==> 1/2  verificador UltraHonk"
forge script script/DeployVerifier.s.sol --rpc-url "$RPC" --broadcast --silent
VERIFIER="$(sed -n 's/.*"verifier"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "deployments/verifier-${CHAIN_ID}.json")"
if [ -z "$VERIFIER" ]; then
  echo "No pude leer la dirección del verificador en deployments/verifier-${CHAIN_ID}.json" >&2
  exit 1
fi
export VERIFIER_ADDRESS="$VERIFIER"
echo "    $VERIFIER"

echo "==> 2/2  token, registro de elegibilidad y vault"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --silent

echo
echo "Direcciones en contracts/deployments/${CHAIN_ID}.json:"
cat "deployments/${CHAIN_ID}.json"
echo
