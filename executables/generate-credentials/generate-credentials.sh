#!/bin/bash
# Tartware Credentials Generator
# Generates all necessary UUIDs, tokens, and passwords for deployment
#
# Usage: Run this script from anywhere in the repository
#   ./executables/generate-credentials/generate-credentials.sh
#
# The script automatically finds the repository root and creates:
#   - platform/.credentials (secure credentials file)
#   - platform/secrets/*.yaml (Kubernetes secret manifests)
#   - platform/.ssh/* (SSH key pairs)

set -euo pipefail

# Validate we're running in bash (required for PIPESTATUS)
if [ -z "$BASH_VERSION" ]; then
    echo "Error: This script requires bash. Please run with: bash $0"
    exit 1
fi

# Find repository root (look for package.json and nx.json)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to repository root to ensure platform/ folder is created in the right place
cd "$REPO_ROOT"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CREDENTIALS_FILE="platform/.credentials"
ENV_FILE="platform/.env"

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate UUID
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen
    else
        cat /proc/sys/kernel/random/uuid
    fi
}

# Generate random token
generate_token() {
    openssl rand -hex 32
}

# Generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "\n"
}

# Generate MFA secret (base32 encoded for TOTP)
# TOTP requires a base32-encoded secret (RFC 4648)
# Generate 20 random bytes -> 32 base32 characters (160 bits of entropy)
generate_mfa_secret() {
    # Generate 20 random bytes, encode to base32, remove padding
    # Base32 encoding of 20 bytes produces exactly 32 characters
    openssl rand 20 | base32 | tr -d "="
}

# Generate SSH key pair
generate_ssh_key() {
    local key_name=$1
    if [ ! -f "platform/.ssh/${key_name}" ]; then
        mkdir -p platform/.ssh
        ssh-keygen -t ed25519 -f "platform/.ssh/${key_name}" -N "" -C "tartware-${key_name}"
        log "✓ Generated SSH key: platform/.ssh/${key_name}"
    fi
}

echo -e "${BLUE}"
cat << "EOF"
 _____              _            _   _       _
|_   _|_ _ _ __ ___| |___      _| | | | ___ (_) ___
  | |/ _` | '__/ __| __\ \ /\ / / |_| |/ _ \| |/ _ \
  | | (_| | |  \__ \ |_ \ V  V /|  _  |  __/| |  __/
  |_|\__,_|_|  |___/\__| \_/\_/ |_| |_|\___|/ |\___|
                                           |__/
  Credentials Generator
EOF
echo -e "${NC}"

log "Generating credentials for Tartware deployment..."
echo ""

# Create platform directory if it doesn't exist
mkdir -p platform

# Create credentials file
cat > "$CREDENTIALS_FILE" << 'HEADER'
# Tartware Credentials - KEEP THIS FILE SECURE!
# Generated: $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

HEADER

# Generate all credentials
log "Generating database credentials..."
DB_PASSWORD=$(generate_password 32)
DB_ADMIN_PASSWORD=$(generate_password 32)
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Database Credentials
# ============================================================================
DB_PASSWORD=$DB_PASSWORD
DB_ADMIN_PASSWORD=$DB_ADMIN_PASSWORD
DB_REPLICATION_PASSWORD=$(generate_password 32)
EOF

log "Generating Redis credentials..."
REDIS_PASSWORD=$(generate_password 24)
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Redis Credentials
# ============================================================================
REDIS_PASSWORD=$REDIS_PASSWORD
EOF

log "Generating application secrets..."
JWT_SECRET=$(generate_jwt_secret)
ADMIN_PASSWORD=$(generate_password 16)
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Application Secrets
# ============================================================================
JWT_SECRET=$JWT_SECRET
API_KEY=$(generate_token)
WEBHOOK_SECRET=$(generate_token)
ENCRYPTION_KEY=$(generate_password 32)

# System Administrator Credentials
SYSTEM_ADMIN_USERNAME=sysadmin
SYSTEM_ADMIN_EMAIL=sysadmin@tartware.io
SYSTEM_ADMIN_PASSWORD=$ADMIN_PASSWORD
SYSTEM_ADMIN_MFA_SECRET=$(generate_mfa_secret)
EOF

log "Generating Rancher credentials..."
RANCHER_PASSWORD=$(generate_password 16)
RANCHER_TOKEN=$(generate_token)
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Rancher Credentials
# ============================================================================
RANCHER_BOOTSTRAP_PASSWORD=$RANCHER_PASSWORD
RANCHER_API_TOKEN=$RANCHER_TOKEN
EOF

log "Generating Vault credentials..."
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Vault Credentials
# ============================================================================
VAULT_ROOT_TOKEN=$(generate_uuid)
VAULT_UNSEAL_KEY_1=$(generate_token)
VAULT_UNSEAL_KEY_2=$(generate_token)
VAULT_UNSEAL_KEY_3=$(generate_token)
EOF

log "Generating messaging credentials..."
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Messaging System Credentials
# ============================================================================
KAFKA_PASSWORD=$(generate_password 24)
KAFKA_ADMIN_PASSWORD=$(generate_password 24)
NATS_PASSWORD=$(generate_password 24)
EOF

log "Generating monitoring credentials..."
GRAFANA_ADMIN_PASSWORD=$(generate_password 16)
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Monitoring Credentials
# ============================================================================
GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD
PROMETHEUS_ADMIN_PASSWORD=$(generate_password 16)
ALERTMANAGER_PASSWORD=$(generate_password 16)
EOF

log "Generating external service tokens..."
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# External Service Tokens
# ============================================================================
# k6 Cloud (optional)
K6_CLOUD_TOKEN=

# Slack webhook (optional)
SLACK_WEBHOOK_URL=

# PagerDuty (optional)
PAGERDUTY_INTEGRATION_KEY=

# Sentry DSN (optional)
SENTRY_DSN=

# DataDog API Key (optional)
DATADOG_API_KEY=
EOF

log "Generating SSH keys..."
generate_ssh_key "rancher-node"
generate_ssh_key "deployment"

log "Generating UUIDs for services..."
cat >> "$CREDENTIALS_FILE" << EOF

# ============================================================================
# Service UUIDs
# ============================================================================
API_GATEWAY_UUID=$(generate_uuid)
CORE_SERVICE_UUID=$(generate_uuid)
BILLING_SERVICE_UUID=$(generate_uuid)
GUESTS_SERVICE_UUID=$(generate_uuid)
HOUSEKEEPING_SERVICE_UUID=$(generate_uuid)
RESERVATIONS_SERVICE_UUID=$(generate_uuid)
ROOMS_SERVICE_UUID=$(generate_uuid)
SETTINGS_SERVICE_UUID=$(generate_uuid)
COMMAND_CENTER_SERVICE_UUID=$(generate_uuid)
EOF

# Set secure permissions
chmod 600 "$CREDENTIALS_FILE"

log "✓ All credentials generated and saved to: $CREDENTIALS_FILE"
echo ""

# Create Kubernetes secrets
log "Creating Kubernetes secret manifests..."

mkdir -p platform/secrets

# Database secrets
cat > platform/secrets/database-credentials.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: tartware-system
type: Opaque
stringData:
  username: tartware
  password: $DB_PASSWORD
  admin-password: $DB_ADMIN_PASSWORD
  replication-password: $(grep DB_REPLICATION_PASSWORD "$CREDENTIALS_FILE" | cut -d= -f2)
  connection-string: postgresql://tartware:$DB_PASSWORD@postgres-postgresql.database.svc.cluster.local:5432/tartware
EOF

# Redis secrets
cat > platform/secrets/redis-credentials.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: redis-credentials
  namespace: tartware-system
type: Opaque
stringData:
  password: $REDIS_PASSWORD
  connection-string: redis://default:$REDIS_PASSWORD@redis-master.cache.svc.cluster.local:6379
EOF

# Application secrets
cat > platform/secrets/application-secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: application-secrets
  namespace: tartware-system
type: Opaque
stringData:
  jwt-secret: $JWT_SECRET
  api-key: $(grep API_KEY "$CREDENTIALS_FILE" | cut -d= -f2)
  webhook-secret: $(grep WEBHOOK_SECRET "$CREDENTIALS_FILE" | cut -d= -f2)
  encryption-key: $(grep ENCRYPTION_KEY "$CREDENTIALS_FILE" | cut -d= -f2)
EOF

# Monitoring secrets
cat > platform/secrets/monitoring-secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: grafana-admin-credentials
  namespace: observability
type: Opaque
stringData:
  admin-user: admin
  admin-password: $GRAFANA_ADMIN_PASSWORD
EOF

# Docker registry secret template
cat > platform/secrets/docker-registry-secret.yaml.template << 'EOF'
# Docker Registry Secret Template
# Fill in your registry credentials and rename to docker-registry-secret.yaml

apiVersion: v1
kind: Secret
metadata:
  name: docker-registry-credentials
  namespace: tartware-system
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: BASE64_ENCODED_DOCKER_CONFIG

# To generate .dockerconfigjson value, run:
# kubectl create secret docker-registry docker-registry-credentials \
#   --docker-server=YOUR_REGISTRY \
#   --docker-username=YOUR_USERNAME \
#   --docker-password=YOUR_PASSWORD \
#   --docker-email=YOUR_EMAIL \
#   --dry-run=client -o jsonpath='{.data.\.dockerconfigjson}'
EOF

log "✓ Kubernetes secret manifests created in: platform/secrets/"
echo ""

# Display summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Credentials Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Database Password:        ${GREEN}$(echo $DB_PASSWORD | cut -c1-8)...${NC}"
echo "📋 Redis Password:           ${GREEN}$(echo $REDIS_PASSWORD | cut -c1-8)...${NC}"
echo ""
echo "📋 System Admin Username:    ${GREEN}sysadmin${NC}"
echo "📋 System Admin Email:       ${GREEN}sysadmin@tartware.io${NC}"
echo "📋 System Admin Password:    ${GREEN}$(echo $ADMIN_PASSWORD | cut -c1-4)...${NC} (see $CREDENTIALS_FILE)"
echo ""
echo "🔐 MFA Secret (Base32):      ${GREEN}$(grep SYSTEM_ADMIN_MFA_SECRET $CREDENTIALS_FILE | tail -1 | cut -d= -f2)${NC}"
MFA_SECRET=$(grep SYSTEM_ADMIN_MFA_SECRET $CREDENTIALS_FILE | tail -1 | cut -d= -f2)
OTPAUTH_URL="otpauth://totp/Tartware:sysadmin?secret=${MFA_SECRET}&issuer=Tartware"
echo "📱 MFA Setup URI:            ${YELLOW}${OTPAUTH_URL}${NC}"
echo ""
echo "   ${GREEN}To generate QR code securely (local only):${NC}"
echo "   Run: ${BLUE}./executables/show-mfa-qr/show-mfa-qr.sh${NC}"
echo "   Or:  ${BLUE}echo \"${OTPAUTH_URL}\" | qrencode -t UTF8${NC}"
echo ""
echo "📋 Rancher Admin Password:   ${GREEN}$RANCHER_PASSWORD${NC}"
echo "📋 Grafana Admin Password:   ${GREEN}$GRAFANA_ADMIN_PASSWORD${NC}"
echo ""
echo "All credentials saved to: ${YELLOW}$CREDENTIALS_FILE${NC}"
echo "SSH keys generated in:    ${YELLOW}platform/.ssh/${NC}"
echo "Kubernetes secrets in:    ${YELLOW}platform/secrets/${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "1. Keep $CREDENTIALS_FILE secure and NEVER commit to git"
echo "2. SSH private keys in platform/.ssh/ must NEVER be committed to git"
echo "3. Store credentials in a password manager (1Password, LastPass, etc.)"
echo "4. NEVER use online QR code generators for MFA - use local generation only"
echo "5. Apply secrets to cluster: ${GREEN}kubectl apply -f platform/secrets/${NC}"
echo "6. Delete secret files after applying: ${GREEN}rm -rf platform/secrets/*.yaml${NC}"
echo "7. Rotate credentials regularly (every 90 days recommended)"
echo "8. MFA is generated but NOT enabled by default. Enable it in system settings."
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create gitignore entry
if [ -f .gitignore ]; then
    if ! grep -q "platform/.credentials" .gitignore; then
        echo "platform/.credentials" >> .gitignore
        log "✓ Added platform/.credentials to .gitignore"
    fi
    if ! grep -q "platform/.ssh/" .gitignore; then
        echo "platform/.ssh/" >> .gitignore
        log "✓ Added platform/.ssh/ to .gitignore"
    fi
    if ! grep -q "platform/secrets/*.yaml" .gitignore; then
        echo "platform/secrets/*.yaml" >> .gitignore
        log "✓ Added platform/secrets/*.yaml to .gitignore"
    fi
fi

# Offer to apply secrets
echo ""
read -p "Would you like to apply these secrets to the cluster now? (y/n): " apply_secrets

if [ "$apply_secrets" == "y" ] || [ "$apply_secrets" == "Y" ]; then
    if kubectl cluster-info &>/dev/null; then
        log "Applying secrets to Kubernetes cluster..."

        # Create namespaces if they don't exist
        kubectl create namespace tartware-system --dry-run=client -o yaml | kubectl apply -f -
        kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -

        # Apply secrets
        kubectl apply -f platform/secrets/database-credentials.yaml
        kubectl apply -f platform/secrets/redis-credentials.yaml
        kubectl apply -f platform/secrets/application-secrets.yaml
        kubectl apply -f platform/secrets/monitoring-secrets.yaml

        log "✓ Secrets applied successfully!"

        read -p "Delete secret files for security? (y/n): " delete_files
        if [ "$delete_files" == "y" ] || [ "$delete_files" == "Y" ]; then
            rm -f platform/secrets/*.yaml
            log "✓ Secret files deleted"
        fi
    else
        warn "Not connected to Kubernetes cluster. Apply secrets manually later."
        log "Run: kubectl apply -f platform/secrets/"
    fi
fi

# Offer to bootstrap system admin user
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}System Administrator Bootstrap${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Would you like to bootstrap the system administrator now?"
echo "This requires:"
echo "  - PostgreSQL database accessible"
echo "  - Database credentials set (PGHOST, PGDATABASE, PGUSER, PGPASSWORD)"
echo "  - core-service bootstrap script available"
echo ""
read -p "Bootstrap system admin now? (y/n): " bootstrap_admin

if [ "$bootstrap_admin" == "y" ] || [ "$bootstrap_admin" == "Y" ]; then
    BOOTSTRAP_SCRIPT="Apps/core-service/scripts/bootstrap-system-admin-token.ts"

    if [ ! -f "$BOOTSTRAP_SCRIPT" ]; then
        warn "Bootstrap script not found at: $BOOTSTRAP_SCRIPT"
        warn "Run manually from repo root with: ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
    else
        log "Bootstrapping system administrator..."

        # Check if database is accessible
        if command -v psql >/dev/null 2>&1; then
            DB_HOST=${PGHOST:-localhost}
            DB_PORT=${PGPORT:-5432}
            DB_NAME=${PGDATABASE:-tartware}
            DB_USER=${PGUSER:-postgres}

            if PGPASSWORD=${PGPASSWORD:-$DB_PASSWORD} psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
                log "Database connection successful"

                # Set environment variables and run bootstrap script
                export PGHOST=${PGHOST:-localhost}
                export PGPORT=${PGPORT:-5432}
                export PGDATABASE=${PGDATABASE:-tartware}
                export PGUSER=${PGUSER:-postgres}
                export PGPASSWORD=${PGPASSWORD:-$DB_PASSWORD}
                export ADMIN_USERNAME=sysadmin
                export ADMIN_EMAIL=sysadmin@tartware.io
                export ADMIN_PASSWORD=$ADMIN_PASSWORD
                export ADMIN_MFA_SECRET=$(grep SYSTEM_ADMIN_MFA_SECRET $CREDENTIALS_FILE | tail -1 | cut -d= -f2)
                export AUTH_JWT_SECRET=$JWT_SECRET

                if command -v tsx >/dev/null 2>&1; then
                    log "Running bootstrap script..."
                    tsx "$BOOTSTRAP_SCRIPT" | tee platform/.admin-token

                    if [ ${PIPESTATUS[0]} -eq 0 ]; then
                        log "✓ System administrator bootstrapped successfully!"
                        log "Admin token saved to: platform/.admin-token"

                        # Add to gitignore
                        if [ -f .gitignore ]; then
                            if ! grep -q "platform/.admin-token" .gitignore; then
                                echo "platform/.admin-token" >> .gitignore
                                log "✓ Added platform/.admin-token to .gitignore"
                            fi
                        fi
                    else
                        warn "Bootstrap script failed. Run manually from repo root:"
                        echo "  ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
                    fi
                else
                    warn "tsx not found. Install with: npm install -g tsx"
                    echo "Then run: ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx $BOOTSTRAP_SCRIPT"
                fi
            else
                warn "Cannot connect to database. Check connection settings:"
                echo "  PGHOST=${PGHOST:-localhost}"
                echo "  PGPORT=${PGPORT:-5432}"
                echo "  PGDATABASE=${PGDATABASE:-tartware}"
                echo "  PGUSER=${PGUSER:-postgres}"
                echo ""
                echo "Run bootstrap manually from repo root after database is ready:"
                echo "  ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
            fi
        else
            warn "psql not found. Cannot verify database connection."
            echo "Run bootstrap manually from repo root after database is ready:"
            echo "  ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
        fi
    fi
else
    log "Skipping admin bootstrap. Run manually when ready from repo root:"
    echo "  ADMIN_PASSWORD='$ADMIN_PASSWORD' tsx Apps/core-service/scripts/bootstrap-system-admin-token.ts"
    echo ""
    echo "System Admin Credentials:"
    echo "  Username: sysadmin"
    echo "  Email:    sysadmin@tartware.io"
    echo "  Password: $ADMIN_PASSWORD"
fi

echo ""
log "Next steps:"
echo "  1. Review credentials in: $CREDENTIALS_FILE"
echo "  2. Configure platform/.env with your infrastructure details"
echo "  3. Run deployment: ./executables/tartware.sh deploy kubernetes"
echo ""
