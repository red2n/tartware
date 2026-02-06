ARG SERVICE=api-gateway

FROM node:20-alpine AS builder
ARG SERVICE=api-gateway
WORKDIR /app
COPY package.json package-lock.json lerna.json ./
COPY scripts ./scripts
COPY Apps/telemetry/package.json Apps/telemetry/
COPY Apps/config/package.json Apps/config/
COPY Apps/openapi-utils/package.json Apps/openapi-utils/
COPY Apps/outbox/package.json Apps/outbox/
COPY schema/package.json schema/
COPY Apps/${SERVICE}/package.json Apps/${SERVICE}/
RUN npm ci --include=dev
COPY . /app
RUN npm run build --workspace=Apps/telemetry \
	&& npm run build --workspace=Apps/config \
	&& npm run build --workspace=Apps/openapi-utils \
	&& npm run build --workspace=Apps/outbox \
	&& npm run build --workspace=schema \
	&& npm run build --workspace=Apps/${SERVICE} \
	&& npm prune --omit=dev

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
