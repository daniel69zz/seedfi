// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EligibilityRegistry} from "../src/EligibilityRegistry.sol";
import {ProjectVault} from "../src/ProjectVault.sol";
import {MockUSDT} from "../src/mocks/MockUSDT.sol";

/// @dev Verificador de banco de pruebas. Acá NO se testea la criptografía —de
///      eso responde el UltraHonk generado, y su corrección se verifica contra
///      una prueba real en el e2e de Node—. Lo que se testea acá es todo lo que
///      rodea a la prueba, que es donde de verdad se cuelan los agujeros: atar
///      los inputs públicos a la política, atar la wallet al remitente, acotar
///      el reloj y quemar el nullifier.
contract StubVerifier {
    bool public shouldPass = true;

    function setShouldPass(bool v) external { shouldPass = v; }

    function verify(bytes calldata, bytes32[] calldata) external view returns (bool) {
        return shouldPass;
    }
}

contract EligibilityRegistryTest is Test {
    EligibilityRegistry registry;
    StubVerifier stub;

    address operador = makeAddr("operador");
    address inversionista = makeAddr("inversionista");
    address otro = makeAddr("otro");

    uint256 constant PID = 1;
    bytes32 constant ROOT = bytes32(uint256(0xABCDEF));
    uint256 constant MIN_NET_WORTH = 100_000;
    uint256 constant BOLIVIA = 68;

    function setUp() public {
        stub = new StubVerifier();
        registry = new EligibilityRegistry(address(stub), operador);
        vm.warp(1_750_000_000);
        vm.prank(operador);
        registry.setPolicy(PID, ROOT, MIN_NET_WORTH, BOLIVIA);
    }

    /// Arma los 7 inputs públicos en el orden exacto que declara `main` en Noir.
    function _inputs(
        bytes32 root,
        uint256 projectId,
        address investor,
        uint256 minNetWorth,
        uint256 jurisdiction,
        uint256 provenAt,
        bytes32 nullifier
    ) internal pure returns (bytes32[] memory pi) {
        pi = new bytes32[](7);
        pi[0] = root;
        pi[1] = bytes32(projectId);
        pi[2] = bytes32(uint256(uint160(investor)));
        pi[3] = bytes32(minNetWorth);
        pi[4] = bytes32(jurisdiction);
        pi[5] = bytes32(provenAt);
        pi[6] = nullifier;
    }

    function _ok(address investor, bytes32 nullifier) internal view returns (bytes32[] memory) {
        return _inputs(ROOT, PID, investor, MIN_NET_WORTH, BOLIVIA, block.timestamp, nullifier);
    }

    // =====================================================================

    function test_pruebaValidaHaceElegible() public {
        bytes32 nul = keccak256("nullifier-1");
        vm.prank(inversionista);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, nul));

        assertTrue(registry.isEligible(PID, inversionista));
        assertTrue(registry.nullifierUsado(nul));
        assertEq(registry.nullifierDe(PID, inversionista), nul);
    }

    /// LA garantía del contrato: no existe camino por el que el operador marque
    /// a alguien como elegible. Su única potestad es QUITARLA.
    ///
    /// El operador puede fijar la política, cambiar la raíz, revocar a quien
    /// quiera — y aun así, parado frente a la misma puerta que todos, sin una
    /// prueba válida no entra ni él.
    function test_elOperadorNoPuedeFabricarElegibilidad() public {
        stub.setShouldPass(false);

        vm.prank(operador);
        vm.expectRevert(EligibilityRegistry.PruebaInvalida.selector);
        registry.proveEligibility(PID, hex"00", _ok(operador, keccak256("x")));

        assertFalse(registry.isEligible(PID, operador));

        // Y tampoco puede ablandarse la política para sí mismo: bajar el umbral
        // cambia la política para TODOS y queda en el log. No hay puerta lateral.
        vm.prank(operador);
        registry.setPolicy(PID, ROOT, 0, BOLIVIA);
        vm.prank(operador);
        vm.expectRevert(EligibilityRegistry.PruebaInvalida.selector);
        registry.proveEligibility(PID, hex"00", _inputs(ROOT, PID, operador, 0, BOLIVIA, block.timestamp, keccak256("x")));
    }

    function test_pruebaInvalidaNoPasa() public {
        stub.setShouldPass(false);
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.PruebaInvalida.selector);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, keccak256("n")));
    }

    /// Sin este check, el prover elige `min_net_worth = 0` y prueba una
    /// trivialidad perfectamente válida contra un umbral que él mismo puso.
    function test_umbralRebajadoPorElProverNoPasa() public {
        bytes32[] memory pi = _inputs(ROOT, PID, inversionista, 1, BOLIVIA, block.timestamp, keccak256("n"));
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.ParametrosNoCoinciden.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    function test_jurisdiccionCambiadaPorElProverNoPasa() public {
        bytes32[] memory pi = _inputs(ROOT, PID, inversionista, MIN_NET_WORTH, 32, block.timestamp, keccak256("n"));
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.ParametrosNoCoinciden.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    /// Credencial de un emisor distinto (o de una raíz ya revocada).
    function test_raizAjenaNoPasa() public {
        bytes32[] memory pi =
            _inputs(bytes32(uint256(0xDEAD)), PID, inversionista, MIN_NET_WORTH, BOLIVIA, block.timestamp, keccak256("n"));
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.RaizNoCoincide.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    /// Prueba copiada del mempool y reenviada por otro: el circuito ata la
    /// wallet al nullifier, y el registro la ata además a `msg.sender`.
    function test_pruebaRobadaDelMempoolNoSirve() public {
        bytes32[] memory pi = _ok(inversionista, keccak256("n"));
        vm.prank(otro);
        vm.expectRevert(EligibilityRegistry.WalletNoCoincide.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    /// Una credencial, una entrada por ronda. Sin esto, el dueño de una sola
    /// credencial entra con diez wallets y el tope por inversionista es papel.
    function test_mismaCredencialNoEntraDosVecesConOtraWallet() public {
        bytes32 nul = keccak256("nullifier-unico");
        vm.prank(inversionista);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, nul));

        vm.prank(otro);
        vm.expectRevert(EligibilityRegistry.NullifierYaUsado.selector);
        registry.proveEligibility(PID, hex"00", _ok(otro, nul));
    }

    /// El `now` lo elige el prover. Sin acotarlo, "en 2020 yo era elegible"
    /// alcanza para entrar hoy con una credencial vencida hace años.
    function test_pruebaViejaNoSirve() public {
        uint256 hace1Hora = block.timestamp - 1 hours;
        bytes32[] memory pi =
            _inputs(ROOT, PID, inversionista, MIN_NET_WORTH, BOLIVIA, hace1Hora, keccak256("n"));
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.PruebaVencida.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    function test_pruebaConRelojAdelantadoNoSirve() public {
        uint256 enUnaHora = block.timestamp + 1 hours;
        bytes32[] memory pi =
            _inputs(ROOT, PID, inversionista, MIN_NET_WORTH, BOLIVIA, enUnaHora, keccak256("n"));
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.PruebaDelFuturo.selector);
        registry.proveEligibility(PID, hex"00", pi);
    }

    function test_proyectoSinPoliticaRechaza() public {
        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.PoliticaNoConfigurada.selector);
        registry.proveEligibility(99, hex"00", _ok(inversionista, keccak256("n")));
    }

    /// Revocar es una obligación regulatoria (una wallet sancionada), pero no
    /// puede devolver el nullifier: sería un intento extra regalado.
    function test_revocarNoDevuelveElNullifier() public {
        bytes32 nul = keccak256("nullifier-1");
        vm.prank(inversionista);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, nul));

        vm.prank(operador);
        registry.revokeEligibility(PID, inversionista, "lista de sanciones");
        assertFalse(registry.isEligible(PID, inversionista));

        vm.prank(inversionista);
        vm.expectRevert(EligibilityRegistry.NullifierYaUsado.selector);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, nul));
    }

    function test_soloElOperadorFijaPolitica() public {
        vm.prank(otro);
        vm.expectRevert(EligibilityRegistry.NoAutorizado.selector);
        registry.setPolicy(PID, ROOT, 1, 68);
    }

    // =====================================================================
    //  Integración con el vault
    // =====================================================================

    /// El KYC del operador y la prueba ZK son DOS condiciones, no una. Tener
    /// una sola de las dos no alcanza para invertir.
    function test_vaultExigeKycYPruebaZk() public {
        MockUSDT usdt = new MockUSDT();
        ProjectVault vault = new ProjectVault(address(usdt), operador, makeAddr("tesoreria"));

        ProjectVault.Milestone[] memory ms = new ProjectVault.Milestone[](1);
        ms[0] = ProjectVault.Milestone({
            bps: 10_000,
            role: ProjectVault.Role.LEGAL,
            deadline: uint64(block.timestamp + 90 days),
            released: false
        });

        vm.startPrank(operador);
        vault.createProject(PID, makeAddr("constructora"), 100_000e6, uint64(block.timestamp + 30 days), ms, 200, 1500);
        vault.setEligibilityGate(address(registry));
        vault.setKyc(inversionista, true);
        vm.stopPrank();

        usdt.mint(inversionista, 50_000e6);
        vm.prank(inversionista);
        usdt.approve(address(vault), type(uint256).max);

        // KYC sí, prueba ZK no: no entra.
        vm.prank(inversionista);
        vm.expectRevert(ProjectVault.ElegibilidadRequerida.selector);
        vault.invest(PID, 50_000e6);

        // Con la prueba registrada, entra.
        vm.prank(inversionista);
        registry.proveEligibility(PID, hex"00", _ok(inversionista, keccak256("n")));
        vm.prank(inversionista);
        vault.invest(PID, 50_000e6);
        assertEq(vault.invested(PID, inversionista), 50_000e6);

        // Y al revés: prueba ZK sí, KYC no, tampoco entra.
        vm.prank(otro);
        registry.proveEligibility(PID, hex"00", _ok(otro, keccak256("n2")));
        usdt.mint(otro, 10_000e6);
        vm.prank(otro);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(otro);
        vm.expectRevert(ProjectVault.KycRequerido.selector);
        vault.invest(PID, 10_000e6);
    }
}
