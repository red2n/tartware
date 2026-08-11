# Zero-Trust Networking & Mutual TLS

How the Tartware backend enforces two properties:

1. **`api-gateway` is the only way in.** No other service is reachable from
   outside the cluster, and no other service is reachable from *inside* the
   cluster except by the gateway.
2. **Every service-to-service hop is mutually authenticated.** Both peers
   present and verify an X.509 certificate, and the caller's identity is
   checked against an allowlist before the request is served.

---

## What was actually in place before

Istio was installed by `platform/helmfile.yaml` and `platform/README.md`
claimed "✅ mTLS between services (Istio)". That claim was not true, for five
independent reasons. They are recorded here because each one fails *silently* —
nothing errors, policies just stop applying.

| # | Problem | Consequence |
|---|---------|-------------|
| 1 | No `PeerAuthentication` resource existed | Istio's default is **PERMISSIVE**: sidecars accept plaintext alongside mTLS. Installing Istio makes mTLS *available*, never mandatory. |
| 2 | No `AuthorizationPolicy` existed | Any pod in the mesh could call any service directly, skipping every check the gateway performs. |
| 3 | `network-policies.yaml` selected `tier: domain-service` and `app: api-gateway` — labels the Helm chart never applied | Every NetworkPolicy matched **zero pods**. The file enforced nothing. |
| 4 | `base-config.yaml` defined `tartware-allow-internal` with egress `to: [namespaceSelector: {}]` | NetworkPolicy rules are additive, so this single rule permitted egress to every namespace and overrode any stricter policy. Its ingress half selected a `name:` label no namespace carries, so it matched nothing. |
| 5 | No ingress gateway was installed; `api-gateway` was fronted by an nginx `Ingress` | nginx forwards from a pod with no mesh identity, so that hop could never be mTLS. |

A sixth issue lived in application code — see [Header trust](#header-trust).

---

## The request path

```
                    ┌──────────────────────────────────────────────┐
   internet ──TLS──▶│ istio-ingressgateway        (istio-system)   │
                    │ LoadBalancer — the only external address     │
                    └───────────────────┬──────────────────────────┘
                                        │ mTLS
                                        │ principal: .../sa/istio-ingressgateway
                    ┌───────────────────▼──────────────────────────┐
                    │ api-gateway                 (tartware-system)│
                    │ ClusterIP — authn, rate limit, tenant scope  │
                    └───────────────────┬──────────────────────────┘
                                        │ mTLS
                                        │ principal: .../sa/api-gateway
        ┌───────────────┬───────────────┼───────────────┬──────────────┐
        ▼               ▼               ▼               ▼              ▼
   core-service   guests-service   rooms-service   billing-service   ...
   (tier: domain-service — inbound restricted to the gateway principal)
                                        │
                          reservations-command-service
                                        │ mTLS, port 4400 only
                                        ▼
                          availability-guard-service
```

Every arrow is mTLS. Identity comes from the caller's Kubernetes
ServiceAccount, which Istio turns into a SPIFFE ID:

```
spiffe://cluster.local/ns/<namespace>/sa/<serviceaccount>
```

That identity is carried in the client certificate, so — unlike a header, a
source IP, or a shared secret — it cannot be forged by the caller.

---

## The five enforcement layers

Each layer is independently sufficient to block the attack it targets. They
overlap on purpose: the common failure mode for mesh security is a workload
quietly losing its sidecar, which removes layers 1–3 at once and leaves only
4 and 5.

### 1. Transport — `platform/kubernetes/istio/peer-authentication.yaml`

Mesh-wide `PeerAuthentication` in **STRICT** mode. A plaintext connection to
any sidecar is dropped at the transport layer, before application code runs.

The ingress gateway's public ports (8080/8443/15021) are pinned to PERMISSIVE
because external clients hold no mesh certificate. Public TLS is terminated
there by the `Gateway` resource, and the next hop is mTLS again.

### 2. Client side — `platform/kubernetes/istio/destination-rules.yaml`

`DestinationRule` with `ISTIO_MUTUAL`, so callers always present their own
certificate rather than opportunistically falling back.

Scoped to `*.tartware-system.svc.cluster.local`, **not** `*`. Postgres, Redis,
Redpanda and the observability stack run in namespaces without injection; a
mesh-wide rule would make Envoy offer a client certificate they cannot
validate and every data-plane connection would fail. Those destinations are
handled by `enableAutoMtls`.

### 3. Authorization — `platform/kubernetes/istio/authorization-policies.yaml`

A namespace-wide `deny-all-by-default`, then narrow allow-rules keyed to
SPIFFE principals. mTLS proves *who* the peer is; this decides whether that
peer may make the call.

`deny-all-by-default` is the keystone. Deleting it silently reopens the mesh.

### 4. L3/L4 — `platform/kubernetes/network-policies.yaml` and the Helm chart

NetworkPolicy enforced by the CNI, not by Envoy. This is what still holds if a
pod runs without a sidecar. Default-deny on **both** ingress and egress, with
explicit exceptions for DNS, istiod, in-namespace traffic and the managed
infrastructure namespaces.

> Requires a NetworkPolicy-capable CNI (Calico, Cilium). Without one these
> objects are accepted and **silently ignored** — verify with an actual
> connection test, not by the resource existing.

### 5. Application — `Apps/fastify-server/src/mesh-identity.ts`

Every service re-checks the caller's identity itself, reading the verified
peer identity from the `x-forwarded-client-cert` (XFCC) header that the
receiving Envoy writes.

This exists because layers 1–3 are enforced by the sidecar and vanish with it:
injection disabled on a namespace, a `sidecar.istio.io/inject: "false"`
annotation, a pod scheduled while the injector webhook was down, or someone
port-forwarding straight to the container port.

Controlled per deployment:

```bash
MESH_IDENTITY_ENFORCEMENT=off|warn|enforce   # default: off
MESH_ALLOWED_PRINCIPALS=cluster.local/ns/tartware-system/sa/api-gateway,...
```

Defaults to `off`, so local development and any non-mesh deployment are
unaffected. The Helm chart sets `warn`; see [Rollout](#rollout).

---

## Header trust

`Apps/api-gateway/src/utils/proxy.ts` asserts the JWT-verified tenant to
downstream services as `x-tartware-tenant-id`, and services trust that header
in place of the client-supplied query parameter.

The gateway previously copied **every** inbound header through and only
*overwrote* the tenant header when the caller resolved to exactly one tenant.
A request whose auth context resolved to zero or several tenants forwarded the
client's own `x-tartware-tenant-id` untouched — a cross-tenant read and write
primitive available to any authenticated user.

The proxy now strips every header under the reserved `x-tartware-` prefix, plus
`x-forwarded-client-cert`, before setting its own values. When the caller spans
several tenants the gateway asserts nothing and the header is simply absent, so
downstream falls back to its own scoping rather than inheriting an unverified
value.

Regression tests: `Apps/api-gateway/tests/proxy-header-sanitization.test.ts`.

---

## Egress

The mesh runs `outboundTrafficPolicy: REGISTRY_ONLY`, and no NetworkPolicy
permits egress to `0.0.0.0/0`. A compromised workload has no route to the
internet.

**This blocks outbound calls that used to work.** The following inventory was
produced by auditing every `fetch()` call site and every HTTP-capable
dependency in `Apps/`, not from the deployed environment.

### Outbound to the internet

| Caller | Destination | Source | Status |
|--------|-------------|--------|--------|
| notification-service | `api.sendgrid.com` | `src/providers/sendgrid-provider.ts` | ✅ `ServiceEntry` added |
| notification-service | `api.resend.com` | `src/providers/resend-provider.ts` | ✅ `ServiceEntry` added |
| guests-service | `api.stripe.com`, `files.stripe.com` | `src/services/stripe-payment-gateway.ts` | ✅ `ServiceEntry` added |
| availability-guard-service | Slack / email / SMS webhooks | `src/workers/manual-release-notification-consumer.ts` | ⚠️ Slack covered; email + SMS hosts come from a Secret and are environment-specific |
| notification-service | `NOTIFICATION_WEBHOOK_URL` | `src/providers/webhook-provider.ts` | ⚠️ Single configured host — add a `ServiceEntry` once known |
| core-service | **tenant-configured URLs from the database** | `src/services/webhook-service.ts` | ❌ Cannot be allowlisted — see below |

### There is no push notification provider

Worth stating plainly, because it changes the question: the codebase has **no**
FCM, APNs, web-push, OneSignal or Expo integration. A search for all of those
returns nothing. "Notifications" in this system are:

- **Email** — SendGrid or Resend, selected by `NOTIFICATION_DEFAULT_CHANNEL`
- **Outbound webhook** — a single configured URL, or per-tenant subscriptions
- **In-app / real-time** — Server-Sent Events, proxied *inbound* through
  api-gateway (`src/routes/misc-routes.ts`). This is not egress and is
  unaffected.

So there is no mobile-push egress to plan for today. If one is added later it
will need a `ServiceEntry` for `fcm.googleapis.com` / `api.push.apple.com`.

### Tenant webhooks — the one case that does not fit

`core-service` delivers webhooks to URLs stored per tenant in the
`webhook_subscriptions` table. Those hosts are arbitrary and change at runtime,
so **no static `ServiceEntry` can cover them**. Under `REGISTRY_ONLY` every
tenant webhook fails with
`upstream_reset_before_response_started{connection_termination}`.

**Resolved with a workload-scoped `Sidecar` override.** The mesh default stays
`REGISTRY_ONLY`; core-service alone runs `ALLOW_ANY`, so the ability to reach an
arbitrary internet host is confined to the one pod with a product reason to
need it rather than granted to every workload.

Two resources, and **both are required**:

| Resource | File | Role |
|----------|------|------|
| `Sidecar/core-service-webhook-egress` | `istio/sidecar.yaml` | Lets Envoy dial an unregistered host |
| `NetworkPolicy/allow-core-service-webhook-egress` | `network-policies.yaml` | Lets the CNI pass the packet |

The Sidecar alone re-opens SSRF; the NetworkPolicy alone leaves Istio still
refusing the connection.

#### The `except` list is the security control

The destination here is **attacker-influenced** — anyone who can create a
webhook subscription chooses where this pod connects. The NetworkPolicy permits
`0.0.0.0/0` on ports 80/443 but carves out private and link-local space:

```
10.0.0.0/8       pod and service CIDRs
172.16.0.0/12    RFC1918
192.168.0.0/16   RFC1918
169.254.0.0/16   cloud metadata endpoint
127.0.0.0/8      the pod's own Envoy admin API
100.64.0.0/10    CGNAT, internal ranges on some clouds
192.0.0.0/24     IETF protocol assignments
```

Without those, a tenant could register a webhook pointing at
`http://billing-service:3025/...`, `http://169.254.169.254/latest/meta-data/`,
or `http://127.0.0.1:15000/`, and read the response back out of the delivery
log — a full SSRF chain. Restricting to public address space stops that at the
network layer, independently of any URL validation in application code.

#### Application-side validation

The network policy is the authoritative control, but it only produces an opaque
connection failure at delivery time. `schema/src/shared/outbound-url.ts` adds
the complementary check, so a bad target is rejected with a specific reason at
subscription time:

| Rejected | Why |
|----------|-----|
| non-`http(s)` schemes | `file:`, `gopher:`, `data:` are not webhooks and are local-file-read vectors |
| embedded credentials | `http://trusted.example@169.254.169.254/` reads as a trusted host but connects to the metadata IP |
| private / loopback / link-local / CGNAT literals | mirrors the NetworkPolicy `except` list |
| IPv4-mapped IPv6 | `::ffff:169.254.169.254`, in both dotted and normalised hex (`::ffff:a9fe:a9fe`) spellings |
| `localhost`, `*.local`, `*.internal`, `*.svc.cluster.local`, `metadata.google.internal` | cluster-internal or metadata names, trailing dot included |
| single-label hostnames | `http://billing-service:3025/` has no dot, so it resolves only via the cluster DNS search path — this is how you reach a sibling service by its short name |

Enforced in three places:

- `WebhookSubscriptionsSchema.webhook_url` — the schema itself, per the
  schema-first rule
- `createWebhook` / `updateWebhook` — in the service, not just the route, so a
  future consumer or admin script cannot bypass it (returns 400)
- `sendTestEvent` — **re-checked at dispatch**, because rows predating this
  change or inserted by direct SQL still hold whatever URL was stored, and
  dispatch is the moment the connection actually opens. Recorded as a normal
  failed delivery so the tenant sees the reason.

Redirects are now `redirect: "manual"`. A target that passes validation can
still `302` to `169.254.169.254`, which would hand back the exact SSRF this
prevents.

> **Still not covered — DNS rebinding.** A hostname is resolved at request
> time, not at validation time, so `evil.example` can return a public address
> when the subscription is created and a private one when the webhook fires.
> No hostname-based check can close that. The NetworkPolicy `except` list is
> what actually stops it, which is why both layers exist.

Tests: `schema/tests/outbound-url.test.ts` (28 cases, including regression
guards for public addresses adjacent to private ranges and for public IPv6
literals, which contain no dot).

To find what is being blocked:

```bash
kubectl logs -n tartware-system <pod> -c istio-proxy | grep -i BlackHoleCluster
```

## East-west traffic (service to service)

"Everything goes through the gateway" is true of north-south traffic only. The
audit found these internal calls that bypass api-gateway; all are explicitly
allowed in `authorization-policies.yaml` and `network-policies.yaml`:

| Caller | Callee | Source |
|--------|--------|--------|
| guests-service | core-service | `src/lib/internal-api.ts` (service login at `/v1/auth/login`), `src/services/checkin-service.ts` |
| guests-service | rooms-service | `src/services/booking-service.ts` |
| guests-service | guests-service | `src/services/booking-service.ts` |
| billing-service | core-service | `src/services/business-calendar-settings-service.ts` |
| reservations-command-service | availability-guard-service `:4400` (gRPC) | inventory checks |
| *every service* | service-registry | `Apps/fastify-server/src/registry-client.ts` — boot registration + heartbeat while `REGISTRY_URL` is set |
| core-service | service-registry | `src/routes/service-status.ts` |

`rooms-service` also configures `PHOENIX_SERVICE_URL`, but nothing calls it —
it is dead config, not an egress path.

> **Adding a new cross-service call means adding it to both policy files.** If
> you do not, it fails at runtime with `RBAC: access denied`, not at deploy
> time.

---

## Metrics

STRICT mTLS breaks Prometheus scraping unless the target changes. Prometheus
runs in the un-injected `observability` namespace, so it holds no mesh
certificate and the application port will refuse its handshake.

Every scrape target was therefore moved from the application port to the
sidecar's merged-metrics port **15020**, which pilot-agent serves outside the
mTLS and authorization path and which already includes the application's own
`/metrics` output:

| File | Change |
|------|--------|
| `platform/kubernetes/base-config.yaml` | `PodMonitor` → `targetPort: 15020`, `/stats/prometheus` |
| `charts/service-template/templates/servicemonitor.yaml` | → `port: istio-metrics` |
| `charts/service-template/templates/service.yaml` | exposes port `15020` as `istio-metrics` |
| `platform/apps/reservations-command-service/servicemonitor.yaml` | → `port: istio-metrics`, and namespace corrected from `pms` to `tartware-system` |

Do not point these back at the app port — the failure is a silent loss of all
metrics, not an error.

## Rollout

Applying STRICT mTLS to a running cluster drops traffic from every pod that
does not yet have a sidecar. Work in this order.

```bash
# 1. Namespace must be injecting, and every pod must be restarted into the mesh.
kubectl apply -f platform/kubernetes/base-config.yaml
kubectl rollout restart deployment -n tartware-system

# 2. Confirm 2/2 containers on every pod. Anything at 1/1 has no sidecar and
#    WILL lose connectivity at step 4.
kubectl get pods -n tartware-system

# 3. Install the ingress gateway and the mesh policies.
helmfile -e dev apply
kubectl apply -k platform/kubernetes/istio/

# 4. Verify mTLS is actually being negotiated before trusting it.
istioctl x describe pod -n tartware-system <api-gateway-pod>
#    Expect: "Effective PeerAuthentication mode: STRICT"

# 5. Network policies last — they are the least forgiving layer.
kubectl apply -f platform/kubernetes/network-policies.yaml
```

Then move application-level enforcement from `warn` to `enforce`:

```bash
kubectl logs -n tartware-system -l tier=domain-service \
  | grep "unverified mesh caller"
```

When that returns nothing across a full traffic cycle, set
`MESH_IDENTITY_ENFORCEMENT=enforce`. Switching straight to `enforce` rejects
every caller whose ServiceAccount is not yet on the allowlist, including ones
nobody remembered.

---

## Verifying it works

Proving a boundary exists means proving the *negative* — that a call which
should fail does fail. Checking that the app still works proves nothing.

```bash
# Plaintext from outside the mesh must be REFUSED.
# Expect: connection reset / 000. A 200 means STRICT is not in effect.
kubectl run probe --rm -it --restart=Never \
  --image=curlimages/curl --annotations sidecar.istio.io/inject=false -- \
  curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 \
  http://core-service.tartware-system.svc.cluster.local:3000/health

# An in-mesh service that is NOT the gateway must be REFUSED (RBAC: access denied).
kubectl exec -n tartware-system deploy/guests-service -c guests-service -- \
  curl -sS -o /dev/null -w '%{http_code}\n' \
  http://billing-service:3025/api/v1/invoices     # expect 403

# The gateway must SUCCEED.
kubectl exec -n tartware-system deploy/api-gateway -c api-gateway -- \
  curl -sS -o /dev/null -w '%{http_code}\n' \
  http://billing-service:3025/health               # expect 200

# No backend service may have an Ingress or an external address.
kubectl get ingress -n tartware-system             # expect: No resources found
kubectl get svc -n tartware-system \
  -o jsonpath='{range .items[?(@.spec.type!="ClusterIP")]}{.metadata.name}{"\n"}{end}'
                                                   # expect: empty
```

---

## Guard rails

Things that make a regression fail loudly instead of silently:

- **`service.meshLabels`** (`charts/service-template/templates/_helpers.tpl`)
  applies `app`, `tier` and `app.kubernetes.io/part-of`. These are what every
  policy selects on — problem #3 above was exactly their absence. They are in
  the pod template, never in `spec.selector`, which is immutable.
- **The Ingress guard** (`charts/service-template/templates/ingress.yaml`)
  refuses to render unless `ingress.allowExternalExposure` is also true, and
  explains why in the failure message.
- **Empty-allowlist boot failure** — a service configured to `enforce` with no
  principals refuses to start rather than failing open or silently closed.
- **`holdApplicationUntilProxyStarts`** — without it, requests issued during
  the startup race bypass the sidecar entirely, and therefore bypass mTLS.

---

## Known gaps

Honest list of what this does **not** cover.

- **Infrastructure hops are not mesh mTLS.** Postgres, Redis, Redpanda and the
  OTel collector live in un-injected namespaces. Traffic to them is restricted
  by NetworkPolicy but is not mutually authenticated. Securing those means
  either injecting those namespaces or enabling each server's native TLS with
  client certificates.
- **`platform/helm/Chart.yaml` references subcharts that do not exist**
  (`charts/api-gateway`, `charts/core-service`, and others — only
  `charts/service-template` is present), so `helm dep build` on the umbrella
  chart will fail. Pre-existing, unrelated to this work, but it means the Helm
  path is not currently deployable end to end.
- **Two deployment paths coexist** — raw manifests in `platform/kubernetes/`
  and the Helm chart — and they name ServiceAccounts differently
  (`api-gateway` vs `tartware-api-gateway`). The authorization policies list
  both principals. Consolidating on one path would remove the duplication.
- **`docker-compose.yml` has no mTLS.** Local development runs services in
  plaintext on published ports. The application-level check defaults to `off`
  precisely so this keeps working.
- Certificate rotation, CA trust and the `istio-system` control plane itself
  are Istio's defaults; this work does not change them.
