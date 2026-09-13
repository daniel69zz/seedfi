#!/usr/bin/env bash
# deploy-fuji.sh — Despliega y verifica SeedFi en Avalanche Fuji Testnet
# Uso: bash script/deploy-fuji.sh
# Requiere: foundry (forge + cast), .env con PRIVATE_KEY, AVAX de testnet.
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
FUJI_RPC="https://api.avax-test.network/ext/bc/C/rpc"
CHAIN_ID=43113
VERIFIER_URL="https://api.routescan.io/v2/network/testnet/evm/43113/etherscan"
# Routescan acepta "verifyContract" como clave pública para testnet.
# Si tienes una API key propia de Snowtrace, ponla en .env como SNOWTRACE_API_KEY.
ETHERSCAN_KEY="${SNOWTRACE_API_KEY:-verifyContract}"
DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        SeedFi — Despliegue en Fuji Testnet           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  RPC      : $FUJI_RPC"
echo "  Chain ID : $CHAIN_ID"
echo "  Deployer : $DEPLOYER"
echo ""

# ─── Paso 1: Desplegar HonkVerifier ───────────────────────────────────────────
echo "[ 1/3 ] Desplegando HonkVerifier (EligibilityVerifier)..."
echo ""

forge script script/DeployVerifier.s.sol \
  --rpc-url "$FUJI_RPC" \
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
  --rpc-url "$FUJI_RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --chain-id $CHAIN_ID \
  -vvv

VAULT_ADDRESS=$(jq -r '.vault'        "./deployments/${CHAIN_ID}.json")
USDT_ADDRESS=$(jq -r '.usdt'          "./deployments/${CHAIN_ID}.json")
REGISTRY_ADDRESS=$(jq -r '.eligibility' "./deployments/${CHAIN_ID}.json")

echo ""
echo "  ✓ ProjectVault       : $VAULT_ADDRESS"
echo "  ✓ EligibilityRegistry: $REGISTRY_ADDRESS"
echo "  ✓ MockUSDT           : $USDT_ADDRESS"
echo ""

# ─── Paso 3: Verificar contratos en Snowtrace ────────────────────────────────
echo "[ 3/3 ] Verificando contratos en Snowtrace (Routescan)..."
echo ""

_verify() {
  local label="$1"
  local address="$2"
  local contract="$3"
  echo "  → Verificando $label ($address)..."
  forge verify-contract "$address" "$contract" \
    --chain-id $CHAIN_ID \
    --verifier custom \
    --verifier-url "$VERIFIER_URL" \
    --etherscan-api-key "$ETHERSCAN_KEY" \
    --watch \
    2>&1 | sed 's/^/     /'
  echo ""
}

_verify "HonkVerifier"       "$VERIFIER_ADDRESS" "src/verifiers/EligibilityVerifier.sol:HonkVerifier"
_verify "EligibilityRegistry" "$REGISTRY_ADDRESS"  "src/EligibilityRegistry.sol:EligibilityRegistry"
_verify "ProjectVault"       "$VAULT_ADDRESS"    "src/ProjectVault.sol:ProjectVault"
_verify "MockUSDT"           "$USDT_ADDRESS"     "src/mocks/MockUSDT.sol:MockUSDT"

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
echo "  HonkVerifier       → https://testnet.snowtrace.io/address/$VERIFIER_ADDRESS"
echo "  EligibilityRegistry → https://testnet.snowtrace.io/address/$REGISTRY_ADDRESS"
echo "  ProjectVault        → https://testnet.snowtrace.io/address/$VAULT_ADDRESS"
echo "  MockUSDT            → https://testnet.snowtrace.io/address/$USDT_ADDRESS"
echo ""
