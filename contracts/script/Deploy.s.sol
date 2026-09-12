// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ProjectVault} from "../src/ProjectVault.sol";
import {EligibilityRegistry} from "../src/EligibilityRegistry.sol";
import {MockUSDT} from "../src/mocks/MockUSDT.sol";

/// @title  Deploy — despliegue completo de Seed 2 Deed   (backlog T11)
///
/// @notice Orden de despliegue y por qué es ese:
///
///           0. Verifier   — lo despliega `DeployVerifier.s.sol`, antes que esto.
///           1. USDT       — en testnet, un mock; en una red real, la dirección
///                           del token de verdad, que se pasa por `USDT_ADDRESS`.
///           2. Registry   — necesita la dirección del verificador.
///           3. Vault      — necesita el token.
///           4. setEligibilityGate — el vault apunta al registro.
///
///         El último paso va separado porque es el único que se puede rehacer:
///         cambiar el circuito obliga a desplegar verificador y registro
///         nuevos, pero NO un vault nuevo. Un vault con capital adentro no se
///         migra.
///
/// @dev    Uso:
///           forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
///         Variables:
///           PRIVATE_KEY    llave del desplegador (será el operador si no se da OPERATOR)
///           OPERATOR       opcional, wallet del operador
///           FEE_RECIPIENT  opcional, tesorería de la plataforma
///           USDT_ADDRESS      opcional; si falta, despliega un MockUSDT
///           VERIFIER_ADDRESS  obligatoria; sale de DeployVerifier.s.sol
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address operator = vm.envOr("OPERATOR", deployer);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address usdt = vm.envOr("USDT_ADDRESS", address(0));

        vm.startBroadcast(pk);

        if (usdt == address(0)) {
            // Sin token real: es una red de prueba. Un mock con faucet abierto
            // para que cualquiera pueda correr la demo sin pedir fondos.
            usdt = address(new MockUSDT());
            console2.log("MockUSDT desplegado (red de prueba)");
        }

        // El verificador ya se desplegó: lo hace `DeployVerifier.s.sol`, que
        // vive aparte porque su `pragma ^0.8.27` no convive con el 0.8.24 de
        // `ProjectVault`. Acá solo se recibe su dirección.
        address verifier = vm.envAddress("VERIFIER_ADDRESS");
        EligibilityRegistry registry = new EligibilityRegistry(verifier, operator);
        ProjectVault vault = new ProjectVault(usdt, operator, feeRecipient);

        // Solo el operador puede conectar el gate. Si el desplegador no lo es,
        // este paso queda pendiente y hay que hacerlo desde la wallet correcta.
        if (deployer == operator) {
            vault.setEligibilityGate(address(registry));
        } else {
            console2.log("ATENCION: setEligibilityGate pendiente, ejecutar desde el operador");
        }

        vm.stopBroadcast();

        _write(block.chainid, address(vault), usdt, address(registry), verifier, operator, feeRecipient);

        console2.log("---------------------------------------------");
        console2.log("chainId            ", block.chainid);
        console2.log("ProjectVault       ", address(vault));
        console2.log("USDT               ", usdt);
        console2.log("EligibilityRegistry", address(registry));
        console2.log("HonkVerifier       ", verifier);
        console2.log("operator           ", operator);
        console2.log("feeRecipient       ", feeRecipient);
        console2.log("---------------------------------------------");
    }

    /// @dev Deja el JSON en `deployments/<chainId>.json`. El backend y el
    ///      frontend lo leen de ahí: nadie copia direcciones a mano, que es
    ///      como se termina apuntando la UI a un vault viejo sin notarlo.
    function _write(
        uint256 chainId,
        address vault,
        address usdt,
        address registry,
        address verifier,
        address operator,
        address feeRecipient
    ) private {
        string memory o = "deployment";
        vm.serializeUint(o, "chainId", chainId);
        vm.serializeAddress(o, "vault", vault);
        vm.serializeAddress(o, "usdt", usdt);
        vm.serializeAddress(o, "eligibility", registry);
        vm.serializeAddress(o, "verifier", verifier);
        vm.serializeAddress(o, "operator", operator);
        vm.serializeUint(o, "blockNumber", block.number);
        string memory json = vm.serializeAddress(o, "feeRecipient", feeRecipient);
        vm.writeJson(json, string.concat("./deployments/", vm.toString(chainId), ".json"));
    }
}
