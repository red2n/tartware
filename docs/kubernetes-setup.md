# Kubernetes Environment Setup

Step-by-step instructions for replicating the Tartware dev cluster on a fresh
machine using only open-source tooling (Kind, Helmfile, Argo CD, Rancher).
Use this when onboarding a new environment or rebuilding your local lab.

## 1. Prerequisites

- Docker 27+ with at least 4 CPUs, 12 GiB RAM, and 40 GiB free disk.
- `kubectl`, `helm`, `helmfile`, and `kind` placed on your `$PATH`.
  ```bash
  mkdir -p ~/.local/bin
  curl -fsSL https://dl.k8s.io/release/$(curl -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl -o ~/.local/bin/kubectl
  curl -fsSL https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64 -o ~/.local/bin/kind
  curl -fsSL https://get.helm.sh/helm-v3.16.1-linux-amd64.tar.gz | tar -xz --strip-components=1 linux-amd64/helm -C ~/.local/bin
  curl -fsSL https://github.com/helmfile/helmfile/releases/download/v0.167.0/helmfile_0.167.0_linux_amd64.tar.gz \
    | tar -xz -C ~/.local/bin helmfile
  chmod +x ~/.local/bin/{kubectl,kind,helm,helmfile}
  ```
- GNU `bash`, `curl`, and `tar` (standard on most Linux distros).

## 2. Create the Kind Cluster

```bash
cd platform
kind create cluster --config kind-config.yaml
```

This spins up `tartware-dev` (1 control plane + 3 workers) with the required
API-server flags for service-account tokens.

## 3. Install Cilium CNI

Kind disables CNI by default in this config. Install Cilium so Pods get IPs:

```bash
helm repo add cilium https://helm.cilium.io && helm repo update
helm upgrade --install cilium cilium/cilium \
  --namespace kube-system \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' tartware-dev-control-plane) \
  --set k8sServicePort=6443
kubectl -n kube-system wait --for=condition=Ready pods --all --timeout=180s
```

## 4. Deploy the Platform Stack

From `platform/`, run:

```bash
helmfile --environment dev sync
```

This installs cert-manager, Vault, External Secrets, Istio (control plane only),
observability (OTel collector, Tempo, Loki, kube-prometheus-stack), messaging
(NATS JetStream, Redpanda), cache (Redis), analytics (ClickHouse), and GitOps
primitives (Argo CD, Argo Rollouts). Chart versions are pinned in
`platform/helmfile.yaml`.

### Troubleshooting

- **ImagePullBackOff for Bitnami charts**: since Aug 2025 Bitnami gates images.
  Mirror images to your registry and override `image.repository/tag` via the
  corresponding `platform/values/dev/*.yaml` files or temporarily disable the
  release in `helmfile.yaml`.
- **Vault pod pending**: initialize manually when ready:
  `kubectl -n security exec -it vault-0 -- vault operator init`.
- **Istio CNI clashes**: the Helmfile no longer installs Istio CNI because
  Cilium supplies networking. If you re-enable it, disable the Cilium DaemonSet.

## 5. GitOps & UI Access

- **Argo CD** (`scripts/port-forward-argo.sh`)  
  ```bash
  scripts/port-forward-argo.sh
  kubectl -n argo get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
  ```
  Visit https://localhost:8080 and log in as `admin`.

- **Rancher** (`scripts/port-forward-rancher.sh`)  
  ```bash
  helm repo add rancher-latest https://releases.rancher.com/server-charts/latest
  helm upgrade --install rancher rancher-latest/rancher \
    --namespace cattle-system --create-namespace \
    --set hostname=rancher.127.0.0.1.sslip.io \
    --set bootstrapPassword=Changeme!123 --set replicas=1
  ```
  Then run:
  ```bash
  scripts/port-forward-rancher.sh
  ```
  Open https://localhost:8443 and log in with `admin / Changeme!123`. Import the
  Kind cluster via Rancher’s UI if desired.

- **Argo ApplicationSet**  
  The repo ships with `platform/argo/applications/tartware-services.yaml`.
  Apply it once Argo CD is up to register the core Helm charts:
  `kubectl apply -f platform/argo/applications/tartware-services.yaml`.

## 6. CI/CD via GitHub Actions

- Workflow: `.github/workflows/ci-cd.yml`
  - Runs lint/biome/knip/tests on every push/PR.
  - Builds and pushes Docker images for each backend service on pushes to
    `main` or `feature/k8s-ready-tooling` using the Dockerfiles under
    `Apps/*/Dockerfile`.
- Configure registry namespace:
  - Set a repository variable named `GHCR_NAMESPACE` (Settings → Secrets and
    variables → Actions → Variables) with the organization/user that owns your
    GHCR images. If unset, the workflow falls back to `github.repository_owner`.
  - Update the Helm values (`platform/charts/*/values*.yaml`) so
    `image.repository` points at the same namespace the workflow uses.
- The workflow uses `GITHUB_TOKEN` for authentication, so no extra PAT is
  required as long as the repo owner has permission to publish to that GHCR
  namespace.

## 6. Customizing for a New ENV

1. Copy `platform/values/dev` to `platform/values/<env>` and adjust image tags,
   resources, or disabled releases as needed.
2. Add a new entry under `environments` in `platform/helmfile.yaml` pointing to
   the new values file.
3. Run `helmfile --environment <env> sync`.
4. Update `docs/kubernetes.md` or this README with environment-specific notes.

## 7. Cleanup

```bash
kind delete cluster --name tartware-dev
```

This removes all workload containers and frees local Docker resources.
