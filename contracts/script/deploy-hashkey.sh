
#!/usr/bin/env bash
# deploy-hashkey.sh — Despliega y verifica SeedFi en HashKey Chain (HSK)
# Uso:
#   bash script/deploy-hashkey.sh             # testnet (por defecto)
#   NETWORK=mainnet bash script/deploy-hashkey.sh
# Requiere: foundry (forge + cast), jq, .env con PRIVATE_KEY y HSK para gas.
#   Testnet: consigue Sepolia ETH y puentéalo a HSK Testnet desde el bridge oficial.
#
# El script anterior para Avalanche Fuji quedó guardado en script/legacy/deploy-fuji.sh
set -euo pipefail

# ─── Cargar variables de entorno ──────────────────────────────────────────────
if [ -f ".env" ]; then
  set -a
  # shellcheck source=.env
  source .env
  set +a
else
  echo "ERROR: no se encontró el archivo .env en contracts/"
  echo "Crea uno con: PRIVATE_KEY=0x..."
  exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "ERROR: PRIVATE_KEY no está definida en el .env"
  exit 1
fi

# ─── Configuración ────────────────────────────────────────────────────────────
NETWORK="${NETWORK:-testnet}"
case "$NETWORK" in
  testnet)
    HSK_RPC="${HSK_RPC_URL:-https://testnet.hsk.xyz}"
    CHAIN_ID=133
    EXPLORER="https://testnet-explorer.hsk.xyz"
    ;;
  mainnet)
    HSK_RPC="${HSK_RPC_URL:-https://mainnet.hsk.xyz}"
    CHAIN_ID=177
    EXPLORER="https://hashkey.blockscout.com"
    ;;
  *)
    echo "ERROR: NETWORK debe ser 'testnet' o 'mainnet' (recibido: $NETWORK)"
    exit 1
    ;;
esac

# El explorador de HashKey Chain es Blockscout: no hace falta API key.
VERIFIER_URL="${EXPLORER}/api/"
DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
# Se guarda antes de desplegar: más abajo USDT_ADDRESS se pisa con la del JSON.
USDT_INPUT="${USDT_ADDRESS:-}"

# Si el RPC responde con otra cadena, abortar antes de gastar gas.
RPC_CHAIN_ID=$(cast chain-id --rpc-url "$HSK_RPC")
if [ "$RPC_CHAIN_ID" != "$CHAIN_ID" ]; then
  echo "ERROR: el RPC $HSK_RPC reporta chainId $RPC_CHAIN_ID, se esperaba $CHAIN_ID"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     SeedFi — Despliegue en HashKey Chain ($NETWORK)"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  RPC      : $HSK_RPC"
echo "  Chain ID : $CHAIN_ID"
echo "  Deployer : $DEPLOYER"
echo "  Balance  : $(cast balance "$DEPLOYER" --rpc-url "$HSK_RPC" --ether) HSK"
echo ""

# ─── Paso 1: Desplegar HonkVerifier ───────────────────────────────────────────
echo "[ 1/3 ] Desplegando HonkVerifier (EligibilityVerifier)..."
echo ""

forge script script/DeployVerifier.s.sol \
  --rpc-url "$HSK_RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --chain-id $CHAIN_ID \
  -vvv

VERIFIER_ADDRESS=$(jq -r '.verifier' "./deployments/verifier-${CHAIN_ID}.json")
echo ""
echo "  ✓ HonkVerifier: $VERIFIER_ADDRESS"
echo ""

# ─── Paso 2: Desplegar Registry + Vault ──────────────────────────────────────
echo "[ 2/3 ] Desplegando EligibilityRegistry + ProjectVault + MockUSDT..."
echo ""

VERIFIER_ADDRESS="$VERIFIER_ADDRESS" forge script script/Deploy.s.sol \
  --rpc-url "$HSK_RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --chain-id $CHAIN_ID \
  -vvv

VAULT_ADDRESS=$(jq -r '.vault'          "./deployments/${CHAIN_ID}.json")
USDT_ADDRESS=$(jq -r '.usdt'            "./deployments/${CHAIN_ID}.json")
REGISTRY_ADDRESS=$(jq -r '.eligibility' "./deployments/${CHAIN_ID}.json")

echo ""
echo "  ✓ ProjectVault       : $VAULT_ADDRESS"
echo "  ✓ EligibilityRegistry: $REGISTRY_ADDRESS"
echo "  ✓ USDT               : $USDT_ADDRESS"
echo ""

# ─── Paso 3: Verificar contratos en Blockscout ───────────────────────────────
echo "[ 3/3 ] Verificando contratos en Blockscout ($EXPLORER)..."
echo ""

_verify() {
  local label="$1"
  local address="$2"
  local contract="$3"
  echo "  → Verificando $label ($address)..."
  # `|| true`: una verificación fallida no debe tumbar el resumen; los
  # contratos ya están desplegados y se pueden re-verificar a mano.
  forge verify-contract "$address" "$contract" \
    --rpc-url "$HSK_RPC" \
    --chain-id $CHAIN_ID \
    --verifier blockscout \
    --verifier-url "$VERIFIER_URL" \
    --guess-constructor-args \
    --watch \
    2>&1 | sed 's/^/     /' || true
  echo ""
}

_verify "HonkVerifier"        "$VERIFIER_ADDRESS" "src/verifiers/EligibilityVerifier.sol:HonkVerifier"
_verify "EligibilityRegistry" "$REGISTRY_ADDRESS" "src/EligibilityRegistry.sol:EligibilityRegistry"
_verify "ProjectVault"        "$VAULT_ADDRESS"    "src/ProjectVault.sol:ProjectVault"
# Si se pasó USDT_ADDRESS (token real) no hay MockUSDT que verificar.
if [ -z "$USDT_INPUT" ]; then
  _verify "MockUSDT"          "$USDT_ADDRESS"     "src/mocks/MockUSDT.sol:MockUSDT"
fi

# ─── Resumen final ────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       ✓ Despliegue y verificación completados        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Archivo de direcciones: deployments/${CHAIN_ID}.json"
echo ""
cat "./deployments/${CHAIN_ID}.json"
echo ""
echo "  Explorer:"
echo "  HonkVerifier        → $EXPLORER/address/$VERIFIER_ADDRESS"
echo "  EligibilityRegistry → $EXPLORER/address/$REGISTRY_ADDRESS"
echo "  ProjectVault        → $EXPLORER/address/$VAULT_ADDRESS"
echo "  USDT                → $EXPLORER/address/$USDT_ADDRESS"
echo ""
