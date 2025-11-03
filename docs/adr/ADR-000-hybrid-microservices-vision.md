# ADR-000 Hybrid Microservices Vision

- **Status:** Accepted
- **Deciders:** Architecture Team
- **Date:** 2025-11-03
- **Tags:** architecture, microservices, hybrid-workloads

## Context

Tartware is transitioning from a monolithic PostgreSQL-centric deployment toward a Kubernetes-first, microservices architecture. The newly published `docs/hybrid-microservices-implementation-plan.md` outlines a phased roadmap, but we require an explicit architectural decision to align engineering, product, and operations teams around the hybrid services strategy.

## Decision

Adopt the hybrid microservices model described in `docs/hybrid-microservices-implementation-plan.md`, using the `schema/` package as the canonical contract layer for every service. All future backend services must:

- Align with domain-driven boundaries (Core, Inventory, Bookings, Financial, Operations, Integrations, Analytics).
- Select lightweight (stateless, request/response) or heavyweight (data/ML/batch) service templates based on workload characteristics.
- Target Kubernetes deployment with GitOps-driven operations, service mesh security, and shared observability.
- Use only open-source tooling listed in the implementation plan, or document exceptions via follow-up ADRs.

## Consequences

- Provides a clear north star for the phased implementation, enabling teams to prioritize platform foundations first.
- Requires investment in platform tooling (Kubernetes, GitOps, telemetry, messaging) before service delivery accelerates.
- Ensures service contracts remain synchronized with the `schema/` package, reducing integration risk.
- Imposes governance overhead (ADRs, plan checkpoints) but improves long-term maintainability and onboarding.

## Alternatives Considered

1. **Monolithic Service Evolution** — Rejected due to scaling limits, slower feature delivery, and poor alignment with multi-tenant requirements.
2. **Single-Pattern Microservices** — Rejected because treating all services identically (e.g., only stateless APIs) fails to accommodate analytics and ML workloads inherent to the roadmap.

## Related Documents

- `docs/hybrid-microservices-implementation-plan.md`
- `docs/SCHEMA_REFERENCE.md`
