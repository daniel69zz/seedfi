// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  MockUSDT — stablecoin de prueba para testnet y demo
/// @notice Imita a USDT de verdad, incluyendo su defecto más molesto: `transfer`
///         y `approve` NO devuelven bool. USDT real se desplegó antes de que el
///         ERC-20 se estabilizara y nunca se arregló.
///
///         Es exactamente por eso que sirve como mock: cualquier contrato que
///         integre USDT con una interfaz ERC-20 estándar revierte contra este
///         token, y es mejor descubrirlo en un test que en mainnet con el
///         capital de alguien adentro. `ProjectVault` usa `_safeTransfer`, que
///         tolera el retorno vacío.
///
/// @dev    Solo para redes de prueba. `mint` es abierto a propósito: cualquiera
///         que pruebe la demo necesita fondearse sin pedirle permiso a nadie.
contract MockUSDT {
    string public constant name = "Mock Tether USD";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error SaldoInsuficiente();
    error AsignacionInsuficiente();

    /// @notice Faucet abierto: 10.000 USDT por llamada, para probar la demo.
    function faucet() external {
        _mint(msg.sender, 10_000e6);
    }

    function mint(address to, uint256 value) external {
        _mint(to, value);
    }

    function _mint(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    // Sin `returns (bool)`: así es USDT en mainnet.
    function approve(address spender, uint256 value) external {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
    }

    function transfer(address to, uint256 value) external {
        _transfer(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) external {
        uint256 allowed = allowance[from][msg.sender];
        // `type(uint256).max` como asignación infinita: no se decrementa.
        if (allowed != type(uint256).max) {
            if (allowed < value) revert AsignacionInsuficiente();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
    }

    function _transfer(address from, address to, uint256 value) private {
        uint256 bal = balanceOf[from];
        if (bal < value) revert SaldoInsuficiente();
        unchecked { balanceOf[from] = bal - value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
