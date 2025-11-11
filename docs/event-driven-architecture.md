# Event-Driven Microservice Architecture

This document summarises the new write-path design for Tartware PMS.

## Components

- **API Gateway (`@tartware/api-gateway`)**  
  - Single public entry point.  
  - Enforces rate limiting (`@fastify/rate-limit`) and forwards requests to downstream services.  
  - All read traffic (`GET /v1/**`) is routed to the read-optimised Core Service.  
  - All write traffic (`POST/PUT/PATCH/DELETE`) for reservations is routed to the command service.

- **Reservations Command Service (`@tartware/reservations-command-service`)**  
  - Accepts write requests, validates payloads, and publishes domain events to Kafka.  
  - Owns the reservation write model and produces `reservation.created|updated|cancelled` events.  
  - Consumes the same topics to materialise the read model in PostgreSQL (eventual consistency).

- **Core Service (`@tartware/core-service`)**  
  - Optimised for query workloads; exposes read APIs only.  
  - Continues to source data from PostgreSQL which is continuously updated by event consumers.

- **Kafka**  
  - Bitnami Kafka/Zookeeper stack added to `docker-compose.yml`.  
  - Topics are partitioned (default 12) to support horizontal scaling to 100K ops/sec.

## Event Contract

Reservation events are defined in `schema/src/events/reservations.ts` and shared across services via the `@tartware/schemas` package. Each event contains:

- Envelope metadata (id, source, tenantId, correlationId, timestamp).  
- A payload aligned with the reservation domain schema.  
- Versioning to allow future evolution without breaking consumers.

## Scaling Considerations

- Services are stateless and can be replicated behind the gateway.  
- Consumer groups allow Kafka workloads to scale horizontally.  
- Gateway rate limits default to 200 req/min per key/IP and can be tuned via environment variables.  
- New services can subscribe to the same topics to build additional read models or integrations.

## Local Development

1. Run `docker-compose up kafka zookeeper postgres redis`.  
2. `npm run dev --workspace=@tartware/api-gateway`  
3. `npm run dev --workspace=@tartware/core-service` (read service)  
4. `npm run dev --workspace=@tartware/reservations-command-service` (write path)  
5. UI continues targeting the gateway at `http://localhost:8080/v1`.

The architecture is now ready for additional microservices (finance, housekeeping, analytics, marketing, and enterprise APIs) following the same event-driven pattern.
