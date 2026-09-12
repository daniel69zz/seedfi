// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Interfaz del verificador UltraHonk que genera barretenberg desde el
///         circuito Noir (`circuits/eligibility`).
///
/// @dev    Se declara acá, con otro nombre que el `IVerifier` del archivo
///         generado, para no acoplar el registro a ese artefacto: son 2.500
///         líneas de aritmética de curva que se regeneran enteras cada vez que
///         alguien toca una línea del circuito. El registro habla contra una
///         dirección; qué hay detrás es problema del despliegue.
interface IEligibilityVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
