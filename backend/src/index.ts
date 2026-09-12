// ---------------------------------------------------------------------------
//  Seed 2 Deed — servidor
// ---------------------------------------------------------------------------
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, loadDeployment } from './config.ts';
import { db } from './db.ts';
import { projectRoutes } from './routes/projects.ts';
import { investorRoutes } from './routes/investors.ts';
import { verificationRoutes } from './routes/verification.ts';
import { startSyncLoop, sync } from './store/indexer.ts';
import { DomainError } from './store/projects.ts';
import { ChainUnavailableError } from './chain.ts';
import { initPoseidon } from '@s2d/zk';

export async function buildServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    // Los montos viajan como string decimal, así que el cuerpo puede ser
    // grande sin ser abusivo. 8 MB cubre una evidencia en base64.
    bodyLimit: 8 * 1024 * 1024,
  });

  await app.register(cors, { origin: config.corsOrigins });

  /**
   * Un único traductor de errores a HTTP.
   *
   * Sin esto, cada ruta termina con su propio try/catch y tarde o temprano
   * alguno deja escapar un stack trace con la ruta del filesystem, o peor,
   * responde 200 con un cuerpo de error. Acá cada clase de error tiene un
   * código y un mensaje que el usuario puede accionar.
   */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({ error: error.message, details: error.details });
    }
    if (error instanceof ChainUnavailableError) {
      return reply.code(503).send({ error: error.message });
    }
    // Un revert de la EVM viene con un `shortMessage` que sí le sirve a quien
    // está del otro lado; el stack de viem, no.
    const viemError = error as { shortMessage?: string; metaMessages?: string[] };
    if (viemError.shortMessage) {
      request.log.warn({ err: error }, 'transaccion rechazada');
      return reply.code(400).send({
        error: viemError.shortMessage,
        details: viemError.metaMessages,
      });
    }
    request.log.error({ err: error }, 'error no manejado');
    return reply.code(500).send({ error: 'Error interno' });
  });

  app.get('/api/health', async () => {
    const deployment = loadDeployment();
    return {
      ok: true,
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      // `deployed: false` no es un fallo: el backend sirve dossiers sin cadena.
      // Lo que no funciona sin cadena está marcado ruta por ruta con un 503.
      deployed: deployment !== null,
      contracts: deployment,
    };
  });

  app.post('/api/sync', async () => sync());

  await app.register(projectRoutes);
  await app.register(investorRoutes);
  await app.register(verificationRoutes);

  return app;
}

async function main() {
  db();            // crea el esquema si falta
  await initPoseidon(); // ~1 s de WASM; mejor pagarlo al arrancar que en la primera request

  const app = await buildServer();
  const stopSync = startSyncLoop();

  const shutdown = async () => {
    stopSync();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: config.host });

  if (!loadDeployment()) {
    app.log.warn(`Sin contratos desplegados en la red ${config.chainId}. Corré:  npm run chain  y  npm run contracts:deploy:local`);
  }
}

// Solo arranca si se ejecuta directo, no cuando lo importa un test.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
