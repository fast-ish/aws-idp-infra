#!/bin/bash
set -euo pipefail

# CDK Template Validation Script
# This script synthesizes CDK templates and validates them using cfn-lint

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CDK_OUT_DIR="${PROJECT_DIR}/cdk.out"

echo "=================================="
echo "CDK Template Validation"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if cfn-lint is installed
if ! command -v cfn-lint &> /dev/null; then
    echo -e "${YELLOW}Warning: cfn-lint not found. Installing...${NC}"
    pip3 install cfn-lint --quiet || {
        echo -e "${RED}Failed to install cfn-lint. Please install it manually:${NC}"
        echo "  pip3 install cfn-lint"
        exit 1
    }
fi

# Step 1: Clean previous artifacts
echo "Step 1: Cleaning previous artifacts..."
if [ -d "${CDK_OUT_DIR}" ]; then
    rm -rf "${CDK_OUT_DIR}"
    echo -e "${GREEN}✓${NC} Cleaned cdk.out directory"
else
    echo -e "${GREEN}✓${NC} No previous artifacts found"
fi

# Step 2: Synthesize CDK templates
echo ""
echo "Step 2: Synthesizing CDK templates..."
cd "${PROJECT_DIR}"

if mvn exec:java -Dexec.mainClass="fasti.sh.execute.Build" -q; then
    echo -e "${GREEN}✓${NC} CDK synthesis completed successfully"
else
    echo -e "${RED}✗${NC} CDK synthesis failed"
    exit 1
fi

# Step 3: Validate CloudFormation templates with cfn-lint
echo ""
echo "Step 3: Validating CloudFormation templates with cfn-lint..."

if [ ! -d "${CDK_OUT_DIR}" ]; then
    echo -e "${RED}✗${NC} cdk.out directory not found. Synthesis may have failed."
    exit 1
fi

# Find all CloudFormation template files
TEMPLATE_FILES=$(find "${CDK_OUT_DIR}" -name "*.template.json" -type f)

if [ -z "${TEMPLATE_FILES}" ]; then
    echo -e "${YELLOW}Warning: No CloudFormation templates found in ${CDK_OUT_DIR}${NC}"
    exit 0
fi

VALIDATION_FAILED=0
TEMPLATE_COUNT=0

for template in ${TEMPLATE_FILES}; do
    TEMPLATE_COUNT=$((TEMPLATE_COUNT + 1))
    template_name=$(basename "${template}")

    echo ""
    echo "  Validating: ${template_name}"

    if cfn-lint "${template}" --format parseable; then
        echo -e "  ${GREEN}✓${NC} ${template_name} passed validation"
    else
        echo -e "  ${RED}✗${NC} ${template_name} failed validation"
        VALIDATION_FAILED=1
    fi
done

# Summary
echo ""
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo "Templates synthesized: ${TEMPLATE_COUNT}"

if [ ${VALIDATION_FAILED} -eq 0 ]; then
    echo -e "${GREEN}✓ All templates passed validation${NC}"
    exit 0
else
    echo -e "${RED}✗ Some templates failed validation${NC}"
    echo ""
    echo "To fix validation errors:"
    echo "  1. Review the cfn-lint errors above"
    echo "  2. Update your CDK constructs to fix the issues"
    echo "  3. Re-run this script to validate"
    exit 1
fi
