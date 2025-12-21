# Credentials and Tokens Guide

## 🔑 Complete Guide to Fetching UUIDs, Tokens, and Credentials

This guide explains how to obtain all necessary credentials, UUIDs, and tokens for your Tartware Kubernetes deployment.

---

## Quick Generate All Credentials

```bash
# Run the automated credential generator
./scripts/generate-credentials.sh

# This will create:
# - platform/.credentials (all passwords, tokens, UUIDs)
# - platform/secrets/*.yaml (Kubernetes secret manifests)

# Sample production-grade UUIDs for load testing
PGHOST=postgres.internal PGUSER=tartware PGPASSWORD=secret \
node scripts/bootstrap-loadtest-env.mjs

# Outputs:
# - .env.loadtest populated with tenant/property/reservation/etc IDs
# - platform/kubernetes/loadtest/kustomization.yaml updated with the same lists
```

---

## Manual Credential Generation

If you prefer to generate credentials manually or need specific tokens from external services:

### 1. Generate Random Passwords & Tokens

```bash
# Strong password (32 characters)
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32

# Secure token (64 characters hex)
openssl rand -hex 32

# UUID
uuidgen
# or
cat /proc/sys/kernel/random/uuid

# JWT Secret (base64)
openssl rand -base64 64 | tr -d "\n"
```

### 2. Database Credentials

**PostgreSQL**
```bash
# Generate database password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Create Kubernetes secret
kubectl create secret generic database-credentials \
  --from-literal=username=tartware \
  --from-literal=password=$DB_PASSWORD \
  --from-literal=connection-string="postgresql://tartware:${DB_PASSWORD}@postgres-postgresql.database.svc.cluster.local:5432/tartware" \
  -n tartware-system
```

### 3. Redis Credentials

```bash
# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)

# Create secret
kubectl create secret generic redis-credentials \
  --from-literal=password=$REDIS_PASSWORD \
  -n tartware-system
```

### 4. Application Secrets

```bash
# JWT Secret for authentication
JWT_SECRET=$(openssl rand -base64 64 | tr -d "\n")

# API Key
API_KEY=$(openssl rand -hex 32)

# Create secret
kubectl create secret generic application-secrets \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=api-key=$API_KEY \
  --from-literal=encryption-key=$(openssl rand -base64 32) \
  -n tartware-system
```

### 5. Rancher Credentials

**Get Rancher API Token:**

```bash
# Method 1: Via Rancher UI
# 1. Login to Rancher: https://rancher.tartware.local
# 2. Click on user avatar (top right) → API & Keys
# 3. Click "Add Key" → Create API Key
# 4. Copy and save the Bearer Token

# Method 2: Via CLI (after initial login)
RANCHER_TOKEN=$(curl -sk -X POST https://rancher.tartware.local/v3-public/localProviders/local?action=login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"'$RANCHER_PASSWORD'","ttl":0}' | jq -r .token)

echo "Rancher Token: $RANCHER_TOKEN"
```

**Change default Rancher password:**
```bash
# Via Rancher UI
# 1. Login with bootstrap password (default: admin)
# 2. You'll be prompted to change password
# 3. Set a strong password

# Save to secret
kubectl create secret generic rancher-credentials \
  --from-literal=password=$NEW_RANCHER_PASSWORD \
  --from-literal=token=$RANCHER_TOKEN \
  -n cattle-system
```

### 6. Docker Registry Credentials

**For Docker Hub:**
```bash
# Login first
docker login docker.io

# Create secret from docker config
kubectl create secret generic docker-registry-credentials \
  --from-file=.dockerconfigjson=$HOME/.docker/config.json \
  --type=kubernetes.io/dockerconfigjson \
  -n tartware-system
```

**For private registry:**
```bash
kubectl create secret docker-registry docker-registry-credentials \
  --docker-server=registry.tartware.local \
  --docker-username=admin \
  --docker-password=$REGISTRY_PASSWORD \
  --docker-email=admin@tartware.local \
  -n tartware-system
```

### 7. Monitoring Credentials

**Grafana:**
```bash
# Generate admin password
GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

# Create secret
kubectl create secret generic grafana-admin-credentials \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=$GRAFANA_PASSWORD \
  -n observability

echo "Grafana URL: https://grafana.tartware.local"
echo "Username: admin"
echo "Password: $GRAFANA_PASSWORD"
```

**Prometheus:**
```bash
# Usually uses service accounts, but for basic auth:
htpasswd -c auth prometheus
# Enter password when prompted

kubectl create secret generic prometheus-auth \
  --from-file=auth \
  -n observability
```

### 8. External Service Tokens

#### k6 Cloud (Optional)
```bash
# Get token from https://app.k6.io/account/api-tokens
# 1. Login to k6 Cloud
# 2. Go to Settings → API Tokens
# 3. Generate new token
# 4. Copy and save

export K6_CLOUD_TOKEN="your-token-here"
```

#### Slack Webhook (Optional)
```bash
# Get webhook URL:
# 1. Go to https://api.slack.com/apps
# 2. Create new app or select existing
# 3. Activate Incoming Webhooks
# 4. Add New Webhook to Workspace
# 5. Copy Webhook URL

export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Create secret
kubectl create secret generic slack-webhook \
  --from-literal=url=$SLACK_WEBHOOK_URL \
  -n observability
```

#### PagerDuty (Optional)
```bash
# Get integration key:
# 1. Login to PagerDuty
# 2. Go to Services → Select service
# 3. Integrations → Add Integration
# 4. Select "Prometheus" or "Events API V2"
# 5. Copy Integration Key

export PAGERDUTY_INTEGRATION_KEY="your-key-here"

kubectl create secret generic pagerduty-config \
  --from-literal=integration-key=$PAGERDUTY_INTEGRATION_KEY \
  -n observability
```

### 9. SSL/TLS Certificates

**Option A: Let's Encrypt (Automated via cert-manager)**
```bash
# No manual token needed, cert-manager handles it
# Just ensure cert-manager is installed and configured

kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@tartware.local
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

**Option B: Manual SSL Certificate**
```bash
# If you have existing certificates
kubectl create secret tls tartware-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n tartware-system
```

### 10. Cloud Provider Credentials

#### AWS
```bash
# Get from AWS Console → IAM → Users → Security Credentials
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_REGION="us-west-2"

# Create secret
kubectl create secret generic aws-credentials \
  --from-literal=access-key-id=$AWS_ACCESS_KEY_ID \
  --from-literal=secret-access-key=$AWS_SECRET_ACCESS_KEY \
  --from-literal=region=$AWS_REGION \
  -n kube-system
```

#### GCP
```bash
# Download service account key from GCP Console
# IAM & Admin → Service Accounts → Create Key (JSON)

kubectl create secret generic gcp-credentials \
  --from-file=key.json=path/to/service-account-key.json \
  -n kube-system
```

#### Azure
```bash
# Get from Azure Portal → App Registrations
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

kubectl create secret generic azure-credentials \
  --from-literal=client-id=$AZURE_CLIENT_ID \
  --from-literal=client-secret=$AZURE_CLIENT_SECRET \
  --from-literal=tenant-id=$AZURE_TENANT_ID \
  --from-literal=subscription-id=$AZURE_SUBSCRIPTION_ID \
  -n kube-system
```

### 11. Service UUIDs

Generate UUIDs for each microservice:

```bash
# Generate all at once
for service in api-gateway core-service billing-service guests-service \
               housekeeping-service reservations-command-service \
               rooms-service settings-service command-center-service; do
    uuid=$(uuidgen)
    echo "${service^^}_UUID=$uuid"
done

# Or use the credential generator script
./scripts/generate-credentials.sh
```

---

## Retrieving Existing Credentials

### From Kubernetes Cluster

```bash
# List all secrets
kubectl get secrets -n tartware-system

# Get specific secret
kubectl get secret database-credentials -n tartware-system -o yaml

# Decode secret value
kubectl get secret database-credentials -n tartware-system \
  -o jsonpath='{.data.password}' | base64 -d

# Get all values from a secret
kubectl get secret database-credentials -n tartware-system \
  -o json | jq -r '.data | map_values(@base64d)'
```

### From Rancher

```bash
# Get cluster token
rancher login https://rancher.tartware.local --token $RANCHER_TOKEN

# List clusters
rancher clusters ls

# Get cluster kubeconfig
rancher clusters kubeconfig <cluster-id> > kubeconfig.yaml
```

### From Vault (if using HashiCorp Vault)

```bash
# Login to Vault
vault login $VAULT_TOKEN

# Read secret
vault kv get secret/tartware/database

# Get specific field
vault kv get -field=password secret/tartware/database
```

---

## Security Best Practices

### 1. Store Credentials Securely

```bash
# Use a password manager (1Password, LastPass, Bitwarden)
# Export credentials to secure storage
./scripts/generate-credentials.sh
# Then import platform/.credentials to password manager
```

### 2. Rotate Credentials Regularly

```bash
# Recommended rotation schedule:
# - Database passwords: 90 days
# - API keys: 60 days
# - JWT secrets: 30 days
# - Rancher admin password: 90 days
```

### 3. Never Commit Secrets to Git

```bash
# Verify .gitignore includes:
cat >> .gitignore <<EOF
platform/.credentials
platform/.env
platform/secrets/*.yaml
*.key
*.pem
EOF
```

### 4. Use External Secrets Operator

```bash
# For production, integrate with external secret management
kubectl apply -f platform/kubernetes/external-secrets-config.yaml

# Configure to fetch from AWS Secrets Manager, Azure Key Vault, etc.
```

---

## Quick Reference

| Credential | Location | How to Get |
|------------|----------|------------|
| Database Password | `platform/.credentials` | `./scripts/generate-credentials.sh` |
| Redis Password | `platform/.credentials` | `./scripts/generate-credentials.sh` |
| JWT Secret | `platform/.credentials` | `./scripts/generate-credentials.sh` |
| Rancher Token | Rancher UI → API Keys | Manual via UI |
| Docker Registry | Docker Hub / Private | `docker login` |
| Grafana Password | `platform/.credentials` | `./scripts/generate-credentials.sh` |
| k6 Cloud Token | https://app.k6.io | Manual via UI |
| Slack Webhook | https://api.slack.com | Manual via UI |
| Cloud Credentials | Cloud Console | Manual via Console |

---

## Troubleshooting

### "Secret not found" error
```bash
# Check if secret exists
kubectl get secret <secret-name> -n tartware-system

# Recreate if missing
./scripts/generate-credentials.sh
kubectl apply -f platform/secrets/
```

### "Invalid credentials" error
```bash
# Verify secret contents
kubectl get secret database-credentials -n tartware-system -o yaml

# Test database connection
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql postgresql://tartware:PASSWORD@postgres-postgresql.database.svc.cluster.local:5432/tartware
```

### Rancher login failed
```bash
# Reset Rancher admin password
kubectl -n cattle-system exec $(kubectl -n cattle-system get pods -l app=rancher --no-headers -o custom-columns=NAME:.metadata.name | head -1) -- reset-password

# Follow on-screen instructions
```

---

## Next Steps

After generating credentials:

1. ✅ Run `./scripts/generate-credentials.sh`
2. ✅ Apply secrets: `kubectl apply -f platform/secrets/`
3. ✅ Configure `platform/.env`
4. ✅ Store `platform/.credentials` in password manager
5. ✅ Delete secret files: `rm -rf platform/secrets/*.yaml`
6. ✅ Proceed with deployment: `./quick-start.sh`

---

**Need help?** Check [docs/KUBERNETES_DEPLOYMENT.md](KUBERNETES_DEPLOYMENT.md) for full deployment guide.
