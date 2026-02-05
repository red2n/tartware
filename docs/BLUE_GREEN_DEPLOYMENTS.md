# Blue/Green Deployments with Argo Rollouts

## Overview

Tartware uses Argo Rollouts for zero-downtime deployments with automated canary analysis and rollback capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Blue/Green Deployment Flow                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. New Version    2. Preview Testing   3. Promotion    4. Cleanup  │
│  ┌─────────┐       ┌─────────┐          ┌─────────┐     ┌─────────┐ │
│  │ Blue    │ ───▶  │ Blue    │   ───▶   │ Green   │ ──▶ │ Green   │ │
│  │ (v1.0)  │       │ (v1.0)  │          │ (v1.1)  │     │ (v1.1)  │ │
│  │ ACTIVE  │       │ ACTIVE  │          │ ACTIVE  │     │ ONLY    │ │
│  └─────────┘       └─────────┘          └─────────┘     └─────────┘ │
│                    ┌─────────┐          ┌─────────┐                 │
│                    │ Green   │          │ Blue    │                 │
│                    │ (v1.1)  │          │ (v1.0)  │                 │
│                    │ PREVIEW │          │ STANDBY │                 │
│                    └─────────┘          └─────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Installation

Argo Rollouts is included in the Tartware helmfile:

```bash
cd platform
helmfile sync

# Or install standalone:
helm repo add argo https://argoproj.github.io/argo-helm
helm install argo-rollouts argo/argo-rollouts -n argo-rollouts --create-namespace
```

## Configuration

### Rollout Definitions

See [argo-rollouts.yaml](../platform/kubernetes/argo-rollouts.yaml) for full configurations.

Key services with blue/green rollouts:
- **api-gateway**: Critical entry point, requires pre-promotion health checks
- **core-service**: Main business logic, includes success rate analysis
- **reservations-command-service**: High-priority booking service

### Example Rollout Spec

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-gateway
spec:
  replicas: 12
  strategy:
    blueGreen:
      activeService: api-gateway-active      # Production traffic
      previewService: api-gateway-preview    # Testing new version
      autoPromotionEnabled: false            # Require manual approval
      scaleDownDelaySeconds: 30              # Keep old version for rollback
      prePromotionAnalysis:
        templates:
          - templateName: api-gateway-health-check
```

## Usage

### Deploying a New Version

```bash
# Update image tag
kubectl argo rollouts set image api-gateway api-gateway=tartware/api-gateway:v1.1.0 -n tartware-system

# Watch rollout progress
kubectl argo rollouts get rollout api-gateway -n tartware-system --watch
```

### Testing Preview Environment

```bash
# Get preview service endpoint
kubectl get svc api-gateway-preview -n tartware-system

# Test preview directly
curl http://api-gateway-preview.tartware-system.svc.cluster.local:8080/health
```

### Promoting to Production

```bash
# After testing preview, promote to active
kubectl argo rollouts promote api-gateway -n tartware-system

# Or via dashboard
kubectl argo rollouts dashboard -n argo-rollouts
# Access: http://localhost:3100
```

### Rolling Back

```bash
# Immediate rollback to previous version
kubectl argo rollouts undo api-gateway -n tartware-system

# Abort current rollout (keeps active version)
kubectl argo rollouts abort api-gateway -n tartware-system
```

## Analysis Templates

### Health Check (Pre-promotion)

Verifies the preview service is healthy before promotion:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: api-gateway-health-check
spec:
  metrics:
    - name: health-check
      interval: 10s
      count: 3
      successCondition: result == "healthy"
      failureLimit: 2
      provider:
        web:
          url: "http://{{args.service-name}}.tartware-system.svc.cluster.local:8080/health"
          jsonPath: "{$.status}"
```

### Success Rate (Post-promotion)

Monitors error rate after promotion:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: api-gateway-success-rate
spec:
  metrics:
    - name: success-rate
      interval: 30s
      count: 5
      successCondition: result[0] >= 0.95  # 95% success rate
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.observability.svc.cluster.local:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status=~"2.."}[5m])) /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
- name: Deploy with Argo Rollouts
  run: |
    kubectl argo rollouts set image ${{ matrix.service }} \
      ${{ matrix.service }}=tartware/${{ matrix.service }}:${{ github.sha }} \
      -n tartware-system

- name: Wait for Rollout
  run: |
    kubectl argo rollouts status ${{ matrix.service }} \
      -n tartware-system \
      --timeout=10m
```

### Automated Promotion (Use with Caution)

Enable auto-promotion after analysis passes:

```yaml
strategy:
  blueGreen:
    autoPromotionEnabled: true
    autoPromotionSeconds: 30  # Wait 30s after analysis passes
```

## Monitoring

### Rollout Status

```bash
# List all rollouts
kubectl argo rollouts list rollouts -n tartware-system

# Detailed status
kubectl argo rollouts get rollout api-gateway -n tartware-system
```

### Prometheus Metrics

```promql
# Rollouts by phase
rollout_phase{namespace="tartware-system"}

# Failed rollouts
rollout_info{phase="Degraded"}

# Analysis run results
analysis_run_info{phase="Failed"}
```

### Grafana Dashboard

Import the Argo Rollouts dashboard:
- Dashboard ID: 14522
- Or check `platform/observability/dashboards/argo-rollouts.json`

## Best Practices

1. **Always test in preview** before promoting
2. **Set conservative analysis thresholds** (95%+ success rate)
3. **Keep `scaleDownDelaySeconds` > 30** for quick rollback
4. **Monitor preview traffic** during testing phase
5. **Use namespaced AnalysisTemplates** for service-specific checks

## Troubleshooting

### Rollout Stuck in Paused State

```bash
# Check rollout status
kubectl argo rollouts get rollout api-gateway -n tartware-system

# Check analysis run
kubectl get analysisrun -n tartware-system

# Force promotion (use carefully)
kubectl argo rollouts promote api-gateway -n tartware-system --full
```

### Analysis Failing

```bash
# Get analysis run details
kubectl describe analysisrun <name> -n tartware-system

# Check Prometheus query
kubectl exec -it prometheus-0 -n observability -- \
  promtool query instant http://localhost:9090 'your_promql_query'
```

## Related Documentation

- [Kubernetes Deployment](./KUBERNETES_DEPLOYMENT.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Argo Rollouts Official Docs](https://argoproj.github.io/argo-rollouts/)
