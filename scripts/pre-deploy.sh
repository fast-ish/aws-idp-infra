#!/usr/bin/env bash
#
# Pre-deployment script for IDP infrastructure
# Creates Route53 hosted zone, configures NS delegation, and creates AWS Secrets Manager secrets
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
REGION="${AWS_REGION:-us-west-2}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Pre-deployment setup for IDP infrastructure.
Creates Route53 hosted zone, configures NS delegation, and creates GitHub OAuth secrets.

Required:
  --domain DOMAIN                 Domain name for Route53 hosted zone (e.g., idp.example.com)
  --prefix PREFIX                 Prefix for secret names (e.g., smash)
  --backstage-client-id ID        GitHub OAuth client ID for Backstage
  --backstage-client-secret SEC   GitHub OAuth client secret for Backstage
  --argocd-client-id ID           GitHub OAuth client ID for ArgoCD
  --argocd-client-secret SEC      GitHub OAuth client secret for ArgoCD

Optional:
  --region REGION                 AWS region (default: us-west-2 or AWS_REGION env var)
  --skip-hosted-zone              Skip Route53 hosted zone creation
  --skip-secrets                  Skip secrets creation
  --skip-delegation               Skip NS delegation setup (manual configuration)
  -h, --help                      Show this help message

Examples:
  # Full setup (creates hosted zone, delegates NS, creates secrets)
  $(basename "$0") \\
    --domain idp.example.com \\
    --prefix smash \\
    --backstage-client-id Ov23li... \\
    --backstage-client-secret abc123... \\
    --argocd-client-id Ov23li... \\
    --argocd-client-secret def456...

  # Only create hosted zone with NS delegation
  $(basename "$0") --domain idp.example.com --skip-secrets

  # Only create secrets
  $(basename "$0") \\
    --prefix smash \\
    --backstage-client-id Ov23li... \\
    --backstage-client-secret abc123... \\
    --argocd-client-id Ov23li... \\
    --argocd-client-secret def456... \\
    --skip-hosted-zone
EOF
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

# Parse arguments
DOMAIN=""
PREFIX=""
BACKSTAGE_CLIENT_ID=""
BACKSTAGE_CLIENT_SECRET=""
ARGOCD_CLIENT_ID=""
ARGOCD_CLIENT_SECRET=""
SKIP_HOSTED_ZONE=false
SKIP_SECRETS=false
SKIP_DELEGATION=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    --backstage-client-id)
      BACKSTAGE_CLIENT_ID="$2"
      shift 2
      ;;
    --backstage-client-secret)
      BACKSTAGE_CLIENT_SECRET="$2"
      shift 2
      ;;
    --argocd-client-id)
      ARGOCD_CLIENT_ID="$2"
      shift 2
      ;;
    --argocd-client-secret)
      ARGOCD_CLIENT_SECRET="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --skip-hosted-zone)
      SKIP_HOSTED_ZONE=true
      shift
      ;;
    --skip-secrets)
      SKIP_SECRETS=true
      shift
      ;;
    --skip-delegation)
      SKIP_DELEGATION=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Validation
if [[ "$SKIP_HOSTED_ZONE" == false && -z "$DOMAIN" ]]; then
  log_error "--domain is required when creating hosted zone"
  exit 1
fi

if [[ "$SKIP_SECRETS" == false ]]; then
  if [[ -z "$PREFIX" ]]; then
    log_error "--prefix is required when creating secrets"
    exit 1
  fi
  if [[ -z "$BACKSTAGE_CLIENT_ID" || -z "$BACKSTAGE_CLIENT_SECRET" ]]; then
    log_error "Backstage OAuth credentials are required"
    exit 1
  fi
  if [[ -z "$ARGOCD_CLIENT_ID" || -z "$ARGOCD_CLIENT_SECRET" ]]; then
    log_error "ArgoCD OAuth credentials are required"
    exit 1
  fi
fi

# Extract parent domain from subdomain (e.g., idp.example.com -> example.com)
get_parent_domain() {
  local domain="$1"
  echo "$domain" | cut -d. -f2-
}

# Get hosted zone ID by domain name
get_hosted_zone_id() {
  local domain="$1"
  aws route53 list-hosted-zones-by-name \
    --dns-name "$domain" \
    --max-items 1 \
    --query "HostedZones[?Name=='${domain}.'].Id" \
    --output text 2>/dev/null | sed 's|/hostedzone/||' || echo ""
}

# Get nameservers for a hosted zone
get_nameservers() {
  local zone_id="$1"
  aws route53 get-hosted-zone \
    --id "$zone_id" \
    --query 'DelegationSet.NameServers' \
    --output json
}

# Check if NS delegation exists in parent zone
check_ns_delegation() {
  local parent_zone_id="$1"
  local subdomain="$2"

  local result
  result=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$parent_zone_id" \
    --query "ResourceRecordSets[?Name=='${subdomain}.' && Type=='NS']" \
    --output json)

  if [[ "$result" == "[]" ]]; then
    return 1
  else
    return 0
  fi
}

# Create NS delegation in parent zone
create_ns_delegation() {
  local parent_zone_id="$1"
  local subdomain="$2"
  local nameservers="$3"

  # Build resource records array
  local resource_records
  resource_records=$(echo "$nameservers" | jq '[.[] | {Value: .}]')

  local change_batch
  change_batch=$(jq -n \
    --arg subdomain "$subdomain" \
    --argjson records "$resource_records" \
    '{
      Comment: "Delegate \($subdomain) to its own hosted zone",
      Changes: [{
        Action: "CREATE",
        ResourceRecordSet: {
          Name: $subdomain,
          Type: "NS",
          TTL: 300,
          ResourceRecords: $records
        }
      }]
    }')

  aws route53 change-resource-record-sets \
    --hosted-zone-id "$parent_zone_id" \
    --change-batch "$change_batch" \
    --output json
}

# Wait for Route53 change to sync
wait_for_change() {
  local change_id="$1"
  local max_attempts=30
  local attempt=0

  log_info "Waiting for DNS changes to propagate..."

  while [[ $attempt -lt $max_attempts ]]; do
    local status
    status=$(aws route53 get-change --id "$change_id" --query 'ChangeInfo.Status' --output text)

    if [[ "$status" == "INSYNC" ]]; then
      log_info "DNS changes propagated successfully"
      return 0
    fi

    sleep 2
    ((attempt++))
  done

  log_warn "Timed out waiting for DNS propagation (changes may still be in progress)"
  return 0
}

# Verify NS delegation is working
verify_delegation() {
  local domain="$1"
  local expected_ns="$2"

  log_info "Verifying NS delegation for: $domain"

  # Get one of the expected nameservers to query
  local ns_to_query
  ns_to_query=$(echo "$expected_ns" | jq -r '.[0]')

  # Query the parent zone's nameserver
  local parent_domain
  parent_domain=$(get_parent_domain "$domain")

  local parent_ns
  parent_ns=$(dig NS "$parent_domain" +short | head -1)

  if [[ -z "$parent_ns" ]]; then
    log_warn "Could not determine parent nameserver for verification"
    return 0
  fi

  # Query parent NS for subdomain delegation
  local result
  result=$(dig NS "$domain" "@${parent_ns}" +short 2>/dev/null || echo "")

  if [[ -n "$result" ]]; then
    log_info "NS delegation verified successfully:"
    echo "$result" | while read -r ns; do
      echo "    $ns"
    done
    return 0
  else
    log_warn "NS delegation not yet visible (DNS propagation may take a few minutes)"
    return 0
  fi
}

# Create Route53 Hosted Zone and configure NS delegation
create_hosted_zone() {
  local domain="$1"
  local zone_id=""
  local nameservers=""
  local created_new=false

  log_step "Checking if hosted zone exists for: $domain"

  # Check if hosted zone already exists
  zone_id=$(get_hosted_zone_id "$domain")

  if [[ -n "$zone_id" && "$zone_id" != "None" ]]; then
    log_warn "Hosted zone already exists for $domain (ID: $zone_id)"
    nameservers=$(get_nameservers "$zone_id")
  else
    log_step "Creating hosted zone for: $domain"

    local result
    result=$(aws route53 create-hosted-zone \
      --name "$domain" \
      --caller-reference "idp-$(date +%s)" \
      --hosted-zone-config Comment="IDP hosted zone for $domain" \
      --query '{ZoneId: HostedZone.Id, NameServers: DelegationSet.NameServers}' \
      --output json)

    zone_id=$(echo "$result" | jq -r '.ZoneId' | sed 's|/hostedzone/||')
    nameservers=$(echo "$result" | jq '.NameServers')
    created_new=true

    log_info "Created hosted zone: $zone_id"
  fi

  echo ""
  log_info "Hosted zone nameservers:"
  echo "$nameservers" | jq -r '.[]' | while read -r ns; do
    echo "    $ns"
  done
  echo ""

  # Handle NS delegation if not skipped
  if [[ "$SKIP_DELEGATION" == true ]]; then
    log_warn "Skipping NS delegation (--skip-delegation specified)"
    log_info "You must manually configure NS delegation in your parent zone or domain registrar"
    return 0
  fi

  # Check if this is a subdomain (has more than 2 parts)
  local domain_parts
  domain_parts=$(echo "$domain" | tr '.' '\n' | wc -l)

  if [[ $domain_parts -le 2 ]]; then
    log_info "Domain appears to be a root domain (not a subdomain)"
    log_info "Configure these nameservers in your domain registrar"
    return 0
  fi

  # This is a subdomain - try to set up NS delegation
  local parent_domain
  parent_domain=$(get_parent_domain "$domain")

  log_step "Checking for parent zone: $parent_domain"

  local parent_zone_id
  parent_zone_id=$(get_hosted_zone_id "$parent_domain")

  if [[ -z "$parent_zone_id" || "$parent_zone_id" == "None" ]]; then
    log_warn "Parent zone $parent_domain not found in Route53"
    log_info "You must manually configure NS delegation:"
    log_info "  1. Add NS records for '$domain' in your parent zone"
    log_info "  2. Use these nameservers:"
    echo "$nameservers" | jq -r '.[]' | while read -r ns; do
      echo "       $ns"
    done
    return 0
  fi

  log_info "Found parent zone: $parent_domain (ID: $parent_zone_id)"

  # Check if NS delegation already exists
  log_step "Checking NS delegation in parent zone..."

  if check_ns_delegation "$parent_zone_id" "$domain"; then
    log_warn "NS delegation already exists in parent zone"
    verify_delegation "$domain" "$nameservers"
    return 0
  fi

  # Create NS delegation
  log_step "Creating NS delegation in parent zone..."

  local change_result
  change_result=$(create_ns_delegation "$parent_zone_id" "$domain" "$nameservers")

  local change_id
  change_id=$(echo "$change_result" | jq -r '.ChangeInfo.Id')

  log_info "NS delegation created (Change ID: $change_id)"

  # Wait for propagation
  wait_for_change "$change_id"

  # Verify
  echo ""
  verify_delegation "$domain" "$nameservers"
}

# Create or update secret
create_or_update_secret() {
  local secret_name="$1"
  local client_id="$2"
  local client_secret="$3"
  local include_server_key="${4:-false}"

  local secret_value
  if [[ "$include_server_key" == "true" ]]; then
    # ArgoCD needs server_secretkey for signing tokens
    local server_secretkey
    server_secretkey=$(openssl rand -base64 32)
    secret_value=$(jq -n \
      --arg id "$client_id" \
      --arg secret "$client_secret" \
      --arg serverkey "$server_secretkey" \
      '{client_id: $id, client_secret: $secret, server_secretkey: $serverkey}')
  else
    secret_value=$(jq -n \
      --arg id "$client_id" \
      --arg secret "$client_secret" \
      '{client_id: $id, client_secret: $secret}')
  fi

  log_step "Checking if secret exists: $secret_name"

  # Check if secret exists
  if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" &>/dev/null; then
    log_warn "Secret $secret_name already exists, updating..."
    aws secretsmanager put-secret-value \
      --secret-id "$secret_name" \
      --secret-string "$secret_value" \
      --region "$REGION" \
      --output yaml
    log_info "Updated secret: $secret_name"
  else
    log_step "Creating secret: $secret_name"
    aws secretsmanager create-secret \
      --name "$secret_name" \
      --secret-string "$secret_value" \
      --region "$REGION" \
      --tags "Key=Purpose,Value=IDP" "Key=Component,Value=github-oauth" \
      --output yaml
    log_info "Created secret: $secret_name"
  fi
}

# Main execution
echo ""
echo "==========================================="
echo "       IDP Pre-Deployment Setup"
echo "==========================================="
echo ""

if [[ "$SKIP_HOSTED_ZONE" == false ]]; then
  echo "-------------------------------------------"
  echo "  Step 1: Route53 Hosted Zone & Delegation"
  echo "-------------------------------------------"
  echo ""
  create_hosted_zone "$DOMAIN"
  echo ""
else
  log_info "Skipping Route53 hosted zone creation"
  echo ""
fi

if [[ "$SKIP_SECRETS" == false ]]; then
  echo "-------------------------------------------"
  echo "  Step 2: AWS Secrets Manager Secrets"
  echo "-------------------------------------------"
  echo ""

  BACKSTAGE_SECRET_NAME="${PREFIX}-backstage-github-oauth"
  ARGOCD_SECRET_NAME="${PREFIX}-argocd-github-oauth"

  create_or_update_secret "$BACKSTAGE_SECRET_NAME" "$BACKSTAGE_CLIENT_ID" "$BACKSTAGE_CLIENT_SECRET"
  echo ""
  create_or_update_secret "$ARGOCD_SECRET_NAME" "$ARGOCD_CLIENT_ID" "$ARGOCD_CLIENT_SECRET" "true"
  echo ""
else
  log_info "Skipping secrets creation"
  echo ""
fi

echo "==========================================="
echo ""
log_info "Pre-deployment setup complete!"
echo ""

if [[ "$SKIP_HOSTED_ZONE" == false || "$SKIP_SECRETS" == false ]]; then
  echo "Next steps:"
  echo ""
  if [[ "$SKIP_HOSTED_ZONE" == false ]]; then
    echo "  1. Verify DNS propagation:"
    echo "     dig NS $DOMAIN +short"
    echo ""
  fi
  echo "  2. Deploy the IDP stack:"
  echo ""
  echo "     cdk deploy --all \\"
  if [[ -n "$DOMAIN" ]]; then
    echo "       -c deployment:domain=$DOMAIN \\"
  fi
  if [[ -n "$PREFIX" ]]; then
    echo "       -c deployment:github:oauth:backstage=${PREFIX}-backstage-github-oauth \\"
    echo "       -c deployment:github:oauth:argocd=${PREFIX}-argocd-github-oauth \\"
  fi
  echo "       -c deployment:github:org=YOUR_GITHUB_ORG"
  echo ""
fi
echo "==========================================="
