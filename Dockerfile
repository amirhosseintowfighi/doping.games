# Doping: one Next.js server (pages, API, background workers) + PostgreSQL.
#   docker compose up -d          → http://localhost:3000  (see docker-compose.yml and docs/deploy.md)
# The container listens on $PORT (default 3000), so it also fits platforms that assign the port.

FROM node:22-alpine AS deps
WORKDIR /app
# Use a mirror when the build server cannot reach the public npm registry:
#   docker build --build-arg NPM_REGISTRY=https://<mirror>/ .
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# SQL migrations, applied automatically on start.
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT}/api/healthz" || exit 1
CMD ["node", "server.js"]
