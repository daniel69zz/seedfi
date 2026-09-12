// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IEligibilityVerifier} from "./IEligibilityVerifier.sol";

/// @title  EligibilityRegistry — elegibilidad probada, no declarada  (backlog T5)
///
/// @notice Este contrato resuelve una tensión que parecía irreconciliable.
///
///         Seed 2 Deed es un intermediario y tiene que responder por quién entra
///         a una ronda: jurisdicción admitida, patrimonio suficiente, credencial
///         KYC vigente y no revocada. Demostrar eso a la manera habitual exige
///         que alguien —la plataforma, el contrato, el explorador de bloques—
///         vea el CI, el domicilio y el patrimonio del inversionista. En una
///         cadena pública eso es indefendible, y en varias jurisdicciones,
///         directamente ilegal.
///
///         Acá el inversionista presenta una prueba de conocimiento cero
///         generada en su propio dispositivo. El contrato aprende un bit:
///         cumple o no cumple. El patrimonio exacto, la identidad y hasta CUÁL
///         de las credenciales vigentes es la suya quedan del otro lado.
///
///         Lo que hace que esto no sea teatro es que el operador tampoco puede
///         fabricar elegibilidad: no hay una función que marque a una wallet
///         como elegible a dedo. La única entrada es `proveEligibility`, y esa
///         puerta la abre la matemática del verificador, no un permiso.
///
/// @dev    El circuito vive en `circuits/eligibility`. El verificador es el
///         UltraHonk que genera barretenberg a partir de él: si el circuito
///         cambia, el verificador cambia y hay que desplegar uno nuevo.
contract EligibilityRegistry {
    // ---------------------------------------------------------------- errores
    error NoAutorizado();
    error PoliticaNoConfigurada();
    error PruebaInvalida();
    error NullifierYaUsado();
    error WalletNoCoincide();
    error PruebaVencida();
    error PruebaDelFuturo();
    error RaizNoCoincide();
    error ParametrosNoCoinciden();
    error YaElegible();

    // ------------------------------------------------------------------ tipos

    /// @notice Condiciones de entrada a una ronda. Las fija el operador ANTES
    ///         de abrir el proyecto y quedan públicas: el inversionista sabe
    ///         contra qué se lo está midiendo.
    struct Policy {
        bytes32 credentialRoot;      // raíz del árbol de credenciales del emisor KYC
        uint256 minNetWorth;         // patrimonio mínimo exigido
        uint256 allowedJurisdiction; // ISO-3166 numérico. Bolivia = 68
        bool    configured;
    }

    // ------------------------------------------------------------- constantes

    /// @dev El circuito compara la credencial contra un `now` que elige EL
    ///      PROVER. Si el contrato no acotara ese valor, bastaría con probar
    ///      "en enero de 2020 yo era elegible" para entrar hoy con una
    ///      credencial vencida hace años. La ventana cierra ese agujero.
    uint64 public constant MAX_ANTIGUEDAD_PRUEBA = 30 minutes;

    /// @dev Hacia adelante se tolera muy poco: un `now` futuro solo endurece la
    ///      condición de vencimiento, pero un reloj corrido no debería pasar.
    uint64 public constant TOLERANCIA_FUTURO = 5 minutes;

    /// @dev Orden de los inputs públicos, tal cual los declara `main` en el
    ///      circuito. Si alguien reordena la firma de `main` y no toca esto, el
    ///      registro compara la jurisdicción contra el patrimonio y acepta
    ///      cualquier cosa. Van nombrados para que el error salte al leerlo.
    uint256 private constant PI_CREDENTIAL_ROOT = 0;
    uint256 private constant PI_PROJECT_ID = 1;
    uint256 private constant PI_INVESTOR = 2;
    uint256 private constant PI_MIN_NET_WORTH = 3;
    uint256 private constant PI_JURISDICTION = 4;
    uint256 private constant PI_NOW = 5;
    uint256 private constant PI_NULLIFIER = 6;
    uint256 private constant PI_COUNT = 7;

    // --------------------------------------------------------------- storage

    IEligibilityVerifier public immutable verifier;
    address public operator;

    mapping(uint256 => Policy) public policies;

    /// @notice Un nullifier por (credencial, proyecto). Quemarlo impide que la
    ///         misma persona entre dos veces a la misma ronda con dos wallets
    ///         para saltarse el tope por inversionista.
    ///
    ///         Entre proyectos distintos NO son correlacionables: derivan del
    ///         secreto y del projectId, así que sin el secreto nadie puede
    ///         atar el nullifier del proyecto 1 con el del proyecto 2.
    mapping(bytes32 => bool) public nullifierUsado;

    mapping(uint256 => mapping(address => bool)) public elegible;
    mapping(uint256 => mapping(address => bytes32)) public nullifierDe;

    // ---------------------------------------------------------------- eventos
    event PolicySet(uint256 indexed projectId, bytes32 credentialRoot, uint256 minNetWorth, uint256 jurisdiction);
    event EligibilityProven(uint256 indexed projectId, address indexed investor, bytes32 nullifier);
    event EligibilityRevoked(uint256 indexed projectId, address indexed investor, string reason);
    event OperatorChanged(address indexed previous, address indexed next);

    constructor(address _verifier, address _operator) {
        verifier = IEligibilityVerifier(_verifier);
        operator = _operator;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NoAutorizado();
        _;
    }

    // =====================================================================
    //  POLÍTICA
    // =====================================================================

    /// @notice Fija o actualiza las condiciones de entrada de una ronda.
    /// @dev    Cambiar `credentialRoot` es también el mecanismo de revocación
    ///         del emisor: sacar una hoja del árbol y republicar la raíz deja
    ///         sin efecto toda prueba futura de esa credencial. Las pruebas ya
    ///         registradas NO se caen —se hicieron contra una raíz que en su
    ///         momento era válida—; para esas está `revokeEligibility`.
    function setPolicy(
        uint256 projectId,
        bytes32 credentialRoot,
        uint256 minNetWorth,
        uint256 allowedJurisdiction
    ) external onlyOperator {
        policies[projectId] = Policy({
            credentialRoot: credentialRoot,
            minNetWorth: minNetWorth,
            allowedJurisdiction: allowedJurisdiction,
            configured: true
        });
        emit PolicySet(projectId, credentialRoot, minNetWorth, allowedJurisdiction);
    }

    function setOperator(address next) external onlyOperator {
        emit OperatorChanged(operator, next);
        operator = next;
    }

    /// @notice Baja de elegibilidad por obligación regulatoria sobrevenida
    ///         (una wallet que aparece en una lista de sanciones, por ejemplo).
    /// @dev    El nullifier NO se devuelve: sigue quemado. Revocar no puede ser
    ///         una forma de conseguirse un intento extra.
    function revokeEligibility(uint256 projectId, address investor, string calldata reason) external onlyOperator {
        elegible[projectId][investor] = false;
        emit EligibilityRevoked(projectId, investor, reason);
    }

    // =====================================================================
    //  PRUEBA
    // =====================================================================

    /// @notice Registra la elegibilidad de `msg.sender` para una ronda.
    ///
    /// @dev    Por qué cada verificación de acá importa:
    ///
    ///         - la prueba en sí solo dice "existe una credencial que cumple".
    ///           Sin atar los inputs públicos a la política del proyecto, el
    ///           prover elegiría `min_net_worth = 0` y probaría una trivialidad;
    ///         - sin atar `investor` a `msg.sender`, cualquiera que vea la
    ///           prueba en el mempool la copia y se registra con ella;
    ///         - sin quemar el nullifier, una credencial entra tantas veces
    ///           como wallets tenga su dueño.
    ///
    ///         La prueba se verifica al final, después de los checks baratos:
    ///         `verify` cuesta cientos de miles de gas y no tiene sentido
    ///         pagarlos para después rechazar por una wallet que no coincide.
    function proveEligibility(
        uint256 projectId,
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external {
        Policy memory p = policies[projectId];
        if (!p.configured) revert PoliticaNoConfigurada();
        if (publicInputs.length != PI_COUNT) revert ParametrosNoCoinciden();

        if (publicInputs[PI_CREDENTIAL_ROOT] != p.credentialRoot) revert RaizNoCoincide();
        if (uint256(publicInputs[PI_PROJECT_ID]) != projectId) revert ParametrosNoCoinciden();
        if (uint256(publicInputs[PI_MIN_NET_WORTH]) != p.minNetWorth) revert ParametrosNoCoinciden();
        if (uint256(publicInputs[PI_JURISDICTION]) != p.allowedJurisdiction) revert ParametrosNoCoinciden();

        if (uint256(publicInputs[PI_INVESTOR]) != uint256(uint160(msg.sender))) revert WalletNoCoincide();

        uint256 provenAt = uint256(publicInputs[PI_NOW]);
        if (provenAt > block.timestamp + TOLERANCIA_FUTURO) revert PruebaDelFuturo();
        if (provenAt + MAX_ANTIGUEDAD_PRUEBA < block.timestamp) revert PruebaVencida();

        bytes32 nullifier = publicInputs[PI_NULLIFIER];
        if (nullifierUsado[nullifier]) revert NullifierYaUsado();
        if (elegible[projectId][msg.sender]) revert YaElegible();

        if (!verifier.verify(proof, publicInputs)) revert PruebaInvalida();

        nullifierUsado[nullifier] = true;
        elegible[projectId][msg.sender] = true;
        nullifierDe[projectId][msg.sender] = nullifier;

        emit EligibilityProven(projectId, msg.sender, nullifier);
    }

    // =====================================================================
    //  LECTURA
    // =====================================================================

    /// @notice Lo que consulta `ProjectVault` antes de aceptar una inversión.
    function isEligible(uint256 projectId, address investor) external view returns (bool) {
        return elegible[projectId][investor];
    }

    function policyOf(uint256 projectId) external view returns (Policy memory) {
        return policies[projectId];
    }
}
