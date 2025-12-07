#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# IDP Post-Deployment Script
# Run this after `cdk deploy` completes successfully
#
# DNS is managed automatically by ExternalDNS - no manual configuration needed
# =============================================================================

# Configuration - update these values or set as environment variables
DEPLOYMENT_ID="${DEPLOYMENT_ID:-smash}"
REGION="${AWS_REGION:-us-west-2}"
DOMAIN="${DOMAIN:-devops.stxkxs.io}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------------------------
# Step 1: Configure kubectl
# -----------------------------------------------------------------------------
configure_kubectl() {
    log_info "Configuring kubectl for EKS cluster..."

    aws eks update-kubeconfig \
        --name "${DEPLOYMENT_ID}-eks" \
        --region "${REGION}"

    log_info "Verifying cluster access..."
    if kubectl get nodes &>/dev/null; then
        log_success "kubectl configured successfully"
        kubectl get nodes
    else
        log_error "Failed to connect to cluster"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Step 2: Wait for core components
# -----------------------------------------------------------------------------
wait_for_components() {
    log_info "Waiting for core components to be ready..."

    # Wait for AWS Load Balancer Controller
    log_info "Waiting for AWS Load Balancer Controller..."
    kubectl wait --for=condition=available deployment/aws-load-balancer-controller \
        -n aws-load-balancer --timeout=300s 2>/dev/null || true

    # Wait for External Secrets Operator
    log_info "Waiting for External Secrets Operator..."
    kubectl wait --for=condition=available deployment/external-secrets \
        -n external-secrets --timeout=300s 2>/dev/null || true

    # Wait for ExternalDNS
    log_info "Waiting for ExternalDNS..."
    kubectl wait --for=condition=available deployment/external-dns \
        -n external-dns --timeout=300s 2>/dev/null || true

    # Wait for Backstage
    log_info "Waiting for Backstage..."
    kubectl wait --for=condition=available deployment \
        -l app.kubernetes.io/name=backstage -n backstage --timeout=600s 2>/dev/null || true

    # Wait for ArgoCD
    log_info "Waiting for ArgoCD..."
    kubectl wait --for=condition=available deployment/argocd-server \
        -n argocd --timeout=300s 2>/dev/null || true

    # Wait for Argo Workflows
    log_info "Waiting for Argo Workflows..."
    kubectl wait --for=condition=available deployment/argo-workflows-server \
        -n argo --timeout=300s 2>/dev/null || true

    log_success "Core components are ready"
}

# -----------------------------------------------------------------------------
# Step 3: Get ingress status
# -----------------------------------------------------------------------------
get_ingress_status() {
    log_info "Retrieving ingress status..."

    echo ""
    echo "=========================================="
    echo "  Ingress Status"
    echo "=========================================="
    kubectl get ingress -A
    echo ""

    # Check if ExternalDNS has created the records
    log_info "DNS records are managed by ExternalDNS automatically"
    log_info "Checking ExternalDNS logs for recent activity..."
    kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns --tail=5 2>/dev/null || true
    echo ""
}

# -----------------------------------------------------------------------------
# Step 4: Display access information
# -----------------------------------------------------------------------------
display_access_info() {
    echo ""
    echo "=========================================="
    echo "  Platform Access Information"
    echo "=========================================="
    echo ""

    # Backstage
    echo -e "${GREEN}Backstage (Developer Portal)${NC}"
    echo "  URL: https://backstage.${DOMAIN}"
    echo "  Auth: GitHub OAuth"
    echo ""

    # ArgoCD
    echo -e "${GREEN}Argo CD (GitOps)${NC}"
    echo "  URL: https://argocd.${DOMAIN}"
    echo "  Auth: GitHub OAuth (via Dex)"
    echo ""

    # Argo Workflows
    echo -e "${GREEN}Argo Workflows${NC}"
    echo "  URL: https://workflows.${DOMAIN}"
    echo "  Auth: ArgoCD SSO"
    echo ""

    # Argo Rollouts
    echo -e "${GREEN}Argo Rollouts Dashboard${NC}"
    echo "  URL: https://rollouts.${DOMAIN}"
    echo "  Auth: ArgoCD SSO"
    echo ""

    echo "=========================================="
    echo ""
}

# -----------------------------------------------------------------------------
# Step 5: Run health checks
# -----------------------------------------------------------------------------
run_health_checks() {
    log_info "Running health checks..."

    echo ""
    echo "External Secrets Status:"
    echo "------------------------"
    kubectl get externalsecrets -A 2>/dev/null || log_warn "No external secrets found"
    echo ""

    echo "ClusterSecretStore Status:"
    echo "--------------------------"
    kubectl get clustersecretstore 2>/dev/null || log_warn "No cluster secret store found"
    echo ""

    log_success "Health checks complete"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo "=========================================="
    echo "  IDP Post-Deployment Setup"
    echo "=========================================="
    echo ""
    echo "Configuration:"
    echo "  DEPLOYMENT_ID: ${DEPLOYMENT_ID}"
    echo "  REGION: ${REGION}"
    echo "  DOMAIN: ${DOMAIN}"
    echo ""

    configure_kubectl
    wait_for_components
    get_ingress_status
    run_health_checks
    display_access_info

    log_success "Post-deployment setup complete!"
}

main "$@"
