#!/usr/bin/env bash
set -euo pipefail

#
# Total Destruction Script for AWS Infrastructure
# Usage: ./destroy.sh <deployment-id>
# Example: ./destroy.sh smash
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for deployment ID argument
if [[ $# -lt 1 ]]; then
    echo -e "${RED}Usage: $0 <deployment-id>${NC}"
    echo -e "Example: $0 smash"
    exit 1
fi

DEPLOYMENT_ID="$1"
STACK_NAME="${DEPLOYMENT_ID}-idp"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           TOTAL DESTRUCTION - ${STACK_NAME}${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Confirmation
echo -e "${RED}WARNING: This will permanently delete ALL resources for ${DEPLOYMENT_ID}${NC}"
echo -e "${YELLOW}Resources to be deleted:${NC}"
echo "  - CloudFormation stacks"
echo "  - RDS instances and clusters"
echo "  - S3 buckets"
echo "  - Secrets Manager secrets"
echo "  - ACM certificates"
echo "  - KMS keys (scheduled for deletion)"
echo "  - Route53 hosted zone records"
echo ""
read -p "Type '${DEPLOYMENT_ID}' to confirm destruction: " CONFIRM

if [[ "$CONFIRM" != "$DEPLOYMENT_ID" ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Starting destruction sequence...${NC}"
echo ""

# Function to delete S3 buckets
delete_s3_buckets() {
    echo -e "${BLUE}▶ Deleting S3 buckets...${NC}"
    local buckets=$(aws s3api list-buckets --query "Buckets[?contains(Name, '${DEPLOYMENT_ID}')].Name" --output text 2>/dev/null || true)

    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            echo -e "  Deleting bucket: ${bucket}"
            aws s3 rb "s3://${bucket}" --force 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not delete ${bucket}${NC}"
        done
        echo -e "${GREEN}  ✓ S3 buckets deleted${NC}"
    else
        echo -e "  No S3 buckets found"
    fi
    echo ""
}

# Function to delete RDS instances and clusters
delete_rds() {
    echo -e "${BLUE}▶ Deleting RDS instances and clusters...${NC}"

    # Delete DB instances first
    local instances=$(aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, '${DEPLOYMENT_ID}')].DBInstanceIdentifier" --output text 2>/dev/null || true)

    if [[ -n "$instances" ]]; then
        for instance in $instances; do
            echo -e "  Deleting DB instance: ${instance}"
            aws rds delete-db-instance \
                --db-instance-identifier "$instance" \
                --skip-final-snapshot \
                --delete-automated-backups 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not delete ${instance}${NC}"
        done
    fi

    # Wait a moment for instances to start deleting
    sleep 5

    # Delete DB clusters
    local clusters=$(aws rds describe-db-clusters --query "DBClusters[?contains(DBClusterIdentifier, '${DEPLOYMENT_ID}')].DBClusterIdentifier" --output text 2>/dev/null || true)

    if [[ -n "$clusters" ]]; then
        for cluster in $clusters; do
            echo -e "  Deleting DB cluster: ${cluster}"
            aws rds delete-db-cluster \
                --db-cluster-identifier "$cluster" \
                --skip-final-snapshot 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not delete ${cluster}${NC}"
        done
        echo -e "${GREEN}  ✓ RDS deletion initiated${NC}"
    else
        echo -e "  No RDS clusters found"
    fi
    echo ""
}

# Function to delete Secrets Manager secrets
delete_secrets() {
    echo -e "${BLUE}▶ Deleting Secrets Manager secrets...${NC}"
    local secrets=$(aws secretsmanager list-secrets --query "SecretList[?contains(Name, '${DEPLOYMENT_ID}')].Name" --output text 2>/dev/null || true)

    if [[ -n "$secrets" ]]; then
        for secret in $secrets; do
            echo -e "  Deleting secret: ${secret}"
            aws secretsmanager delete-secret \
                --secret-id "$secret" \
                --force-delete-without-recovery 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not delete ${secret}${NC}"
        done
        echo -e "${GREEN}  ✓ Secrets deleted${NC}"
    else
        echo -e "  No secrets found"
    fi
    echo ""
}

# Function to delete ACM certificates
delete_acm_certificates() {
    echo -e "${BLUE}▶ Deleting ACM certificates...${NC}"
    local certs=$(aws acm list-certificates --query "CertificateSummaryList[*].[CertificateArn,DomainName]" --output text 2>/dev/null || true)

    if [[ -n "$certs" ]]; then
        while IFS=$'\t' read -r arn domain; do
            # Check if cert has tags matching our deployment
            local tags=$(aws acm list-tags-for-certificate --certificate-arn "$arn" --query "Tags[?contains(Value, '${DEPLOYMENT_ID}')].Value" --output text 2>/dev/null || true)
            if [[ -n "$tags" ]]; then
                echo -e "  Deleting certificate: ${domain}"
                aws acm delete-certificate --certificate-arn "$arn" 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not delete ${domain} (may be in use)${NC}"
            fi
        done <<< "$certs"
        echo -e "${GREEN}  ✓ ACM certificates processed${NC}"
    else
        echo -e "  No ACM certificates found"
    fi
    echo ""
}

# Function to schedule KMS keys for deletion
delete_kms_keys() {
    echo -e "${BLUE}▶ Scheduling KMS keys for deletion...${NC}"
    local aliases=$(aws kms list-aliases --query "Aliases[?contains(AliasName, '${DEPLOYMENT_ID}')].[AliasName,TargetKeyId]" --output text 2>/dev/null || true)

    if [[ -n "$aliases" ]]; then
        while IFS=$'\t' read -r alias keyid; do
            if [[ -n "$keyid" && "$keyid" != "None" ]]; then
                echo -e "  Scheduling key for deletion: ${alias}"
                # Delete the alias first
                aws kms delete-alias --alias-name "$alias" 2>/dev/null || true
                # Schedule key for deletion (minimum 7 days)
                aws kms schedule-key-deletion --key-id "$keyid" --pending-window-in-days 7 2>/dev/null || echo -e "  ${YELLOW}Warning: Could not schedule ${keyid} for deletion${NC}"
            fi
        done <<< "$aliases"
        echo -e "${GREEN}  ✓ KMS keys scheduled for deletion (7 days)${NC}"
    else
        echo -e "  No KMS keys found"
    fi
    echo ""
}

# Function to clean up Route53 hosted zone
delete_route53_records() {
    echo -e "${BLUE}▶ Cleaning up Route53 records...${NC}"

    # Find hosted zones that might be related
    local zones=$(aws route53 list-hosted-zones --query "HostedZones[*].[Id,Name]" --output text 2>/dev/null || true)

    if [[ -n "$zones" ]]; then
        while IFS=$'\t' read -r zoneid zonename; do
            # Check if zone has records with our deployment ID in TXT records (ExternalDNS owner)
            local records=$(aws route53 list-resource-record-sets --hosted-zone-id "$zoneid" \
                --query "ResourceRecordSets[?Type!='NS' && Type!='SOA']" --output json 2>/dev/null || true)

            if [[ -n "$records" && "$records" != "[]" ]]; then
                # Check for TXT records with our deployment ID (ExternalDNS heritage)
                local heritage_records=$(echo "$records" | jq -r ".[] | select(.ResourceRecords[]?.Value | contains(\"heritage=external-dns,external-dns/owner=${DEPLOYMENT_ID}\")) | .Name" 2>/dev/null || true)

                if [[ -n "$heritage_records" ]]; then
                    echo -e "  Found ExternalDNS records in zone: ${zonename}"
                    # Note: We don't delete these automatically as ExternalDNS should clean them up
                    # when the services are deleted
                fi
            fi
        done <<< "$zones"
    fi
    echo -e "  Route53 records will be cleaned up by ExternalDNS when services are deleted"
    echo ""
}

# Function to delete EKS cluster (if exists outside CloudFormation)
delete_eks_cluster() {
    echo -e "${BLUE}▶ Checking for EKS clusters...${NC}"
    local clusters=$(aws eks list-clusters --query "clusters[?contains(@, '${DEPLOYMENT_ID}')]" --output text 2>/dev/null || true)

    if [[ -n "$clusters" ]]; then
        for cluster in $clusters; do
            echo -e "  Found EKS cluster: ${cluster}"
            echo -e "  ${YELLOW}Note: EKS cluster will be deleted by CloudFormation${NC}"
        done
    else
        echo -e "  No standalone EKS clusters found"
    fi
    echo ""
}

# Function to delete CloudFormation stack
delete_cloudformation_stack() {
    echo -e "${BLUE}▶ Deleting CloudFormation stack: ${STACK_NAME}...${NC}"

    # Check if stack exists
    local stack_status=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
        --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NOT_FOUND")

    if [[ "$stack_status" == "NOT_FOUND" ]]; then
        echo -e "  Stack ${STACK_NAME} does not exist"
        return
    fi

    if [[ "$stack_status" == *"DELETE"* ]]; then
        echo -e "  Stack is already being deleted (status: ${stack_status})"
    else
        echo -e "  Initiating stack deletion..."
        aws cloudformation delete-stack --stack-name "$STACK_NAME" 2>/dev/null || true
    fi

    echo -e "  ${YELLOW}Waiting for stack deletion (this may take 15-30 minutes)...${NC}"

    # Monitor deletion
    while true; do
        local status=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
            --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "DELETED")

        if [[ "$status" == "DELETED" || "$status" == *"ValidationError"* ]]; then
            echo -e "${GREEN}  ✓ Stack deleted successfully${NC}"
            break
        elif [[ "$status" == "DELETE_FAILED" ]]; then
            echo -e "${RED}  ✗ Stack deletion failed${NC}"
            echo -e "  Checking for resources blocking deletion..."
            aws cloudformation describe-stack-events --stack-name "$STACK_NAME" \
                --query "StackEvents[?ResourceStatus=='DELETE_FAILED'].[LogicalResourceId,ResourceStatusReason]" \
                --output table 2>/dev/null || true
            break
        else
            echo -e "  Status: ${status}..."
            sleep 30
        fi
    done
    echo ""
}

# Function to clean up any remaining resources
cleanup_remaining() {
    echo -e "${BLUE}▶ Checking for remaining resources...${NC}"

    # Check for remaining RDS
    local rds_remaining=$(aws rds describe-db-instances \
        --query "DBInstances[?contains(DBInstanceIdentifier, '${DEPLOYMENT_ID}')].DBInstanceIdentifier" \
        --output text 2>/dev/null || true)
    if [[ -n "$rds_remaining" ]]; then
        echo -e "  ${YELLOW}RDS instances still deleting: ${rds_remaining}${NC}"
    fi

    # Check for remaining S3
    local s3_remaining=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, '${DEPLOYMENT_ID}')].Name" \
        --output text 2>/dev/null || true)
    if [[ -n "$s3_remaining" ]]; then
        echo -e "  ${YELLOW}S3 buckets remaining: ${s3_remaining}${NC}"
    fi

    # Check for remaining secrets
    local secrets_remaining=$(aws secretsmanager list-secrets \
        --query "SecretList[?contains(Name, '${DEPLOYMENT_ID}')].Name" \
        --output text 2>/dev/null || true)
    if [[ -n "$secrets_remaining" ]]; then
        echo -e "  ${YELLOW}Secrets remaining: ${secrets_remaining}${NC}"
    fi

    if [[ -z "$rds_remaining" && -z "$s3_remaining" && -z "$secrets_remaining" ]]; then
        echo -e "${GREEN}  ✓ No remaining resources found${NC}"
    fi
    echo ""
}

# Execute destruction sequence
echo -e "${YELLOW}Phase 1: Delete blocking resources${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
delete_s3_buckets
delete_rds
delete_secrets
delete_acm_certificates
delete_kms_keys
delete_route53_records
delete_eks_cluster

echo -e "${YELLOW}Phase 2: Delete CloudFormation stack${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
delete_cloudformation_stack

echo -e "${YELLOW}Phase 3: Cleanup verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cleanup_remaining

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           DESTRUCTION COMPLETE                                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
