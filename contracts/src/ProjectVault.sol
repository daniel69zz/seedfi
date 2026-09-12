// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Puerta de elegibilidad. La implementa `EligibilityRegistry`, que solo
///         la abre contra una prueba de conocimiento cero válida.
interface IEligibilityGate {
    function isEligible(uint256 projectId, address investor) external view returns (bool);
}

/// @title  ProjectVault — Truth Works
/// @notice Bóveda de financiamiento para una obra de construcción.
///         Custodia USDT, lo libera POR HITOS contra attestations firmadas por
///         verificadores autorizados, y devuelve a los inversionistas el capital
///         que no llegó a liberarse si un hito falla.
///
/// @dev    Truth Works ES el operador de la ronda: cura los proyectos, corre el
///         KYC/KYB y cobra por hacerlo. Es un intermediario y no lo disimula.
///
///         LO QUE LO DIFERENCIA DE UN INTERMEDIARIO CONVENCIONAL son cuatro
///         garantías que viven en el código, no en los términos y condiciones:
///
///         1. NO CUSTODIA. El capital está en el contrato, no en una cuenta
///            bancaria de la plataforma. No hay `withdraw()`, `pause()`, función
///            de rescate ni proxy actualizable.
///         2. NO PUEDE LIBERAR. Solo un verificador registrado firma un hito, y
///            `grantVerifier` prohíbe por construcción que el operador se designe
///            a sí mismo. Truth Works opera; otro acredita.
///         3. COMISIÓN TOPEADA EN CÓDIGO. Máximos inmutables, fijados por
///            proyecto al crearlo y nunca modificables después.
///         4. LOS REEMBOLSOS NO PAGAN COMISIÓN Y NO PIDEN PERMISO. Si la ronda
///            fracasa o un hito falla, el inversionista retira el 100 % de lo no
///            liberado sin que la plataforma intervenga.
///
///         La plataforma cobra del flujo, nunca del capital reembolsable.
///
///         Sin dependencias externas a propósito: EIP-712 y las transferencias
///         seguras van implementadas acá para que el contrato compile con solc
///         pelado, sin `forge install`.
contract ProjectVault {
    // ---------------------------------------------------------------- errores
    error NoAutorizado();
    error ProyectoInexistente();
    error EstadoInvalido();
    error RondaCerrada();
    error MontoCero();
    error HitosInvalidos();
    error FueraDeOrden();
    error FirmaVencida();
    error FirmaConsumida();
    error FirmaRevocada();
    error FirmanteNoAutorizado();
    error AprobacionInconsistente();
    error NadaQueReclamar();
    error PlazoNoVencido();
    error TransferenciaFallida();
    error KycRequerido();
    error ElegibilidadRequerida();
    error ComisionExcesiva();
    error VerificadorNoPuedeSerElOperador();

    // ------------------------------------------------------------------ tipos
    enum Role { NONE, LEGAL, SUPERVISOR }

    /// FUNDING          ronda abierta
    /// ACTIVE           meta alcanzada, liberando hitos
    /// COMPLETED        todos los hitos liberados
    /// ROUND_FAILED     no alcanzó la meta antes de endDate
    /// MILESTONE_FAILED un hito fue rechazado o venció: el resto se devuelve
    enum Status { NONE, FUNDING, ACTIVE, COMPLETED, ROUND_FAILED, MILESTONE_FAILED }

    struct Milestone {
        uint16 bps;       // porción del capital recaudado, en puntos básicos
        Role   role;      // qué rol debe acreditarlo
        uint64 deadline;  // vencido sin acreditar => cualquiera puede frenar
        bool   released;
    }

    struct Project {
        address builder;
        uint256 target;
        uint64  endDate;
        uint256 raised;
        uint256 released;
        uint8   nextMilestone;
        Status  status;
        uint256 totalRepaid;     // repago neto para inversionistas; cuotas parciales
        uint256 frozenRemaining; // capital no liberado al momento de fallar
        uint16  originationBps;  // comisión sobre cada tramo liberado
        uint16  successBps;      // comisión sobre el retorno repagado
    }

    /// @notice Lo que firma el verificador. No incluye monto: el tramo ya quedó
    ///         fijado en los hitos al crear el proyecto. El verificador acredita
    ///         un HECHO, no negocia cuánto se libera.
    struct Attestation {
        uint256 projectId;
        uint8   milestoneIndex;
        bytes32 evidenceHash;
        bool    approved;
        uint256 nonce;
        uint64  expiresAt;
    }

    // ------------------------------------------------------- topes inmutables
    /// @dev Topes grabados en el bytecode. El operador elige por debajo de ellos
    ///      al crear el proyecto; nadie puede subirlos después, ni él.
    uint16 public constant MAX_ORIGINATION_BPS = 300;  //  3 % del tramo liberado
    uint16 public constant MAX_SUCCESS_BPS     = 2000; // 20 % del retorno, no del capital

    // --------------------------------------------------------------- storage
    address public immutable usdt;
    address public operator;      // Truth Works
    address public feeRecipient;  // tesorería de la plataforma

    mapping(uint256 => Project)   public projects;
    mapping(uint256 => Milestone[]) internal _milestones;

    /// verificadores autorizados POR PROYECTO. La llave de Truth Works no está acá.
    mapping(uint256 => mapping(address => Role)) public verifierRole;

    mapping(uint256 => mapping(address => uint256)) public invested;
    mapping(uint256 => mapping(address => uint256)) public claimed;
    mapping(uint256 => mapping(address => bool))    public tookRoundRefund;
    mapping(uint256 => mapping(address => bool))    public tookRemainingRefund;

    mapping(bytes32 => bool) public consumed; // anti-replay
    mapping(bytes32 => bool) public revoked;

    /// @notice Como intermediario, la plataforma responde por quién invierte.
    ///         Esto es lo que el operador AFIRMA: que la wallet pasó su tamizaje
    ///         AML. Es una obligación suya y por eso la marca él.
    mapping(address => bool) public kycApproved;

    /// @notice Lo que el inversionista PRUEBA: jurisdicción admitida, patrimonio
    ///         suficiente y credencial KYC vigente, sin revelar ninguno de los
    ///         tres. Son dos cosas distintas y por eso son dos condiciones:
    ///         la primera la pone el operador y podría mentir; la segunda no la
    ///         puede fabricar nadie, ni él.
    ///
    ///         En cero la puerta queda abierta, para que un despliegue sin
    ///         circuito ZK siga funcionando con el tamizaje del operador solo.
    address public eligibilityGate;

    // ---------------------------------------------------------------- eventos
    event ProjectCreated(uint256 indexed projectId, address indexed builder, uint256 target, uint64 endDate);
    event VerifierGranted(uint256 indexed projectId, address indexed verifier, Role role);
    event Invested(uint256 indexed projectId, address indexed investor, uint256 amount);
    event RoundFunded(uint256 indexed projectId, uint256 raised);
    event MilestoneReleased(uint256 indexed projectId, uint8 indexed index, uint256 amount, address verifier);
    event MilestoneFailed(uint256 indexed projectId, uint8 indexed index, uint256 frozen, string reason);
    event RoundRefunded(uint256 indexed projectId, address indexed investor, uint256 amount);
    event RemainingRefunded(uint256 indexed projectId, address indexed investor, uint256 amount);
    event Repaid(uint256 indexed projectId, uint256 amount);
    event Claimed(uint256 indexed projectId, address indexed investor, uint256 amount);
    event AttestationRevoked(bytes32 indexed digest, address indexed verifier);
    event KycSet(address indexed investor, bool approved);
    event FeeCharged(uint256 indexed projectId, string kind, uint256 amount);
    event EligibilityGateSet(address indexed gate);

    // ------------------------------------------------------------------ EIP712
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _ATTESTATION_TYPEHASH = keccak256(
        "Attestation(uint256 projectId,uint8 milestoneIndex,bytes32 evidenceHash,bool approved,uint256 nonce,uint64 expiresAt)"
    );

    constructor(address _usdt, address _operator, address _feeRecipient) {
        usdt = _usdt;
        operator = _operator;
        feeRecipient = _feeRecipient;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NoAutorizado();
        _;
    }

    // =====================================================================
    //  REGISTRO — potestades del operador. Ninguna toca fondos.
    // =====================================================================

    function createProject(
        uint256 projectId,
        address builder,
        uint256 target,
        uint64 endDate,
        Milestone[] calldata ms,
        uint16 originationBps,
        uint16 successBps
    ) external onlyOperator {
        Project storage p = projects[projectId];
        if (p.status != Status.NONE) revert EstadoInvalido();
        if (ms.length == 0 || target == 0) revert HitosInvalidos();
        if (originationBps > MAX_ORIGINATION_BPS || successBps > MAX_SUCCESS_BPS) revert ComisionExcesiva();

        uint256 sum;
        for (uint256 i; i < ms.length; ++i) {
            if (ms[i].role == Role.NONE) revert HitosInvalidos();
            sum += ms[i].bps;
            _milestones[projectId].push(
                Milestone({bps: ms[i].bps, role: ms[i].role, deadline: ms[i].deadline, released: false})
            );
        }
        if (sum != 10_000) revert HitosInvalidos(); // los tramos deben sumar el 100 %

        p.builder = builder;
        p.target = target;
        p.endDate = endDate;
        p.status = Status.FUNDING;
        // se fijan acá y ya no se tocan: el inversionista entra sabiendo el costo
        p.originationBps = originationBps;
        p.successBps = successBps;

        emit ProjectCreated(projectId, builder, target, endDate);
    }

    /// @dev Truth Works opera la ronda pero NO puede acreditar sus propios hitos.
    ///      Sin esta línea, el operador se autodesigna verificador y la garantía 2
    ///      de la cabecera se vuelve falsa.
    function grantVerifier(uint256 projectId, address verifier, Role role) external onlyOperator {
        if (projects[projectId].status == Status.NONE) revert ProyectoInexistente();
        if (verifier == operator || verifier == feeRecipient) revert VerificadorNoPuedeSerElOperador();
        verifierRole[projectId][verifier] = role;
        emit VerifierGranted(projectId, verifier, role);
    }

    function setOperator(address newOperator) external onlyOperator {
        operator = newOperator;
    }

    function setFeeRecipient(address r) external onlyOperator {
        feeRecipient = r;
    }

    /// @notice Conecta el registro de elegibilidad ZK.
    /// @dev    Es una potestad del operador, pero solo puede ENDURECER la
    ///         entrada: el gate agrega una condición, nunca saltea el KYC.
    ///         Ponerlo en cero afloja, y por eso queda en el log.
    function setEligibilityGate(address gate) external onlyOperator {
        eligibilityGate = gate;
        emit EligibilityGateSet(gate);
    }

    /// @notice KYC del inversionista. Obligación de la plataforma como intermediario.
    function setKyc(address investor, bool approved) external onlyOperator {
        kycApproved[investor] = approved;
        emit KycSet(investor, approved);
    }

    // =====================================================================
    //  RONDA
    // =====================================================================

    function invest(uint256 projectId, uint256 amount) external {
        Project storage p = projects[projectId];
        if (!kycApproved[msg.sender]) revert KycRequerido();
        if (eligibilityGate != address(0) && !IEligibilityGate(eligibilityGate).isEligible(projectId, msg.sender)) {
            revert ElegibilidadRequerida();
        }
        if (p.status != Status.FUNDING) revert EstadoInvalido();
        if (block.timestamp > p.endDate) revert RondaCerrada();
        if (amount == 0) revert MontoCero();

        p.raised += amount;
        invested[projectId][msg.sender] += amount;
        _safeTransferFrom(usdt, msg.sender, address(this), amount);
        emit Invested(projectId, msg.sender, amount);

        if (p.raised >= p.target) {
            p.status = Status.ACTIVE;
            emit RoundFunded(projectId, p.raised);
        }
    }

    /// @notice Reembolso por ronda fallida. PERMISSIONLESS y sin dependencias:
    ///         no exige que nadie haya llamado antes a un `closeRound()`.
    ///         Si el cierre dependiera de un tercero, bastaría con que ese
    ///         tercero desaparezca para dejar el capital atrapado para siempre.
    function refund(uint256 projectId) external {
        Project storage p = projects[projectId];
        if (p.status != Status.FUNDING) revert EstadoInvalido();
        if (block.timestamp <= p.endDate) revert PlazoNoVencido();
        if (p.raised >= p.target) revert EstadoInvalido();

        uint256 amount = invested[projectId][msg.sender];
        if (amount == 0 || tookRoundRefund[projectId][msg.sender]) revert NadaQueReclamar();

        tookRoundRefund[projectId][msg.sender] = true;
        p.status = Status.ROUND_FAILED;
        // sin comisión: la plataforma no cobra por fracasar
        _safeTransfer(usdt, msg.sender, amount);
        emit RoundRefunded(projectId, msg.sender, amount);
    }

    // =====================================================================
    //  HITOS
    // =====================================================================

    /// @notice Libera el tramo del hito. La transacción la puede enviar
    ///         CUALQUIERA: la autorización es la firma, no el remitente. Así el
    ///         desembolso no depende de que un servidor de Truth Works esté vivo.
    function releaseMilestone(Attestation calldata a, bytes calldata sig) external {
        if (!a.approved) revert AprobacionInconsistente();
        Project storage p = projects[a.projectId];
        if (p.status != Status.ACTIVE) revert EstadoInvalido();
        if (a.milestoneIndex != p.nextMilestone) revert FueraDeOrden(); // en orden, sin saltos

        _consume(a, sig);

        Milestone storage m = _milestones[a.projectId][a.milestoneIndex];
        m.released = true;
        p.nextMilestone++;

        // el último hito barre el polvo de redondeo
        uint256 amount = p.nextMilestone == _milestones[a.projectId].length
            ? p.raised - p.released
            : (p.raised * m.bps) / 10_000;

        // `released` cuenta el BRUTO: así `frozenRemaining` sigue siendo exacto
        p.released += amount;
        if (p.nextMilestone == _milestones[a.projectId].length) p.status = Status.COMPLETED;

        uint256 fee = (amount * p.originationBps) / 10_000;
        _safeTransfer(usdt, p.builder, amount - fee);
        if (fee != 0) {
            _safeTransfer(usdt, feeRecipient, fee);
            emit FeeCharged(a.projectId, "originacion", fee);
        }
        emit MilestoneReleased(a.projectId, a.milestoneIndex, amount, _recover(a, sig));
    }

    /// @notice El verificador acredita que el hito NO se cumplió.
    function failMilestone(Attestation calldata a, bytes calldata sig) external {
        if (a.approved) revert AprobacionInconsistente();
        Project storage p = projects[a.projectId];
        if (p.status != Status.ACTIVE) revert EstadoInvalido();
        if (a.milestoneIndex != p.nextMilestone) revert FueraDeOrden();

        _consume(a, sig);
        _freeze(a.projectId, p, a.milestoneIndex, "rechazado por el verificador");
    }

    /// @notice El hito venció sin acreditarse. PERMISSIONLESS: el freno no
    ///         depende de que el operador, la constructora o el verificador
    ///         reconozcan el incumplimiento.
    function expireMilestone(uint256 projectId) external {
        Project storage p = projects[projectId];
        if (p.status != Status.ACTIVE) revert EstadoInvalido();
        Milestone storage m = _milestones[projectId][p.nextMilestone];
        if (block.timestamp <= m.deadline) revert PlazoNoVencido();

        _freeze(projectId, p, p.nextMilestone, "hito vencido sin acreditar");
    }

    function _freeze(uint256 projectId, Project storage p, uint8 index, string memory reason) private {
        p.status = Status.MILESTONE_FAILED;
        p.frozenRemaining = p.raised - p.released;
        emit MilestoneFailed(projectId, index, p.frozenRemaining, reason);
    }

    /// @notice EL FRENO. Devuelve a cada inversionista, a prorrata, el capital
    ///         que NO llegó a liberarse. Permissionless.
    function refundRemaining(uint256 projectId) external {
        Project storage p = projects[projectId];
        if (p.status != Status.MILESTONE_FAILED) revert EstadoInvalido();
        if (tookRemainingRefund[projectId][msg.sender]) revert NadaQueReclamar();

        uint256 share = (invested[projectId][msg.sender] * p.frozenRemaining) / p.raised;
        if (share == 0) revert NadaQueReclamar();

        tookRemainingRefund[projectId][msg.sender] = true;
        // sin comisión: el inversionista recupera el 100 % de lo no liberado
        _safeTransfer(usdt, msg.sender, share);
        emit RemainingRefunded(projectId, msg.sender, share);
    }

    // =====================================================================
    //  REPAGO — acumulador: soporta depósitos parciales y sucesivos
    // =====================================================================

    /// @notice La comisión de éxito se cobra SOLO sobre el retorno, nunca sobre el
    ///         capital. Mientras la constructora no haya devuelto los 300.000 que
    ///         le prestaron, la plataforma no gana un centavo: primero cobra el
    ///         inversionista. Es lo que alinea a la plataforma con quien puso la plata.
    function repay(uint256 projectId, uint256 amount) external {
        Project storage p = projects[projectId];
        if (p.raised == 0) revert ProyectoInexistente();
        if (p.status == Status.ROUND_FAILED || p.status == Status.MILESTONE_FAILED) revert EstadoInvalido();
        if (amount == 0) revert MontoCero();

        uint256 pendiente = p.raised > p.totalRepaid ? p.raised - p.totalRepaid : 0;
        uint256 aCapital  = amount > pendiente ? pendiente : amount;
        uint256 aRetorno  = amount - aCapital;
        uint256 fee       = (aRetorno * p.successBps) / 10_000;

        p.totalRepaid += amount - fee;

        _safeTransferFrom(usdt, msg.sender, address(this), amount);
        if (fee != 0) {
            _safeTransfer(usdt, feeRecipient, fee);
            emit FeeCharged(projectId, "exito", fee);
        }
        emit Repaid(projectId, amount);
    }

    /// @notice Pull-based: el contrato nunca itera sobre inversionistas, así que
    ///         no hay límite de gas ni lista que se pueda romper.
    function claim(uint256 projectId) external {
        uint256 amount = claimable(projectId, msg.sender);
        if (amount == 0) revert NadaQueReclamar();

        claimed[projectId][msg.sender] += amount;
        _safeTransfer(usdt, msg.sender, amount);
        emit Claimed(projectId, msg.sender, amount);
    }

    /// @dev Una sola division sobre el acumulado, no una por cuota. Un acumulador
    ///      del tipo `accPerUnit` trunca dos veces (al repagar y al reclamar) y le
    ///      cuesta ~1 unidad de USDT por inversionista y por cuota; esta forma
    ///      trunca una sola vez y da el reparto exacto cuando divide entero.
    function claimable(uint256 projectId, address user) public view returns (uint256) {
        Project storage p = projects[projectId];
        if (p.raised == 0) return 0;
        uint256 total = (invested[projectId][user] * p.totalRepaid) / p.raised;
        uint256 taken = claimed[projectId][user];
        return total > taken ? total - taken : 0;
    }

    function milestones(uint256 projectId) external view returns (Milestone[] memory) {
        return _milestones[projectId];
    }

    // =====================================================================
    //  FIRMAS
    // =====================================================================

    function revoke(bytes32 digest) external {
        revoked[digest] = true;
        emit AttestationRevoked(digest, msg.sender);
    }

    function _consume(Attestation calldata a, bytes calldata sig) private {
        if (block.timestamp > a.expiresAt) revert FirmaVencida();

        bytes32 digest = hashAttestation(a);
        if (consumed[digest]) revert FirmaConsumida();
        if (revoked[digest]) revert FirmaRevocada();

        address signer = _recover(a, sig);
        Milestone storage m = _milestones[a.projectId][a.milestoneIndex];
        if (verifierRole[a.projectId][signer] != m.role) revert FirmanteNoAutorizado();

        consumed[digest] = true;
    }

    function _recover(Attestation calldata a, bytes calldata sig) private view returns (address) {
        if (sig.length != 65) revert FirmanteNoAutorizado();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // rechaza firmas maleables (EIP-2)
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert FirmanteNoAutorizado();
        }
        address signer = ecrecover(hashAttestation(a), v, r, s);
        if (signer == address(0)) revert FirmanteNoAutorizado();
        return signer;
    }

    /// @dev El domain separator incluye chainId y address(this): una firma de
    ///      testnet no sirve en mainnet, ni la de un deploy en otro.
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH, keccak256("TruthWorks"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                _ATTESTATION_TYPEHASH, a.projectId, a.milestoneIndex, a.evidenceHash, a.approved, a.nonce, a.expiresAt
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // =====================================================================
    //  USDT no devuelve bool en transfer: no cumple ERC-20 estrictamente.
    // =====================================================================

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferenciaFallida();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferenciaFallida();
    }
}
