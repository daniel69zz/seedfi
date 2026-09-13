# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
#  SeedFi — imágenes de la aplicación
# ---------------------------------------------------------------------------
#  Un solo archivo con tres objetivos, porque comparten casi todo el trabajo:
#
#    --target backend    API Fastify sobre Node          → :4000
#    --target frontend   build de Vite servido por nginx → :8080
#    --target contracts  Foundry + los contratos, para desplegar en Anvil
#
#  Dos cosas viajan DENTRO de la imagen del backend y conviene saber por qué:
#
#    · `circuits/eligibility/target/eligibility.json` — el circuito compilado.
#      El backend se lo sirve al navegador, que es quien genera la prueba. No se
#      compila acá: eso necesita nargo y bb, y el artefacto está versionado.
#
#    · `contracts/deployments/<chainId>.json` — las direcciones. El backend las
#      lee UNA vez al arrancar y las memoiza, así que si se redespliega hay que
#      reiniciarlo. En el compose eso lo resuelve el orden de arranque.
#
#  El backend NO lleva ni Foundry ni el compilador de Solidity: la cadena es un
#  servicio aparte y la API solo habla JSON-RPC con ella.

ARG NODE_VERSION=24-slim
ARG FOUNDRY_VERSION=latest


# ═══════════════════════════════════════════════════════════════════════════
#  Base común: los paquetes compartidos (@s2d/shared, @s2d/zk)
# ═══════════════════════════════════════════════════════════════════════════
#  Backend y frontend los consumen como `file:../packages/*`, o sea symlinks:
#  tienen que estar compilados ANTES de que cualquiera de los dos haga tsc, y
#  tienen que seguir en la misma ruta relativa dentro de la imagen final, o el
#  symlink de node_modules apunta al vacío.

FROM node:${NODE_VERSION} AS packages
ENV npm_config_fund=false \
    npm_config_audit=false \
    npm_config_update_notifier=false
WORKDIR /app

# `bufferutil` y `utf-8-validate` (por debajo de wagmi) y `msgpackr-extract`
# (por debajo de bb.js) son addons nativos: si no hay prebuild para esta
# arquitectura, node-gyp los compila, y sin toolchain el `npm ci` se cae entero.
# Todo esto queda en la etapa de build; la imagen final no lo lleva.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Primero los manifiestos, después el código: así un cambio en un `.ts` no
# vuelve a bajar medio registro de npm.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/zk/package.json packages/zk/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

COPY packages ./packages
RUN npm run build -w @s2d/shared && npm run build -w @s2d/zk


# ═══════════════════════════════════════════════════════════════════════════
#  Backend — compilación
# ═══════════════════════════════════════════════════════════════════════════

FROM packages AS backend-build
COPY backend/package.json backend/package-lock.json backend/
RUN --mount=type=cache,target=/root/.npm cd backend && npm ci

COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
RUN cd backend && npm run build

# tsc y los @types ya cumplieron su función; de acá salen ~30 MB que no tienen
# nada que hacer en una imagen que solo corre `node dist/index.js`.
RUN npm prune --omit=dev --workspaces --include-workspace-root \
 && cd backend && npm prune --omit=dev


# ═══════════════════════════════════════════════════════════════════════════
#  Backend — imagen final
# ═══════════════════════════════════════════════════════════════════════════

FROM node:${NODE_VERSION} AS backend
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    DB_PATH=/app/backend/data/seed2deed.db
WORKDIR /app

# La estructura de directorios se respeta tal cual: `config.ts` calcula la raíz
# del repo como `dist/../..`, y de ahí cuelga todo lo que lee en runtime.
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package.json ./package.json
COPY --from=backend-build /app/packages ./packages
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package.json ./backend/package.json

COPY circuits/eligibility/target ./circuits/eligibility/target
COPY contracts/deployments ./contracts/deployments

# La base y las credenciales de la demo se escriben en runtime. El directorio
# va creado y con dueño desde la imagen: si Docker crea el volumen encima, le
# hereda estos permisos y el proceso —que no corre como root— puede escribir.
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "backend/dist/index.js"]


# ═══════════════════════════════════════════════════════════════════════════
#  Frontend — compilación
# ═══════════════════════════════════════════════════════════════════════════
#  Vite congela las VITE_* en el bundle: la red del frontend se decide ACÁ, en
#  build, no en runtime. Cambiar de cadena es reconstruir la imagen.

FROM packages AS frontend-build
ARG VITE_CHAIN_ID=31337
ARG VITE_RPC_URL=http://127.0.0.1:8545
# Vacío a propósito: el bundle pega a `/api` en el mismo origen y nginx lo
# reenvía al backend. Sin eso, la respuesta sería de otro origen y la COEP de
# abajo la bloquearía por falta de CORP.
ARG VITE_API_URL=
ENV VITE_CHAIN_ID=${VITE_CHAIN_ID} \
    VITE_RPC_URL=${VITE_RPC_URL} \
    VITE_API_URL=${VITE_API_URL}

COPY frontend/package.json frontend/package-lock.json frontend/
RUN --mount=type=cache,target=/root/.npm cd frontend && npm ci

COPY frontend frontend
RUN cd frontend && npm run build


# ═══════════════════════════════════════════════════════════════════════════
#  Frontend — imagen final
# ═══════════════════════════════════════════════════════════════════════════

FROM nginx:1.27-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1


# ═══════════════════════════════════════════════════════════════════════════
#  Contratos — Foundry, para Anvil y para desplegar
# ═══════════════════════════════════════════════════════════════════════════
#  `forge build` acá adentro cumple dos funciones: valida que los contratos
#  compilan cuando se construye la imagen (y no a mitad de una demo), y deja la
#  caché lista para que el despliegue del compose tarde segundos.

FROM ghcr.io/foundry-rs/foundry:${FOUNDRY_VERSION} AS contracts
USER root
WORKDIR /repo/contracts

COPY contracts/foundry.toml contracts/foundry.lock ./
COPY contracts/lib ./lib
# forge-std entra como submódulo git. Sin `--recursive` en el clone, esto falla
# acá con un mensaje claro en vez de con 200 líneas de solc.
RUN test -f lib/forge-std/src/Script.sol || { \
      echo "Falta contracts/lib/forge-std. Corré:  git submodule update --init --recursive" >&2; \
      exit 1; \
    }

COPY contracts/src ./src
COPY contracts/script ./script
COPY contracts/deployments ./deployments
RUN forge build

COPY docker/deploy.sh /usr/local/bin/deploy.sh
ENTRYPOINT ["/bin/sh"]
CMD ["/usr/local/bin/deploy.sh"]
