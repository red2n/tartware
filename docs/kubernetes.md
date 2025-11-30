# Kubernetes Deployment Playbook

This guide turns the Tartware stack into a Kubernetes-first, fully open-source
deployment that can sustain roughly 20k operations per second for premium
clients. It leans on GitOps so even novice operators can promote changes
confidently.

## Toolchain Overview

- **Helmfile** (`platform/helmfile.yaml`) bootstraps cluster primitives:
  cert-manager, Vault, Istio, observability, messaging, and now the Argo stack.
- **Argo CD** provides declarative, Git-backed application lifecycle management
  with RBAC, audit trails, and SSO hooks.
- **Argo Rollouts** adds progressive delivery (blue/green + canary) so you can
  soak-test releases before exposing all tenants.
- **Helm/Kustomize manifests per service** live under `platform/charts/**`
  (scaffolding in progress) and are registered in Argo as Applications.

All components are CNCF or Apache-2.0 licensed—no proprietary dependencies.

## Bootstrap Steps

1. Provision a managed Kubernetes control plane sized for 20k ops/s:
   - 3× control-plane nodes (or managed masters) + at least 6 worker nodes with
     autoscaling enabled.
   - Enable cloud-integrated load balancers and block storage.
2. Install cluster prerequisites from this repo:
   ```bash
   # Set KUBECONFIG to your cluster, then:
   cd platform
   helmfile --environment dev sync
   ```
   This deploys cert-manager, Vault, Istio, telemetry, and Argo CD/Rollouts into
   dedicated namespaces with sane defaults for multi-tenant traffic.
3. Port-forward or expose the Argo CD server (`argo` namespace) and login:
   ```bash
   kubectl port-forward svc/argo-cd-argocd-server -n argo 8080:443
   argocd login localhost:8080 --username admin --password <initial-secret>
   ```
4. Register the Git repository (this branch) inside Argo CD so Application
   manifests can be synced automatically.

## GitOps Flow

1. Each service gets a Helm chart under `platform/charts/<service>`.
2. An Argo `Application` (or `ApplicationSet`) describes how to render that chart
   for each environment (dev → staging → prod). Production Apps should enable
   Argo Rollouts by default.
3. Changes land via PR → merge into `feature/k8s-ready-tooling` (or mainline).
   Argo detects the commit and syncs the manifests, providing a full audit trail.
4. Use Rollout objects (instead of plain Deployments) to define canaries with
   Prometheus or Kayenta analysis hooks. Built-in traffic shifting integrates
   with Istio, which Helmfile already provisions.

## Reference Manifests

- `platform/charts/{api-gateway,core-service,logs-service,reservations-command-service,settings-service}`:
  Argo Rollout-enabled Helm charts for every Node/TypeScript service in the repo.
- `platform/charts/*/values-prod.yaml`: opinionated overrides for high-throughput
  clients (replicas, resources, env vars, canary settings).
- `platform/argo/applications/tartware-services.yaml`: the Argo ApplicationSet
  that registers all service charts from Git. Update `repoURL`/`valueFile` entries
  to match your remote and environment overlays.

## Production-Grade Settings

- **High throughput:** configure HPA targets (CPU + custom metrics from
  Prometheus) and cluster autoscaler policies to maintain headroom >30%.
- **Security:** enforce namespace isolation per tenant-facing surface, leverage
  External Secrets + Vault for creds, and restrict Argo accounts with SSO/RBAC.
- **Observability:** OTEL Collector, Prometheus, Loki, and Tempo are deployed via
  Helmfile; hook Rollout metric analysis into the same Prometheus instance.
- **Disaster recovery:** enable Argo CD application backups (e.g., Velero) and
  store Helm value overrides in Git so clusters are reproducible.

## Next Steps

1. Wire GitHub Actions to build/push service images and update Helm values.
2. Add automated Rollout analysis templates (Prometheus queries) to guard
   against regressions before a release reaches all tenants.
3. Promote the `prod` Helmfile environment once dedicated clusters are ready.

Follow these steps to onboard the platform to Kubernetes using only open-source
components while keeping operations predictable for high-value clients.
