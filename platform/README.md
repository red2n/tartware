# Platform Bootstrap (Phase 1)

This folder contains the scaffolding for the Phase 1 platform foundation. The goal is to spin up a local Kubernetes cluster that mirrors the production topology as closely as possible while remaining lightweight for development.

## Components

| Layer | Tooling |
|-------|---------|
| Orchestration | kind (dev), k3d (CI) |
| GitOps | Argo CD |
| Service Mesh | Istio Ambient Mesh (beta) |
| Service Discovery | HashiCorp Consul OSS |
| Security | Cert-Manager, External Secrets Operator (ESO), Vault |
| Telemetry | OpenTelemetry Collector, Prometheus, Loki, Tempo, Grafana |
| Messaging | Kafka (Redpanda) + Schema Registry, NATS JetStream |

## Prerequisites

1. Docker Desktop or container runtime that supports Kubernetes-in-Docker.
2. `kind` v0.22+ and `kubectl` v1.30+.
3. `helm` v3.14+ and `helmfile` v0.159+.
4. Access to a local Postgres instance (`127.0.0.1:5432`) for stateful services during bootstrap.

## Quickstart

```bash
# 1. Create the dev cluster
kind create cluster --name tartware-dev --config kind-config.yaml

# 2. Sync platform components
helmfile --environment dev apply

# 3. Verify core namespaces
kubectl get ns istio-system consul argo monitoring messaging security
```

The default environment (`dev`) installs the minimum set of services to start building microservices locally. Additional environments (stage/prod) will be layered later with hardened settings.

## Next Steps

1. Implement `kind-config.yaml` with multi-node topology (1 control plane, 3 workers).
2. Populate `values/` overrides for each component (resource limits, persistence, secrets).
3. Configure External Secrets Operator to pull from Vault (or local dev secret store).
4. Add Argo CD Applications for core microservices once the platform stack is healthy.

Refer to `docs/hybrid-microservices-implementation-plan.md` for the broader roadmap and dependencies.
