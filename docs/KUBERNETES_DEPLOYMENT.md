# Tartware Kubernetes Deployment Guide

## Overview

This guide covers deploying Tartware to a production Kubernetes cluster capable of handling **20,000 operations per second** using Rancher for cluster management.

## Architecture

### Infrastructure Components

- **Kubernetes Version**: v1.28.5+
- **Cluster Manager**: Rancher 2.8.0
- **Container Runtime**: containerd
- **Service Mesh**: Istio 1.22
- **Ingress Controller**: NGINX Ingress
- **Certificate Management**: cert-manager

### High Availability Setup

- **Control Plane**: 3 nodes
- **Worker Nodes (Compute)**: 5-100 nodes (auto-scaling)
- **Worker Nodes (Memory)**: 3-50 nodes (auto-scaling)

### Resource Allocation

For 20k ops/sec capacity:

| Service | Min Replicas | Max Replicas | CPU (per pod) | Memory (per pod) |
|---------|--------------|--------------|---------------|------------------|
| API Gateway | 10 | 100 | 500m-2000m | 512Mi-2Gi |
| Core Service | 8 | 80 | 500m-2000m | 1Gi-4Gi |
| Reservations | 8 | 70 | 500m-2000m | 1Gi-4Gi |
| Billing Service | 5 | 40 | 300m-1500m | 512Mi-2Gi |
| Guests Service | 5 | 35 | 300m-1500m | 512Mi-2Gi |
| Rooms Service | 5 | 35 | 300m-1500m | 512Mi-2Gi |
| Others | 2 | 15 | 200m-1000m | 256Mi-1Gi |

**Total Capacity (Max)**:
- CPU: ~600 cores
- Memory: ~1.2TB
- Pods: ~400

## Prerequisites

### Required Tools

```bash
# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# helmfile (optional but recommended)
wget https://github.com/helmfile/helmfile/releases/download/v0.161.0/helmfile_0.161.0_linux_amd64.tar.gz
tar -xzf helmfile_0.161.0_linux_amd64.tar.gz
sudo mv helmfile /usr/local/bin/

# k6 (for load testing)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Infrastructure Requirements

#### For VMware vSphere

- vCenter Server 7.0+
- Datastore with 10TB+ available
- Network with VLAN support
- VM Template: Ubuntu 22.04 with cloud-init

#### For AWS

- EKS 1.28+
- VPC with at least 3 availability zones
- NAT Gateway for private subnets
- Route53 for DNS

#### For Bare Metal

- 3 control plane nodes: 8 CPU, 16GB RAM, 200GB SSD
- 8+ worker nodes: 16 CPU, 32GB RAM, 500GB SSD
- High-speed networking (10Gbps+)
- Shared storage (NFS/Ceph)

## Installation Steps

### 1. Cluster Setup

#### Option A: Using Rancher (Recommended)

```bash
# Install Rancher on an existing cluster
./scripts/setup-kubernetes.sh
# Select: "Install Rancher"

# Access Rancher UI
echo "Access: https://rancher.tartware.local"
echo "Username: admin"
echo "Password: admin (change immediately)"

# Create production cluster via Rancher UI
# - Navigate to Cluster Management
# - Click "Create"
# - Select your infrastructure provider
# - Configure node pools (see Resource Allocation above)
# - Deploy
```

#### Option B: Manual RKE2 Installation

```bash
# On each node
curl -sfL https://get.rke2.io | sh -

# Control plane node
systemctl enable rke2-server.service
systemctl start rke2-server.service

# Get join token
cat /var/lib/rancher/rke2/server/node-token

# Worker nodes
mkdir -p /etc/rancher/rke2/
cat > /etc/rancher/rke2/config.yaml <<EOF
server: https://<control-plane-ip>:9345
token: <node-token>
EOF

systemctl enable rke2-agent.service
systemctl start rke2-agent.service
```

### 2. Configure kubectl

```bash
# Copy kubeconfig from control plane
mkdir -p ~/.kube
scp root@<control-plane-ip>:/etc/rancher/rke2/rke2.yaml ~/.kube/config
sed -i 's/127.0.0.1/<control-plane-ip>/g' ~/.kube/config

# Verify
kubectl get nodes
```

### 3. Deploy Infrastructure

```bash
# Deploy all infrastructure components
./scripts/setup-kubernetes.sh
# Select: "Setup Infrastructure"

# This deploys:
# - Istio service mesh
# - Consul for service discovery
# - PostgreSQL for database
# - Redis for caching
# - Kafka/RedPanda for messaging
# - Prometheus for monitoring
# - Grafana for visualization
# - Jaeger for tracing
```

### 4. Configure Secrets

```bash
# Database credentials
kubectl create secret generic database-credentials \
  --from-literal=username=tartware \
  --from-literal=password=<strong-password> \
  -n tartware-system

# Redis credentials
kubectl create secret generic redis-credentials \
  --from-literal=password=<redis-password> \
  -n tartware-system

# Docker registry (if using private registry)
kubectl create secret docker-registry regcred \
  --docker-server=<registry-url> \
  --docker-username=<username> \
  --docker-password=<password> \
  -n tartware-system
```

### 5. Build and Push Images

```bash
# Set registry
export DOCKER_REGISTRY="docker.io/tartware"
export IMAGE_TAG="v1.0.0"

# Build and push
./scripts/setup-kubernetes.sh
# Select: "Build & Push Images"

# Or manually
docker login
docker-compose build
docker-compose push
```

### 6. Deploy Applications

```bash
# Deploy all Tartware services
./scripts/setup-kubernetes.sh
# Select: "Deploy Applications"

# Or manually
cd platform/helm
helm dependency update
helm upgrade --install tartware . \
  --namespace tartware-system \
  --create-namespace \
  --values values.yaml \
  --wait --timeout=15m
```

### 7. Configure Ingress and DNS

```bash
# Get LoadBalancer IP
kubectl get svc -n istio-system istio-ingressgateway

# Configure DNS A records:
# *.tartware.local -> <LoadBalancer-IP>
# api.tartware.local -> <LoadBalancer-IP>
# rancher.tartware.local -> <LoadBalancer-IP>

# For local testing, add to /etc/hosts:
echo "<LoadBalancer-IP> api.tartware.local" | sudo tee -a /etc/hosts
echo "<LoadBalancer-IP> grafana.tartware.local" | sudo tee -a /etc/hosts
echo "<LoadBalancer-IP> jaeger.tartware.local" | sudo tee -a /etc/hosts
```

## Verification

### Health Checks

```bash
# Check all pods are running
kubectl get pods -n tartware-system

# Check HPA status
kubectl get hpa -n tartware-system

# Check services
kubectl get svc -n tartware-system

# Test API Gateway
curl https://api.tartware.local/health
```

### Smoke Test

```bash
# Run basic smoke test
./scripts/run-load-test.sh
# Select: "Smoke Test (30s)"
```

## Monitoring and Observability

### Access Points

- **Grafana**: https://grafana.tartware.local
  - Username: admin / Password: (from secret)
  - Dashboards: Tartware Overview, Service Metrics, Infrastructure

- **Prometheus**: http://prometheus.tartware.local
  - Query metrics directly
  - Alert rules configuration

- **Jaeger**: https://jaeger.tartware.local
  - Distributed tracing
  - Service dependency graph

- **Rancher**: https://rancher.tartware.local
  - Cluster management
  - Application deployment

### Key Metrics to Monitor

1. **Request Rate**: `sum(rate(http_requests_total[1m]))`
2. **Latency (P95)**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
3. **Error Rate**: `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))`
4. **Pod Count**: `count(kube_pod_info{namespace="tartware-system"})`
5. **CPU Usage**: `sum(rate(container_cpu_usage_seconds_total[5m]))`
6. **Memory Usage**: `sum(container_memory_working_set_bytes)`

## Load Testing

### Running Load Tests

```bash
# Start load test for 20k ops/sec
./scripts/run-load-test.sh
# Select: "Load Test (20k RPS)"

# Monitor during test
kubectl top pods -n tartware-system
kubectl get hpa -n tartware-system -w
```

### Alternative: Locust

```bash
# Start Locust environment
cd loadtest
docker-compose -f docker-compose.loadtest.yml --profile locust up -d

# Access Locust UI
open http://localhost:8089

# Configure:
# - Number of users: 5000
# - Spawn rate: 100/s
# - Host: https://api.tartware.local
```

### Expected Performance

Target metrics for 20k ops/sec:

- **Throughput**: 20,000+ requests/second
- **P95 Latency**: < 500ms
- **P99 Latency**: < 1000ms
- **Error Rate**: < 5%
- **CPU Utilization**: 60-70%
- **Memory Utilization**: 70-80%

## Scaling

### Manual Scaling

```bash
# Scale specific service
kubectl scale deployment api-gateway -n tartware-system --replicas=20

# Scale HPA limits
kubectl patch hpa api-gateway-hpa -n tartware-system -p '{"spec":{"maxReplicas":150}}'
```

### Automatic Scaling

HPAs are configured to scale based on:
- CPU utilization (70% threshold)
- Memory utilization (80% threshold)
- Custom metrics (requests/second, latency)

Scaling policies:
- **Scale Up**: Aggressive (100% increase every 15s)
- **Scale Down**: Conservative (10% decrease every 60s)

### Cluster Autoscaling

Enable cluster autoscaler for node-level scaling:

```bash
# For AWS
kubectl apply -f platform/kubernetes/cluster-autoscaler-aws.yaml

# For GCP
kubectl apply -f platform/kubernetes/cluster-autoscaler-gcp.yaml
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n tartware-system

# Check logs
kubectl logs <pod-name> -n tartware-system

# Common issues:
# - ImagePullBackOff: Check registry credentials
# - CrashLoopBackOff: Check application logs
# - Pending: Check resource availability
```

### High Latency

```bash
# Check resource usage
kubectl top pods -n tartware-system

# Check HPA status
kubectl get hpa -n tartware-system

# Check database connections
kubectl exec -it <core-service-pod> -n tartware-system -- \
  psql -h postgres -U tartware -c "SELECT count(*) FROM pg_stat_activity;"

# Scale up if needed
kubectl patch hpa <service>-hpa -n tartware-system -p '{"spec":{"minReplicas":20}}'
```

### Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl get pods -n database

# Test connection
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql -h postgres-postgresql.database.svc.cluster.local -U tartware -d tartware

# Check connection pool
kubectl logs -l app=core-service -n tartware-system | grep "connection pool"
```

## Maintenance

### Backup

```bash
# Database backup
kubectl exec -n database postgres-postgresql-0 -- \
  pg_dump -U tartware tartware > backup-$(date +%Y%m%d).sql

# Kubernetes resources
kubectl get all -n tartware-system -o yaml > k8s-backup.yaml
```

### Updates

```bash
# Update applications
helm upgrade tartware platform/helm \
  --namespace tartware-system \
  --values platform/helm/values.yaml \
  --set global.image.tag=v1.1.0

# Rolling restart
kubectl rollout restart deployment -n tartware-system
```

### Logs Collection

```bash
# Export logs
kubectl logs -l app.kubernetes.io/part-of=tartware -n tartware-system \
  --since=24h > logs-$(date +%Y%m%d).log

# Use Loki for centralized logging
kubectl port-forward -n observability svc/loki 3100:3100
```

## Security

### Network Policies

Network policies are in place to:
- Restrict inter-namespace communication
- Allow only necessary ingress/egress
- Isolate database and cache layers

### Pod Security

- Non-root user enforcement
- Read-only root filesystem
- Dropped capabilities
- Security context constraints

### Secrets Management

Use external secrets operator with Vault:

```bash
# Configure Vault
kubectl apply -f platform/kubernetes/external-secrets-config.yaml
```

## Cost Optimization

### Resource Right-Sizing

Monitor actual usage and adjust:

```bash
# Get resource recommendations
kubectl describe vpa -n tartware-system
```

### Spot Instances

For cloud deployments, use spot instances for non-critical workloads:

```bash
# AWS: Configure node groups with spot instances
# GCP: Use preemptible VMs
# Azure: Use spot VMs
```

## Support

For issues or questions:
- Internal Wiki: https://wiki.tartware.local
- DevOps Team: devops@tartware.local
- Monitoring Dashboard: https://grafana.tartware.local

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Rancher Documentation](https://rancher.com/docs/)
- [Helm Charts](https://helm.sh/docs/)
- [Istio Documentation](https://istio.io/latest/docs/)
