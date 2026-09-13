// ---------------------------------------------------------------------------
//  API de inversionistas, KYC y credenciales
// ---------------------------------------------------------------------------
import type { FastifyInstance } from 'fastify';
import type { Address } from 'viem';
import { readFileSync } from 'node:fs';
import {
  upsertInvestor, getInvestorByAddress, listInvestors, setKycStatus,
  issueCredential, revokeCredential, listCredentials, issuerRoot, merklePathFor,
} from '../store/investors.ts';
import { CONFIRMATIONS, deployment, operatorClient, publicClient, projectVaultAbi, eligibilityRegistryAbi } from '../chain.ts';
import { config } from '../config.ts';

export async function investorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/investors', async () => ({ investors: listInvestors() }));

  app.get('/api/investors/:address', async (request, reply) => {
    const { address } = request.params as { address: string };
    const investor = getInvestorByAddress(address);
    if (!investor) return reply.code(404).send({ error: 'Inversionista no registrado' });
    return { investor, credentials: listCredentials(investor.id) };
  });

  app.post('/api/investors', async (request, reply) => {
    const body = request.body as { address: string; displayName: string; email: string };
    return reply.code(201).send({ investor: upsertInvestor(body) });
  });

  /**
   * Aprueba el tamizaje AML y lo escribe en el vault.
   *
   * Esto es lo que la plataforma AFIRMA sobre una wallet. Es distinto de lo que
   * el inversionista PRUEBA con el circuito ZK, y son dos condiciones separadas
   * justamente porque la primera depende de la buena fe del operador y la
   * segunda no depende de nadie.
   */
  app.post('/api/investors/:address/kyc', async (request, reply) => {
    const { address } = request.params as { address: string };
    const { approved } = request.body as { approved: boolean };

    const investor = getInvestorByAddress(address);
    if (!investor) return reply.code(404).send({ error: 'Inversionista no registrado' });

    const { client } = operatorClient();
    const hash = await client.writeContract({
      address: deployment().vault as Address, abi: projectVaultAbi, functionName: 'setKyc',
      args: [investor.address as Address, approved],
      chain: null, account: client.account!,
    });
    await publicClient().waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });

    return {
      investor: setKycStatus(investor.address, approved ? 'APPROVED' : 'REJECTED', new Date().toISOString()),
      txHash: hash,
    };
  });

  // ------------------------------------------------------------ credenciales

  /**
   * Emite la credencial KYC verificable.
   *
   * `secret` vuelve UNA sola vez en esta respuesta y no queda guardado en
   * ningún lado del servidor. Quien lo pierda necesita una credencial nueva:
   * es el precio de que un backend comprometido no pueda suplantar a nadie.
   */
  app.post('/api/investors/:address/credential', async (request, reply) => {
    const { address } = request.params as { address: string };
    const body = request.body as { jurisdiction: number; netWorth: string; expiresAt: number };

    const investor = getInvestorByAddress(address);
    if (!investor) return reply.code(404).send({ error: 'Inversionista no registrado' });

    const { credential, secret } = issueCredential({
      investorId: investor.id,
      jurisdiction: body.jurisdiction,
      netWorth: BigInt(body.netWorth),
      expiresAt: body.expiresAt,
    });

    return reply.code(201).send({
      credential,
      secret,
      issuerRoot: issuerRoot(),
      aviso: 'Guardá `secret` ahora: el servidor no lo almacena y no hay forma de recuperarlo.',
    });
  });

  app.delete('/api/credentials/:id', async (request) => {
    const { id } = request.params as { id: string };
    revokeCredential(id);
    return { revoked: id, issuerRoot: issuerRoot() };
  });

  /** Raíz vigente del emisor. Es lo que las rondas fijan como política. */
  app.get('/api/issuer/root', async () => ({ root: issuerRoot(), credentials: listCredentials().length }));

  /** Camino de Merkle de una hoja, para armar la prueba en el dispositivo. */
  app.get('/api/issuer/path/:leaf', async (request) => {
    const { leaf } = request.params as { leaf: string };
    return merklePathFor(leaf);
  });

  /**
   * Publica la raíz vigente como política de una ronda.
   *
   * Republicar la raíz es también el mecanismo de revocación: una credencial
   * que salió del árbol ya no puede generar pruebas nuevas.
   */
  app.post('/api/issuer/publish/:onChainId', async (request) => {
    const { onChainId } = request.params as { onChainId: string };
    const { minNetWorth, jurisdiction } = request.body as { minNetWorth: string; jurisdiction: number };

    const { client } = operatorClient();
    const hash = await client.writeContract({
      address: deployment().eligibility as Address, abi: eligibilityRegistryAbi, functionName: 'setPolicy',
      args: [BigInt(onChainId), issuerRoot() as `0x${string}`, BigInt(minNetWorth), BigInt(jurisdiction)],
      chain: null, account: client.account!,
    });
    await publicClient().waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
    return { txHash: hash, root: issuerRoot() };
  });

  // ---------------------------------------------------------------- circuito

  /**
   * Sirve el circuito compilado al navegador.
   *
   * Va por acá y no como asset estático del frontend para que el artefacto
   * servido sea SIEMPRE el mismo con el que se generó el verificador
   * desplegado. Un `eligibility.json` viejo en el bundle produce pruebas
   * válidas que el contrato rechaza, y ese es un síntoma horrible de depurar.
   */
  app.get('/api/circuit/eligibility', async (_request, reply) => {
    try {
      return JSON.parse(readFileSync(config.circuitPath, 'utf8'));
    } catch {
      return reply.code(503).send({
        error: 'El circuito no está compilado. Corré:  npm run circuit:build',
      });
    }
  });
}
