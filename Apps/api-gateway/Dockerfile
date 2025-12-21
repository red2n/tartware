ARG SERVICE=api-gateway

FROM node:20-alpine AS builder
ARG SERVICE=api-gateway
WORKDIR /app
COPY . /app
RUN npm install \
	&& npm run build --workspace=Apps/telemetry \
	&& npm run build --workspace=Apps/config \
	&& npm run build --workspace=Apps/openapi-utils \
	&& npm run build --workspace=Apps/outbox \
	&& npm run build --workspace=schema \
	&& npm run build --workspace=Apps/${SERVICE} \
	&& npm prune --omit=dev
WORKDIR /app/Apps/${SERVICE}

FROM node:20-alpine AS runtime
ARG SERVICE=api-gateway
WORKDIR /app
ENV SERVICE=${SERVICE}
ENV NODE_ENV=production
ENV NODE_PATH=/app/Apps/$SERVICE/node_modules:/app/node_modules
COPY --from=builder /app/Apps /app/Apps
COPY --from=builder /app/schema /app/schema
COPY --from=builder /app/Apps/${SERVICE}/dist ./dist
COPY --from=builder /app/Apps/${SERVICE}/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/Apps/${SERVICE}/node_modules ./node_modules
EXPOSE 3000
CMD ["sh", "-c", "node dist/Apps/$SERVICE/src/index.js"]
