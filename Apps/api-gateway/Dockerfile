ARG SERVICE=api-gateway

FROM node:20-alpine AS builder
ARG SERVICE=api-gateway
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc nx.json ./
COPY scripts ./scripts
COPY Apps/telemetry/package.json Apps/telemetry/
COPY Apps/config/package.json Apps/config/
COPY Apps/openapi-utils/package.json Apps/openapi-utils/
COPY Apps/outbox/package.json Apps/outbox/
COPY Apps/fastify-server/package.json Apps/fastify-server/
COPY Apps/command-center-shared/package.json Apps/command-center-shared/
COPY Apps/tenant-auth/package.json Apps/tenant-auth/
COPY Apps/command-consumer-utils/package.json Apps/command-consumer-utils/
COPY schema/package.json schema/
COPY Apps/${SERVICE}/package.json Apps/${SERVICE}/
COPY . /app
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tartware/telemetry run build \
	&& pnpm --filter @tartware/config run build \
	&& pnpm --filter @tartware/openapi run build \
	&& pnpm --filter @tartware/outbox run build \
	&& pnpm --filter @tartware/schemas run build \
	&& pnpm --filter @tartware/${SERVICE} run build \
	&& pnpm prune --prod

FROM node:20-alpine AS runtime
ARG SERVICE=api-gateway
WORKDIR /app
ENV SERVICE=${SERVICE}
ENV NODE_ENV=production
# Copy the full monorepo structure to preserve workspace references
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/Apps ./Apps
COPY --from=builder /app/schema ./schema
WORKDIR /app/Apps/${SERVICE}
EXPOSE 3000
CMD ["sh", "-c", "node dist/Apps/${SERVICE}/src/index.js"]
