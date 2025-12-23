# Pre-Deployment Checklist

## ✅ Infrastructure Prerequisites

### Hardware/Cloud Resources
- [ ] Control plane nodes available (3x: 8 CPU, 16GB RAM, 200GB SSD)
- [ ] Worker nodes available (5+ nodes: 16 CPU, 32GB RAM, 500GB SSD)
- [ ] Network connectivity between nodes
- [ ] Shared storage or cloud storage configured
- [ ] Load balancer available (MetalLB, cloud LB, or hardware LB)

### Network Requirements
- [ ] DNS configured for *.tartware.local
- [ ] Firewall rules allow Kubernetes ports:
  - [ ] 6443 (API server)
  - [ ] 2379-2380 (etcd)
  - [ ] 10250-10252 (kubelet, kube-scheduler, kube-controller)
  - [ ] 30000-32767 (NodePort services)
- [ ] TLS certificates or cert-manager ready
- [ ] Ingress controller ports exposed (80, 443)

### Software Tools Installed
- [ ] kubectl (v1.28+)
- [ ] helm (v3.12+)
- [ ] docker (v24+)
- [ ] k6 (latest) - for load testing
- [ ] git
- [ ] Optional: helmfile, k9s, kubectx

## ✅ Configuration

### Environment Setup
- [ ] Copy `platform/.env.example` to `platform/.env`
- [ ] Set `CLUSTER_NAME`
- [ ] Set `INFRASTRUCTURE_PROVIDER` (vsphere/aws/gcp/azure/baremetal)
- [ ] Set `DOCKER_REGISTRY` and credentials
- [ ] Configure `RANCHER_HOSTNAME`
- [ ] Set domain names (BASE_DOMAIN, API_DOMAIN, etc.)

### Secrets Preparation
- [ ] Database password generated (strong password)
- [ ] Redis password generated
- [ ] Docker registry credentials ready
- [ ] SSL certificates ready (or cert-manager configured)
- [ ] Vault tokens/keys if using Vault

### Resource Planning
- [ ] Calculated expected load (current: 30k ops/sec)
- [ ] Reviewed resource allocations in `values.yaml`
- [ ] Adjusted HPA min/max replicas if needed
- [ ] Reviewed node pool sizes
- [ ] Budget approved for cloud costs

## ✅ Pre-Deployment Steps

### Repository Setup
- [ ] Clone repository to deployment machine
- [ ] Scripts are executable (chmod +x scripts/*.sh)
- [ ] Review `platform/helm/values.yaml`
- [ ] Review `platform/kubernetes/*.yaml` configurations

### Docker Images
- [ ] Build all service images OR
- [ ] Pull pre-built images from registry
- [ ] Images tagged correctly
- [ ] Registry accessible from cluster

### Database Setup
- [ ] PostgreSQL schema ready
- [ ] Initial data/migrations prepared
- [ ] Connection pool settings reviewed
- [ ] Backup strategy defined

### Testing Plan
- [ ] Load testing scenarios defined
- [ ] Performance targets documented
- [ ] Monitoring dashboards prepared
- [ ] Alert thresholds configured

## ✅ Deployment Execution

### Phase 1: Cluster Setup (30-60 min)
- [ ] Run `./scripts/setup-kubernetes.sh`
- [ ] Select "Install Rancher"
- [ ] Access Rancher UI and configure
- [ ] Create production cluster via Rancher
- [ ] Verify all nodes are ready

### Phase 2: Infrastructure (30-45 min)
- [ ] Deploy infrastructure with helmfile or manually
- [ ] Verify Istio is running
- [ ] Verify cert-manager is ready
- [ ] Verify Prometheus/Grafana deployed
- [ ] Verify database cluster is ready
- [ ] Verify Redis cluster is ready
- [ ] Verify messaging system is ready

### Phase 3: Application Deployment (20-30 min)
- [ ] Apply base configurations
- [ ] Apply HPA configurations
- [ ] Deploy Tartware services via Helm
- [ ] Wait for all pods to be ready
- [ ] Verify services are accessible
- [ ] Check ingress is working

### Phase 4: Monitoring Setup (15-20 min)
- [ ] Apply Prometheus configurations
- [ ] Apply Jaeger configurations
- [ ] Import Grafana dashboards
- [ ] Configure alert rules
- [ ] Test alert notifications
- [ ] Verify metrics are being collected

### Phase 5: Verification (15-30 min)
- [ ] Run smoke test
- [ ] Check all pods are running
- [ ] Check HPA status
- [ ] Test API endpoints
- [ ] Verify distributed tracing
- [ ] Check logs are flowing
- [ ] Verify backups are working

## ✅ Post-Deployment

### Testing & Validation
- [ ] Run baseline performance test
- [ ] Run load test at 10k ops/sec
- [ ] Run load test at 30k ops/sec
- [ ] Run stress test to find limits
- [ ] Verify auto-scaling works
- [ ] Test failure scenarios
- [ ] Verify recovery mechanisms

### Security Hardening
- [ ] Change default Rancher password
- [ ] Review and apply network policies
- [ ] Configure pod security policies
- [ ] Enable audit logging
- [ ] Review RBAC configurations
- [ ] Scan images for vulnerabilities
- [ ] Configure secrets rotation

### Documentation
- [ ] Document actual resource usage
- [ ] Document performance baselines
- [ ] Document operational procedures
- [ ] Document incident response plan
- [ ] Document backup/restore procedures
- [ ] Update runbooks

### Operational Readiness
- [ ] Alert notifications configured (Slack/PagerDuty/Email)
- [ ] On-call rotation established
- [ ] Runbooks accessible to team
- [ ] Access credentials documented securely
- [ ] Backup schedules verified
- [ ] Disaster recovery plan tested
- [ ] Monitoring dashboards bookmarked

## ✅ Go-Live Checklist

### Final Checks Before Production
- [ ] All tests passed with acceptable performance
- [ ] No critical alerts firing
- [ ] All monitoring working correctly
- [ ] Backups verified and tested
- [ ] Rollback plan documented
- [ ] Team briefed on new deployment
- [ ] DNS records updated
- [ ] External dependencies notified
- [ ] Maintenance window scheduled (if needed)

### Go-Live Steps
- [ ] Announce go-live to stakeholders
- [ ] Enable production traffic
- [ ] Monitor closely for first 24 hours
- [ ] Verify performance metrics
- [ ] Check error rates
- [ ] Verify scaling behavior
- [ ] Collect feedback

### Post Go-Live (First Week)
- [ ] Daily performance reviews
- [ ] Adjust HPA settings if needed
- [ ] Fine-tune resource allocations
- [ ] Optimize slow queries
- [ ] Review and act on alerts
- [ ] Collect operational metrics
- [ ] Document lessons learned

## ✅ Continuous Operations

### Daily Tasks
- [ ] Check Grafana dashboards
- [ ] Review alert history
- [ ] Check pod health
- [ ] Monitor resource usage
- [ ] Review error logs

### Weekly Tasks
- [ ] Performance trend analysis
- [ ] Capacity planning review
- [ ] Security updates check
- [ ] Backup verification
- [ ] Cost optimization review

### Monthly Tasks
- [ ] Kubernetes version updates
- [ ] Application updates
- [ ] Security audit
- [ ] Disaster recovery drill
- [ ] Performance tuning
- [ ] Documentation updates

## 📞 Emergency Contacts

### Internal Team
- DevOps Lead:
- Platform Engineer:
- Database Admin:
- Security Team:

### External Vendors
- Cloud Provider Support:
- Rancher Support:
- Monitoring Vendor:

## 📊 Success Criteria

### Performance Targets
- ✓ Throughput: 30,000+ RPS sustained
- ✓ P95 Latency: <450ms
- ✓ P99 Latency: <900ms
- ✓ Error Rate: <4%
- ✓ Availability: 99.9%

### Operational Targets
- ✓ Mean Time to Detect (MTTD): <5 minutes
- ✓ Mean Time to Respond (MTTR): <15 minutes
- ✓ Zero unplanned downtime
- ✓ All backups successful
- ✓ All security scans passing

---

**Use this checklist to ensure nothing is missed during deployment!**

Mark items with [x] as you complete them.
