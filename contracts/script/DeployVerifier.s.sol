// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HonkVerifier} from "../src/verifiers/EligibilityVerifier.sol";

/// @title  DeployVerifier — despliega el verificador UltraHonk
///
/// @notice Está en un script aparte por una razón de compilador, no de gusto:
///         el verificador que genera barretenberg exige `^0.8.27` y
///         `ProjectVault` está clavado en `0.8.24` —lo que se auditó es ese
///         bytecode—. Dos pragmas incompatibles no conviven en una misma unidad
///         de compilación, así que el despliegue va en dos pasos y
///         `scripts/deploy-local.sh` los encadena.
///
///         Queda de paso una separación que igual queríamos: cambiar el
///         circuito obliga a desplegar un verificador nuevo, pero NO un vault
///         nuevo. Un vault con capital adentro no se migra.
contract DeployVerifier is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        HonkVerifier verifier = new HonkVerifier();
        vm.stopBroadcast();

        console2.log("HonkVerifier", address(verifier));

        string memory o = "verifier";
        vm.serializeUint(o, "chainId", block.chainid);
        string memory json = vm.serializeAddress(o, "verifier", address(verifier));
        vm.writeJson(json, string.concat("./deployments/verifier-", vm.toString(block.chainid), ".json"));
    }
}
