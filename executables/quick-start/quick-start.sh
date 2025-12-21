#!/bin/bash
# Tartware Quick Start - Get up and running in minutes

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
 _____          _                          
|_   _|_ _ _ __| |___      ____ _ _ __ ___ 
  | |/ _` | '__| __\ \ /\ / / _` | '__/ _ \
  | | (_| | |  | |_ \ V  V / (_| | | |  __/
  |_|\__,_|_|   \__| \_/\_/ \__,_|_|  \___|
                                            
  Kubernetes Deployment - Quick Start
  Capacity: 20,000 ops/sec
EOF
echo -e "${NC}"

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1"
}

# Check prerequisites
check_prereqs() {
    log "Checking prerequisites..."
    
    local missing=()
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing+=("helm")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    
    if [ ${#missing[@]} -ne 0 ]; then
        warn "Missing tools: ${missing[*]}"
        echo ""
        echo "Install instructions:"
        echo "  kubectl: https://kubernetes.io/docs/tasks/tools/"
        echo "  helm: https://helm.sh/docs/intro/install/"
        echo "  docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    log "✓ All prerequisites installed"
}

# Setup environment
setup_env() {
    log "Setting up environment..."
    
    if [ ! -f platform/.env ]; then
        cp platform/.env.example platform/.env
        log "✓ Created platform/.env - please configure before deploying"
    fi
    
    # Source environment
    source platform/.env 2>/dev/null || true
}

# Main menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo ""
    echo "  [1] 🚀 Full Deployment (Rancher + Apps + Testing)"
    echo "  [2] 🔧 Install Rancher Only"
    echo "  [3] 📦 Deploy Applications Only"
    echo "  [4] 🧪 Setup Testing Environment"
    echo "  [5] 📊 View Status"
    echo "  [6] 🧹 Cleanup"
    echo "  [7] 📚 View Documentation"
    echo "  [8] ❌ Exit"
    echo ""
    read -p "Select option [1-8]: " choice
    
    case $choice in
        1) full_deployment ;;
        2) install_rancher ;;
        3) deploy_apps ;;
        4) setup_testing ;;
        5) view_status ;;
        6) cleanup ;;
        7) view_docs ;;
        8) exit 0 ;;
        *) 
            warn "Invalid option"
            show_menu
            ;;
    esac
}

full_deployment() {
    log "Starting full deployment..."
    
    read -p "Have you configured platform/.env? (y/n): " configured
    if [ "$configured" != "y" ]; then
        warn "Please configure platform/.env first"
        exit 1
    fi
    
    log "This will:"
    log "  1. Install Rancher"
    log "  2. Deploy infrastructure (Istio, Prometheus, etc.)"
    log "  3. Build and push Docker images"
    log "  4. Deploy Tartware applications"
    log "  5. Setup monitoring"
    log "  6. Configure load testing"
    echo ""
    read -p "Continue? (y/n): " confirm
    
    if [ "$confirm" == "y" ]; then
        export AUTO_DEPLOY=true
        ./scripts/setup-kubernetes.sh
    fi
}

install_rancher() {
    log "Installing Rancher..."
    ./scripts/setup-kubernetes.sh
    # Will show interactive menu
}

deploy_apps() {
    log "Deploying applications..."
    
    cd platform/helm
    
    # Update dependencies
    helm dependency update
    
    # Deploy
    helm upgrade --install tartware . \
        --namespace tartware-system \
        --create-namespace \
        --values values.yaml \
        --wait --timeout=15m
    
    log "✓ Applications deployed"
    
    cd ../..
    view_status
}

setup_testing() {
    log "Setting up testing environment..."
    
    # Start load test infrastructure
    cd loadtest
    docker-compose -f docker-compose.loadtest.yml up -d
    cd ..
    
    log "✓ Testing environment ready"
    echo ""
    echo "Access points:"
    echo "  - Grafana: http://localhost:3001 (admin/admin)"
    echo "  - InfluxDB: http://localhost:8086"
    echo ""
    echo "Run tests with: ./scripts/run-load-test.sh"
}

view_status() {
    log "Current deployment status:"
    echo ""
    
    if kubectl cluster-info &>/dev/null; then
        echo "✓ Connected to Kubernetes cluster"
        echo ""
        
        # Check namespaces
        echo "📦 Namespaces:"
        kubectl get namespace | grep -E "(tartware|cattle|observability|tracing)" || echo "  No tartware namespaces found"
        echo ""
        
        # Check pods
        if kubectl get namespace tartware-system &>/dev/null; then
            echo "🚀 Tartware Services:"
            kubectl get pods -n tartware-system
            echo ""
            
            echo "📊 HPA Status:"
            kubectl get hpa -n tartware-system
            echo ""
        fi
        
        # Check ingress
        if kubectl get ingress -n tartware-system &>/dev/null; then
            echo "🌐 Ingress:"
            kubectl get ingress -n tartware-system
            echo ""
        fi
        
        # Resource usage
        echo "💻 Resource Usage:"
        kubectl top nodes 2>/dev/null || echo "  Metrics server not available"
        echo ""
        
    else
        warn "Not connected to Kubernetes cluster"
        echo "Configure kubectl: export KUBECONFIG=~/.kube/config"
    fi
}

view_docs() {
    echo ""
    echo "📚 Documentation:"
    echo ""
    echo "  Main README:          platform/README.md"
    echo "  Deployment Guide:     docs/KUBERNETES_DEPLOYMENT.md"
    echo "  Testing Guide:        docs/TESTING_ENVIRONMENT.md"
    echo ""
    echo "Quick links:"
    echo "  - Architecture Overview"
    echo "  - Step-by-step Deployment"
    echo "  - Load Testing"
    echo "  - Monitoring & Observability"
    echo "  - Troubleshooting"
    echo ""
    read -p "Open deployment guide? (y/n): " open_guide
    if [ "$open_guide" == "y" ]; then
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open docs/KUBERNETES_DEPLOYMENT.md
        elif command -v open >/dev/null 2>&1; then
            open docs/KUBERNETES_DEPLOYMENT.md
        else
            cat docs/KUBERNETES_DEPLOYMENT.md | less
        fi
    fi
}

cleanup() {
    warn "Cleanup Options:"
    echo ""
    echo "  [1] Remove Applications Only"
    echo "  [2] Remove Infrastructure"
    echo "  [3] Full Cleanup (Everything)"
    echo "  [4] Cancel"
    echo ""
    read -p "Select option [1-4]: " cleanup_choice
    
    case $cleanup_choice in
        1)
            log "Removing applications..."
            helm uninstall tartware -n tartware-system || true
            ;;
        2)
            log "Removing infrastructure..."
            cd platform
            helmfile destroy --environment dev || true
            cd ..
            ;;
        3)
            warn "This will remove EVERYTHING!"
            read -p "Are you sure? Type 'yes' to confirm: " confirm
            if [ "$confirm" == "yes" ]; then
                log "Removing all resources..."
                helm uninstall tartware -n tartware-system || true
                kubectl delete namespace tartware-system || true
                cd platform
                helmfile destroy --environment dev || true
                cd ..
                log "✓ Cleanup complete"
            fi
            ;;
        4)
            log "Cancelled"
            ;;
    esac
}

# Main
main() {
    check_prereqs
    setup_env
    
    # If AUTO_DEPLOY is set, skip menu
    if [ "${AUTO_DEPLOY:-false}" == "true" ]; then
        full_deployment
    else
        show_menu
    fi
}

main "$@"
