#!/bin/bash
# Tartware Kubernetes Infrastructure Setup Script
# This script sets up the complete infrastructure for 30k ops/sec deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-tartware-prod}"
RANCHER_HOSTNAME="${RANCHER_HOSTNAME:-rancher.tartware.local}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-v1.28.5}"
INFRASTRUCTURE_PROVIDER="${INFRASTRUCTURE_PROVIDER:-vsphere}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing_tools+=("helm")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and try again."
        exit 1
    fi

    log_info "All prerequisites satisfied"
}

install_rancher() {
    log_info "Installing Rancher..."

    # Add Rancher Helm repository
    helm repo add rancher-stable https://releases.rancher.com/server-charts/stable
    helm repo update

    # Create namespace
    kubectl create namespace cattle-system --dry-run=client -o yaml | kubectl apply -f -

    # Install cert-manager if not already installed
    if ! kubectl get namespace cert-manager >/dev/null 2>&1; then
        log_info "Installing cert-manager..."
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

        # Wait for cert-manager to be ready
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
    fi

    # Install Rancher
    helm upgrade --install rancher rancher-stable/rancher \
        --namespace cattle-system \
        --set hostname=${RANCHER_HOSTNAME} \
        --set replicas=3 \
        --set bootstrapPassword=admin \
        --wait --timeout=10m

    log_info "Rancher installed successfully"
    log_info "Access Rancher at: https://${RANCHER_HOSTNAME}"
    log_info "Bootstrap password: admin (please change immediately)"
}

setup_infrastructure() {
    log_info "Setting up infrastructure components..."

    # Apply base configuration
    kubectl apply -f platform/kubernetes/base-config.yaml

    # Install helmfile dependencies
    if command -v helmfile >/dev/null 2>&1; then
        log_info "Installing infrastructure with helmfile..."
        cd platform
        helmfile sync --environment dev
        cd ..
    else
        log_warn "helmfile not found, skipping infrastructure deployment"
        log_info "Install helmfile: https://github.com/helmfile/helmfile"
    fi

    log_info "Infrastructure setup complete"
}

deploy_monitoring() {
    log_info "Deploying monitoring and observability stack..."

    # Apply Prometheus configuration
    kubectl apply -f platform/observability/prometheus-config.yaml

    # Apply Jaeger configuration
    kubectl apply -f platform/observability/jaeger-config.yaml

    # Wait for monitoring stack to be ready
    log_info "Waiting for monitoring stack to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n observability --timeout=300s || true

    log_info "Monitoring stack deployed"
}

build_and_push_images() {
    log_info "Building and pushing Docker images..."

    local registry="${DOCKER_REGISTRY:-docker.io/tartware}"
    local tag="${IMAGE_TAG:-latest}"

    local services=(
        "api-gateway"
        "core-service"
        "billing-service"
        "guests-service"
        "housekeeping-service"
        "reservations-command-service"
        "rooms-service"
        "settings-service"
        "command-center-service"
    )

    for service in "${services[@]}"; do
        log_info "Building $service..."
        docker build -t "${registry}/${service}:${tag}" -f "Apps/${service}/Dockerfile" .

        if [ "${PUSH_IMAGES:-true}" == "true" ]; then
            log_info "Pushing $service..."
            docker push "${registry}/${service}:${tag}"
        fi
    done

    log_info "All images built and pushed"
}

deploy_applications() {
    log_info "Deploying Tartware applications..."

    # Create namespace if not exists
    kubectl create namespace tartware-system --dry-run=client -o yaml | kubectl apply -f -

    # Apply HPA configurations
    kubectl apply -f platform/kubernetes/hpa-advanced.yaml

    # Deploy using Helm
    cd platform/helm

    # Update dependencies
    helm dependency update

    # Install/upgrade the chart
    helm upgrade --install tartware . \
        --namespace tartware-system \
        --values values.yaml \
        --wait --timeout=15m

    cd ../..

    log_info "Applications deployed successfully"
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Check all pods are running
    log_info "Checking pod status..."
    kubectl get pods -n tartware-system

    # Check HPA status
    log_info "Checking HPA status..."
    kubectl get hpa -n tartware-system

    # Check services
    log_info "Checking services..."
    kubectl get svc -n tartware-system

    # Check ingress
    log_info "Checking ingress..."
    kubectl get ingress -n tartware-system

    log_info "Deployment verification complete"
}

print_access_info() {
    log_info "========================================="
    log_info "Tartware Deployment Complete!"
    log_info "========================================="
    log_info ""
    log_info "Access Points:"
    log_info "  Rancher:     https://${RANCHER_HOSTNAME}"
    log_info "  API Gateway: https://api.tartware.local"
    log_info "  Grafana:     https://grafana.tartware.local"
    log_info "  Jaeger:      https://jaeger.tartware.local"
    log_info ""
    log_info "Next Steps:"
    log_info "  1. Change Rancher bootstrap password"
    log_info "  2. Configure DNS for *.tartware.local"
    log_info "  3. Run load tests: ./scripts/run-load-test.sh"
    log_info "  4. Monitor at: https://grafana.tartware.local"
    log_info ""
    log_info "========================================="
}

main() {
    log_info "Starting Tartware Kubernetes Infrastructure Setup"
    log_info "Cluster: ${CLUSTER_NAME}"
    log_info "Provider: ${INFRASTRUCTURE_PROVIDER}"

    check_prerequisites

    # Menu for step-by-step execution
    if [ "${AUTO_DEPLOY:-false}" == "true" ]; then
        install_rancher
        setup_infrastructure
        deploy_monitoring
        build_and_push_images
        deploy_applications
        verify_deployment
        print_access_info
    else
        PS3="Select operation: "
        options=(
            "Install Rancher"
            "Setup Infrastructure"
            "Deploy Monitoring"
            "Build & Push Images"
            "Deploy Applications"
            "Verify Deployment"
            "Full Deployment"
            "Exit"
        )

        select opt in "${options[@]}"; do
            case $opt in
                "Install Rancher")
                    install_rancher
                    ;;
                "Setup Infrastructure")
                    setup_infrastructure
                    ;;
                "Deploy Monitoring")
                    deploy_monitoring
                    ;;
                "Build & Push Images")
                    build_and_push_images
                    ;;
                "Deploy Applications")
                    deploy_applications
                    ;;
                "Verify Deployment")
                    verify_deployment
                    ;;
                "Full Deployment")
                    install_rancher
                    setup_infrastructure
                    deploy_monitoring
                    build_and_push_images
                    deploy_applications
                    verify_deployment
                    print_access_info
                    break
                    ;;
                "Exit")
                    break
                    ;;
                *)
                    log_error "Invalid option"
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"
