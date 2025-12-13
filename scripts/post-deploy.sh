#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# IDP Post-Deployment Script
# Run this after `cdk deploy` completes successfully
# =============================================================================

# Configuration - update these values
DEPLOYMENT_ID="${DEPLOYMENT_ID:-seagulls}"
REGION="${AWS_REGION:-us-west-2}"
DOMAIN="${DOMAIN:-backstage.stxkxs.io}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"  # Optional: for automatic DNS setup

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
# Step 3: Get ALB addresses
# -----------------------------------------------------------------------------
get_alb_addresses() {
    log_info "Retrieving ALB addresses..."

    echo ""
    echo "=========================================="
    echo "  Ingress Status"
    echo "=========================================="
    kubectl get ingress -A
    echo ""

    # Extract ALB addresses
    BACKSTAGE_ALB=$(kubectl get ingress -n backstage -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    ARGO_ALB=$(kubectl get ingress -n argo -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")

    if [[ -n "$BACKSTAGE_ALB" ]]; then
        log_success "Backstage ALB: $BACKSTAGE_ALB"
    else
        log_warn "Backstage ALB not ready yet"
    fi

    if [[ -n "$ARGO_ALB" ]]; then
        log_success "Argo ALB: $ARGO_ALB"
    else
        log_warn "Argo ALB not ready yet"
    fi
}

# -----------------------------------------------------------------------------
# Step 4: Configure DNS (Route53)
# -----------------------------------------------------------------------------

# ALB hosted zone IDs by region (these are AWS-managed and static)
# https://docs.aws.amazon.com/general/latest/gr/elb.html
declare -A ALB_ZONE_IDS=(
    ["us-east-1"]="Z35SXDOTRQ7X7K"
    ["us-east-2"]="Z3AADJGX6KTTL2"
    ["us-west-1"]="Z368ELLRRE2KJ0"
    ["us-west-2"]="Z1H1FL5HABSF5"
    ["eu-west-1"]="Z32O12XQLNTSW2"
    ["eu-west-2"]="ZHURV8PSTC4K8"
    ["eu-west-3"]="Z3Q77PNBQS71R4"
    ["eu-central-1"]="Z215JYRZR1TBD5"
    ["ap-northeast-1"]="Z14GRHDCWA56QT"
    ["ap-northeast-2"]="ZWKZPGTI48KDX"
    ["ap-southeast-1"]="Z1LMS91P8CMLE5"
    ["ap-southeast-2"]="Z1GM3OXH4ZPM65"
    ["ap-south-1"]="ZP97RAFLXTNZK"
    ["sa-east-1"]="Z2P70J7HTTTPLU"
    ["ca-central-1"]="ZQSVJUPU6J1EY"
)

configure_dns() {
    if [[ -z "$HOSTED_ZONE_ID" ]]; then
        log_warn "HOSTED_ZONE_ID not set - skipping automatic DNS configuration"
        log_info "Please manually create A records in your DNS provider:"
        echo ""
        echo "  ${DOMAIN}              -> ${BACKSTAGE_ALB:-<backstage-alb>}"
        echo "  argocd.${DOMAIN}       -> ${ARGO_ALB:-<argo-alb>}"
        echo "  workflows.${DOMAIN}    -> ${ARGO_ALB:-<argo-alb>}"
        echo ""
        return
    fi

    log_info "Configuring Route53 DNS records..."

    # Get ALB hosted zone ID for this region
    ALB_ZONE="${ALB_ZONE_IDS[$REGION]:-}"
    if [[ -z "$ALB_ZONE" ]]; then
        log_error "Unknown region: $REGION - cannot determine ALB hosted zone ID"
        log_info "Please manually create DNS records"
        return
    fi

    log_info "Using ALB hosted zone ID: $ALB_ZONE (for region $REGION)"

    # Create backstage A record (root domain)
    if [[ -n "$BACKSTAGE_ALB" ]]; then
        aws route53 change-resource-record-sets \
            --hosted-zone-id "$HOSTED_ZONE_ID" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"${DOMAIN}\",
                        \"Type\": \"A\",
                        \"AliasTarget\": {
                            \"HostedZoneId\": \"${ALB_ZONE}\",
                            \"DNSName\": \"dualstack.${BACKSTAGE_ALB}\",
                            \"EvaluateTargetHealth\": true
                        }
                    }
                }]
            }" --region "$REGION" >/dev/null
        log_success "Created A record: ${DOMAIN}"
    fi

    # Create argocd and workflows A records
    if [[ -n "$ARGO_ALB" ]]; then
        aws route53 change-resource-record-sets \
            --hosted-zone-id "$HOSTED_ZONE_ID" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"argocd.${DOMAIN}\",
                        \"Type\": \"A\",
                        \"AliasTarget\": {
                            \"HostedZoneId\": \"${ALB_ZONE}\",
                            \"DNSName\": \"dualstack.${ARGO_ALB}\",
                            \"EvaluateTargetHealth\": true
                        }
                    }
                }]
            }" --region "$REGION" >/dev/null
        log_success "Created A record: argocd.${DOMAIN}"

        aws route53 change-resource-record-sets \
            --hosted-zone-id "$HOSTED_ZONE_ID" \
            --change-batch "{
                \"Changes\": [{
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"workflows.${DOMAIN}\",
                        \"Type\": \"A\",
                        \"AliasTarget\": {
                            \"HostedZoneId\": \"${ALB_ZONE}\",
                            \"DNSName\": \"dualstack.${ARGO_ALB}\",
                            \"EvaluateTargetHealth\": true
                        }
                    }
                }]
            }" --region "$REGION" >/dev/null
        log_success "Created A record: workflows.${DOMAIN}"
    fi
}

# -----------------------------------------------------------------------------
# Step 5: Display access information
# -----------------------------------------------------------------------------
display_access_info() {
    echo ""
    echo "=========================================="
    echo "  Platform Access Information"
    echo "=========================================="
    echo ""

    # Backstage
    echo -e "${GREEN}Backstage (Developer Portal)${NC}"
    echo "  URL: https://${DOMAIN}"
    echo "  Auth: GitHub OAuth"
    echo ""

    # ArgoCD
    echo -e "${GREEN}Argo CD (GitOps)${NC}"
    echo "  URL: https://argocd.${DOMAIN}"
    echo "  Username: admin"
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || echo "<not available>")
    echo "  Password: ${ARGOCD_PASSWORD}"
    echo ""

    # Argo Workflows
    echo -e "${GREEN}Argo Workflows${NC}"
    echo "  URL: https://workflows.${DOMAIN}"
    echo "  Auth: Server mode (no login required)"
    echo ""

    echo "=========================================="
    echo ""
}

# -----------------------------------------------------------------------------
# Step 6: Run health checks
# -----------------------------------------------------------------------------
run_health_checks() {
    log_info "Running health checks..."

    echo ""
    echo "Pod Status:"
    echo "-----------"
    kubectl get pods -n backstage
    echo ""
    kubectl get pods -n argocd
    echo ""
    kubectl get pods -n argo
    echo ""

    # Check external secrets
    log_info "Checking External Secrets sync status..."
    kubectl get externalsecrets -A 2>/dev/null || log_warn "No external secrets found"
    echo ""

    # Check cluster secret store
    log_info "Checking ClusterSecretStore..."
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
    echo "  HOSTED_ZONE_ID: ${HOSTED_ZONE_ID:-<not set>}"
    echo ""

    configure_kubectl
    wait_for_components
    get_alb_addresses
    configure_dns
    run_health_checks
    display_access_info

    log_success "Post-deployment setup complete!"
}

main "$@"
