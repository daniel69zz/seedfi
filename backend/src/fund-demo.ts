// ---------------------------------------------------------------------------
//  Gas para las cuentas de la demo en una red pública
// ---------------------------------------------------------------------------
//
//  En Anvil cada cuenta nace con 10.000 ETH. En HashKey Chain nacen en cero, y
//  sin gas nativo el inversionista no puede ni aprobar USDT. El operador (la
//  llave del backend) recarga cada rol hasta un piso, nunca por encima: correr
//  esto dos veces no gasta el doble.
//
//  El piso por rol sigue lo que firma cada uno en `seed` + `e2e`. Lo caro es
//  `proveEligibility`: verificar una prueba UltraHonk en cadena ronda los 3 M
//  de gas, y los inversionistas A y B prueban dos veces (una por escenario).

import { formatEther, parseEther, type Address } from 'viem';
import { config } from './config.ts';
import { DEMO, type DemoRole } from './demo-accounts.ts';
import { chain, confirm, operatorClient, publicClient } from './chain.ts';

const FLOOR: Partial<Record<DemoRole, string>> = {
  investorA: '0.012',
  investorB: '0.012',
  investorC: '0.006',
  developer: '0.005',
  supervisor: '0.002',
  legal: '0.001',
  investorD: '0.001',
};

async function main() {
  if (config.chainId === 31337) {
    console.log('Anvil ya fondea las cuentas: no hay nada que recargar.');
    return;
  }

  const pub = publicClient();
  const { client, address: operator } = operatorClient();
  const symbol = chain.nativeCurrency.symbol;
  console.log(`\nRecarga de gas en ${chain.name} (${config.rpcUrl})`);
  console.log(`Operador ${operator}: ${formatEther(await pub.getBalance({ address: operator }))} ${symbol}\n`);

  for (const [role, floor] of Object.entries(FLOOR) as [DemoRole, string][]) {
    const address = DEMO[role].address as Address;
    const balance = await pub.getBalance({ address });
    const target = parseEther(floor);
    if (balance >= target) {
      console.log(`  ${role.padEnd(11)} ${address}  ${formatEther(balance)} ${symbol} (ok)`);
      continue;
    }
    const hash = await client.sendTransaction({ account: client.account!, chain: null, to: address, value: target - balance });
    await confirm(hash, `recarga de ${role}`);
    console.log(`  ${role.padEnd(11)} ${address}  +${formatEther(target - balance)} ${symbol}  tx ${hash}`);
  }

  console.log(`\nOperador queda con ${formatEther(await pub.getBalance({ address: operator }))} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
