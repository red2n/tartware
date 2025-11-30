# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.11.0
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /workspace
RUN apk add --no-cache python3 make g++
COPY . .
RUN npm ci
RUN npm run build --workspace=Apps/reservations-command-service
RUN npm prune --omit=dev

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=builder /workspace /workspace
EXPOSE 3101
CMD ["node", "Apps/reservations-command-service/dist/index.js"]
