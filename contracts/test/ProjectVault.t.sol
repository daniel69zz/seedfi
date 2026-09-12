// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProjectVault} from "../src/ProjectVault.sol";

/// @dev Imita a USDT: 6 decimales y `transfer` que NO devuelve bool.
///      Si el vault usara una interfaz ERC-20 estándar, todo esto revertiría.
contract MockUSDT {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external { balanceOf[to] += v; }
    function approve(address s, uint256 v) external { allowance[msg.sender][s] = v; }

    function transfer(address to, uint256 v) external {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
    }

    function transferFrom(address f, address t, uint256 v) external {
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[t] += v;
    }
}

contract ProjectVaultTest is Test {
    ProjectVault vault;
    MockUSDT usdt;

    uint256 constant PID = 1;
    uint256 constant META = 300_000e6;

    // Truth Works ES el operador: cura, corre KYC y cobra. Intermediario declarado.
    address operador  = makeAddr("truthworks-operador");
    address tesoreria = makeAddr("truthworks-tesoreria");
    address ajeno     = makeAddr("un tercero cualquiera");

    uint16 constant ORIGINACION_BPS = 200;  //  2 % sobre cada tramo liberado
    uint16 constant EXITO_BPS       = 1500; // 15 % sobre el retorno, no sobre el capital
    address builder   = makeAddr("constructora");
    address invA      = makeAddr("inversionistaA"); //  30.000 → 10 %
    address invB      = makeAddr("inversionistaB"); // 120.000 → 40 %
    address invC      = makeAddr("inversionistaC"); // 150.000 → 50 %

    uint256 pkLegal;      address legal;
    uint256 pkSupervisor; address supervisor;
    uint256 pkImpostor;   address impostor;

    function setUp() public {
        (legal, pkLegal)           = makeAddrAndKey("verificadorLegal");
        (supervisor, pkSupervisor) = makeAddrAndKey("supervisorDeObra");
        (impostor, pkImpostor)     = makeAddrAndKey("impostor");

        usdt  = new MockUSDT();
        vault = new ProjectVault(address(usdt), operador, tesoreria);

        ProjectVault.Milestone[] memory ms = new ProjectVault.Milestone[](4);
        ms[0] = _m(2000, ProjectVault.Role.LEGAL,      30 days);  // cierre legal
        ms[1] = _m(3000, ProjectVault.Role.SUPERVISOR, 180 days); // obra gruesa
        ms[2] = _m(3000, ProjectVault.Role.SUPERVISOR, 360 days); // cubierta
        ms[3] = _m(2000, ProjectVault.Role.LEGAL,      540 days); // entrega

        vm.startPrank(operador);
        vault.createProject(PID, builder, META, uint64(block.timestamp + 30 days), ms, ORIGINACION_BPS, EXITO_BPS);
        vault.grantVerifier(PID, legal, ProjectVault.Role.LEGAL);
        vault.grantVerifier(PID, supervisor, ProjectVault.Role.SUPERVISOR);
        vault.setKyc(invA, true);
        vault.setKyc(invB, true);
        vault.setKyc(invC, true);
        vm.stopPrank();

        _invertir(invA, 30_000e6);
        _invertir(invB, 120_000e6);
        _invertir(invC, 150_000e6);
    }

    // =================================================================
    //  MOMENTO 1 DE LA DEMO — la llave que no sirve
    // =================================================================

    /// Truth Works opera la ronda, pero NO puede liberar fondos ni con su propio
    /// privilegio de operador. Esa es la diferencia con un crowdfunding donde el
    /// dinero pasa por la cuenta bancaria de la plataforma.
    function test_momento1_niSiendoElOperadorPuedeLiberarFondos() public {
        ProjectVault.Attestation memory a = _att(0, true);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkImpostor, vault.hashAttestation(a));
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(operador);
        vm.expectRevert(ProjectVault.FirmanteNoAutorizado.selector);
        vault.releaseMilestone(a, sig);

        assertEq(usdt.balanceOf(address(vault)), META, "no salio ni un USDT");
    }

    /// Y tampoco puede esquivarlo designandose verificador a si mismo.
    function test_operadorNoPuedeDesignarseVerificador() public {
        vm.prank(operador);
        vm.expectRevert(ProjectVault.VerificadorNoPuedeSerElOperador.selector);
        vault.grantVerifier(PID, operador, ProjectVault.Role.LEGAL);

        vm.prank(operador);
        vm.expectRevert(ProjectVault.VerificadorNoPuedeSerElOperador.selector);
        vault.grantVerifier(PID, tesoreria, ProjectVault.Role.SUPERVISOR);
    }

    /// Como intermediario, la plataforma responde por quien invierte.
    function test_sinKycNoSePuedeInvertir() public {
        usdt.mint(ajeno, 1_000e6);
        vm.startPrank(ajeno);
        usdt.approve(address(vault), 1_000e6);
        vm.expectRevert(ProjectVault.KycRequerido.selector);
        vault.invest(PID, 1_000e6);
        vm.stopPrank();
    }

    /// El supervisor no puede acreditar un hito que le toca al verificador legal.
    function test_rolEquivocadoNoAcredita() public {
        ProjectVault.Attestation memory a = _att(0, true); // hito 0 = LEGAL
        bytes memory sig = _firmar(pkSupervisor, a); // firmar ANTES del expectRevert
        vm.expectRevert(ProjectVault.FirmanteNoAutorizado.selector);
        vault.releaseMilestone(a, sig);
    }

    // =================================================================
    //  MOMENTO 2 DE LA DEMO — el hito libera SU tramo, no todo
    // =================================================================

    function test_momento2_hitoLiberaSoloSuTramo() public {
        ProjectVault.Attestation memory a = _att(0, true);

        // la envía un tercero cualquiera: la autorización es la firma
        vm.prank(ajeno);
        vault.releaseMilestone(a, _firmar(pkLegal, a));

        // tramo bruto 60.000 = 20 % de 300.000; comision 2 % = 1.200
        assertEq(usdt.balanceOf(builder), 58_800e6, "la constructora recibe el tramo neto");
        assertEq(usdt.balanceOf(tesoreria), 1_200e6, "2% de originacion");
        assertEq(usdt.balanceOf(address(vault)), 240_000e6, "el 80% sigue protegido");
    }

    function test_hitosSeLiberanEnOrdenSinSaltos() public {
        ProjectVault.Attestation memory a = _att(1, true); // saltea el 0
        bytes memory sig = _firmar(pkSupervisor, a);
        vm.expectRevert(ProjectVault.FueraDeOrden.selector);
        vault.releaseMilestone(a, sig);
    }

    function test_reenviarLaMismaAttestationNoLiberaDosVeces() public {
        ProjectVault.Attestation memory a = _att(0, true);
        bytes memory sig = _firmar(pkLegal, a);
        vault.releaseMilestone(a, sig);

        vm.expectRevert(ProjectVault.FueraDeOrden.selector);
        vault.releaseMilestone(a, sig);
    }

    function test_firmaVencidaNoSirve() public {
        ProjectVault.Attestation memory a = _att(0, true);
        bytes memory sig = _firmar(pkLegal, a);
        vm.warp(a.expiresAt + 1);
        vm.expectRevert(ProjectVault.FirmaVencida.selector);
        vault.releaseMilestone(a, sig);
    }

    function test_verificadorPuedeRevocarAntesDeQueSeUse() public {
        ProjectVault.Attestation memory a = _att(0, true);
        bytes memory sig = _firmar(pkLegal, a);

        vm.prank(legal);
        vault.revoke(vault.hashAttestation(a)); // se cayó la garantía

        vm.expectRevert(ProjectVault.FirmaRevocada.selector);
        vault.releaseMilestone(a, sig);
    }

    // =================================================================
    //  MOMENTO 3 DE LA DEMO — el freno
    // =================================================================

    /// Con desembolso único, un incumplimiento en el mes 3 dejaba 300.000
    /// expuestos. Con hitos deja 60.000, y los otros 240.000 vuelven solos.
    function test_momento3_hitoFallidoDevuelveElCapitalNoLiberado() public {
        ProjectVault.Attestation memory ok = _att(0, true);
        vault.releaseMilestone(ok, _firmar(pkLegal, ok));
        assertEq(usdt.balanceOf(builder), 58_800e6);

        // el supervisor va a la obra y el avance no está
        ProjectVault.Attestation memory malo = _att(1, false);
        vault.failMilestone(malo, _firmar(pkSupervisor, malo));

        // cada inversionista retira su parte de lo NO liberado. Sin permiso de nadie.
        vm.prank(invA); vault.refundRemaining(PID);
        vm.prank(invB); vault.refundRemaining(PID);
        vm.prank(invC); vault.refundRemaining(PID);

        assertEq(usdt.balanceOf(invA), 24_000e6, "10% de 240.000");
        assertEq(usdt.balanceOf(invB), 96_000e6, "40% de 240.000");
        assertEq(usdt.balanceOf(invC), 120_000e6, "50% de 240.000");
        assertEq(usdt.balanceOf(address(vault)), 0, "el vault queda vacio");
    }

    /// El freno no necesita que nadie coopere: alcanza con que venza el plazo.
    function test_hitoVencidoLoFrenaCualquiera() public {
        ProjectVault.Attestation memory ok = _att(0, true);
        vault.releaseMilestone(ok, _firmar(pkLegal, ok));

        vm.warp(block.timestamp + 181 days);
        vm.prank(makeAddr("un inversionista cualquiera"));
        vault.expireMilestone(PID);

        vm.prank(invA);
        vault.refundRemaining(PID);
        assertEq(usdt.balanceOf(invA), 24_000e6);
    }

    // =================================================================
    //  RONDA FALLIDA Y REPAGO
    // =================================================================

    /// No hace falta que nadie llame a `closeRound()`.
    function test_refundNoDependeDeQueAlguienCierreLaRonda() public {
        vm.prank(operador);
        vault.createProject(2, builder, META, uint64(block.timestamp + 10 days), _hitoUnico(), ORIGINACION_BPS, EXITO_BPS);

        usdt.mint(invA, 100_000e6);
        vm.startPrank(invA);
        usdt.approve(address(vault), 100_000e6);
        vault.invest(2, 100_000e6); // no llega a la meta
        vm.stopPrank();

        vm.warp(block.timestamp + 11 days);
        vm.prank(invA);
        vault.refund(2);
        assertEq(usdt.balanceOf(invA), 100_000e6, "recupero todo por su cuenta");
    }

    /// El acumulador soporta repagos parciales y sucesivos.
    function test_repagoParcialSeDistribuyeAProrrata() public {
        usdt.mint(builder, 330_000e6);
        vm.startPrank(builder);
        usdt.approve(address(vault), 330_000e6);
        vault.repay(PID, 110_000e6); // primera cuota
        vm.stopPrank();

        assertEq(vault.claimable(PID, invA), 11_000e6, "10% de la cuota");

        vm.prank(invA); vault.claim(PID);
        assertEq(usdt.balanceOf(invA), 11_000e6);

        vm.startPrank(builder);
        vault.repay(PID, 220_000e6); // segunda cuota
        vm.stopPrank();

        // 2da cuota: 190.000 completan capital, 30.000 son retorno.
        // comision 15 % sobre esos 30.000 = 4.500. Los inversionistas parten 325.500.
        assertEq(usdt.balanceOf(tesoreria), 4_500e6, "15% del retorno, 0% del capital");
        assertEq(vault.claimable(PID, invA), 21_550e6, "solo lo nuevo, no lo ya cobrado");
        vm.prank(invA); vault.claim(PID);
        assertEq(usdt.balanceOf(invA), 32_550e6, "10% de 325.500");
    }

    // =================================================================
    //  MODELO DE NEGOCIO — la plataforma cobra del flujo, no del capital
    // =================================================================

    /// Mientras la constructora no devuelva el capital completo, la plataforma
    /// no gana nada. Primero cobra el inversionista.
    function test_comisionDeExitoNoTocaElCapital() public {
        usdt.mint(builder, 300_000e6);
        vm.startPrank(builder);
        usdt.approve(address(vault), 300_000e6);
        vault.repay(PID, 300_000e6); // exactamente el capital, sin retorno
        vm.stopPrank();

        assertEq(usdt.balanceOf(tesoreria), 0, "sin retorno no hay comision");
        assertEq(vault.claimable(PID, invA), 30_000e6, "recupera su capital intacto");
    }

    /// La plataforma no cobra por fracasar, y el freno no le pide permiso.
    function test_elReembolsoNoPagaComision() public {
        ProjectVault.Attestation memory ok = _att(0, true);
        vault.releaseMilestone(ok, _firmar(pkLegal, ok));
        uint256 cobradoHastaAca = usdt.balanceOf(tesoreria);

        ProjectVault.Attestation memory malo = _att(1, false);
        vault.failMilestone(malo, _firmar(pkSupervisor, malo));

        vm.prank(invA); vault.refundRemaining(PID);

        assertEq(usdt.balanceOf(invA), 24_000e6, "100% de su parte no liberada");
        assertEq(usdt.balanceOf(tesoreria), cobradoHastaAca, "ni un centavo mas");
    }

    /// Los topes estan en el bytecode: el operador no puede subirlos.
    function test_comisionTopeadaEnCodigo() public {
        vm.startPrank(operador);
        vm.expectRevert(ProjectVault.ComisionExcesiva.selector);
        vault.createProject(9, builder, META, uint64(block.timestamp + 1 days), _hitoUnico(), 301, 0);

        vm.expectRevert(ProjectVault.ComisionExcesiva.selector);
        vault.createProject(9, builder, META, uint64(block.timestamp + 1 days), _hitoUnico(), 0, 2001);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ helpers
    function _m(uint16 bps, ProjectVault.Role r, uint256 plazo)
        internal view returns (ProjectVault.Milestone memory)
    {
        return ProjectVault.Milestone({
            bps: bps, role: r, deadline: uint64(block.timestamp + plazo), released: false
        });
    }

    function _hitoUnico() internal view returns (ProjectVault.Milestone[] memory ms) {
        ms = new ProjectVault.Milestone[](1);
        ms[0] = _m(10_000, ProjectVault.Role.LEGAL, 30 days);
    }

    function _att(uint8 idx, bool approved)
        internal view returns (ProjectVault.Attestation memory)
    {
        return ProjectVault.Attestation({
            projectId: PID,
            milestoneIndex: idx,
            evidenceHash: keccak256(abi.encodePacked("informe-", idx)),
            approved: approved,
            nonce: idx,
            expiresAt: uint64(block.timestamp + 6 hours) // ventana corta a proposito
        });
    }

    function _firmar(uint256 pk, ProjectVault.Attestation memory a)
        internal view returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, vault.hashAttestation(a));
        return abi.encodePacked(r, s, v);
    }

    function _invertir(address who, uint256 amount) internal {
        usdt.mint(who, amount);
        vm.startPrank(who);
        usdt.approve(address(vault), amount);
        vault.invest(PID, amount);
        vm.stopPrank();
    }
}
