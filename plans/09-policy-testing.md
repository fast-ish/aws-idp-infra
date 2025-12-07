# Plan 09: Policy Testing & Validation

## Objective
Add automated testing for Kyverno policies and GitOps configuration validation in CI.

## Context
- 31 Kyverno policies exist but no tests
- GitOps YAML files not validated before merge
- Need pre-commit hooks and CI checks

## Part 1: Kyverno Policy Testing

### Testing Framework Options

| Tool | Pros | Cons |
|------|------|------|
| **Chainsaw** | Kyverno-native, declarative | Newer, less documentation |
| **kuttl** | Mature, widely used | More verbose |
| **Policy CLI** | Simple, quick | Limited scenarios |

**Recommendation:** Chainsaw (Kyverno's official testing tool)

### Install Chainsaw
```bash
# Install
brew install kyverno/tap/chainsaw

# Or via Go
go install github.com/kyverno/chainsaw@latest
```

### Test Structure
```
aws-idp-gitops/platform/kyverno/policies/
├── baseline/
│   ├── disallow-privileged.yaml
│   └── tests/
│       └── disallow-privileged/
│           ├── chainsaw-test.yaml
│           ├── allowed-pod.yaml
│           └── denied-pod.yaml
├── security/
│   ├── require-non-root.yaml
│   └── tests/
│       └── require-non-root/
│           ├── chainsaw-test.yaml
│           ├── allowed-pod.yaml
│           └── denied-pod.yaml
└── ...
```

### Example Test: disallow-privileged

#### chainsaw-test.yaml
```yaml
apiVersion: chainsaw.kyverno.io/v1alpha1
kind: Test
metadata:
  name: disallow-privileged-containers
spec:
  steps:
    # Test 1: Privileged container should be denied
    - name: deny-privileged
      try:
        - apply:
            file: denied-pod.yaml
            expect:
              - check:
                  ($error != null): true
                  ($error): contains "Privileged containers are not allowed"

    # Test 2: Non-privileged container should be allowed
    - name: allow-non-privileged
      try:
        - apply:
            file: allowed-pod.yaml
        - assert:
            file: allowed-pod.yaml
```

#### denied-pod.yaml
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-privileged-denied
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:latest
      securityContext:
        privileged: true
```

#### allowed-pod.yaml
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-non-privileged-allowed
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:latest
      securityContext:
        privileged: false
        runAsNonRoot: true
        runAsUser: 1000
```

### Tests for Each Policy Category

#### Baseline Security Tests
```yaml
# Test: disallow-host-namespaces
- deny pod with hostPID: true
- deny pod with hostIPC: true
- deny pod with hostNetwork: true
- allow pod without host namespaces

# Test: disallow-host-ports
- deny pod with hostPort specified
- allow pod without hostPort

# Test: disallow-capabilities
- deny pod with NET_RAW capability
- deny pod with SYS_ADMIN capability
- allow pod with only allowed capabilities
```

#### Security Tests
```yaml
# Test: require-non-root
- deny pod without runAsNonRoot
- deny pod with runAsUser: 0
- allow pod with runAsNonRoot: true and runAsUser: 1000

# Test: require-readonly-rootfs
- deny pod without readOnlyRootFilesystem
- allow pod with readOnlyRootFilesystem: true

# Test: restrict-image-registries
- deny pod with docker.io image
- deny pod with quay.io image
- allow pod with ECR image
- allow pod with ghcr.io image
```

#### Generator Tests
```yaml
# Test: generate-network-policy
- create namespace
- verify NetworkPolicy is generated
- verify policy has correct ingress/egress rules

# Test: generate-resource-quota
- create namespace with team label
- verify ResourceQuota is generated
- verify quota limits match team tier
```

### Run Tests Locally
```bash
# Run all policy tests
chainsaw test --test-dir platform/kyverno/policies/

# Run specific policy test
chainsaw test --test-dir platform/kyverno/policies/baseline/tests/disallow-privileged/

# With verbose output
chainsaw test --test-dir platform/kyverno/policies/ -v 3
```

## Part 2: GitOps Configuration Validation

### Tools

| Tool | Purpose |
|------|---------|
| **kubeconform** | Kubernetes schema validation |
| **kustomize build** | Kustomize syntax validation |
| **helm lint** | Helm chart validation |
| **yamllint** | YAML syntax |
| **kubeval** | Alternative to kubeconform |

### Install Tools
```bash
brew install kubeconform yamllint kustomize helm
```

### Validation Script
```bash
#!/bin/bash
# scripts/validate-gitops.sh

set -e

GITOPS_DIR="${1:-aws-idp-gitops}"

echo "=== YAML Lint ==="
yamllint -c .yamllint.yml "$GITOPS_DIR"

echo "=== Kustomize Build ==="
for dir in $(find "$GITOPS_DIR" -name kustomization.yaml -exec dirname {} \;); do
  echo "Building: $dir"
  kustomize build "$dir" > /dev/null
done

echo "=== Kubeconform ==="
find "$GITOPS_DIR" -name '*.yaml' -not -path '*/charts/*' | xargs kubeconform \
  -schema-location default \
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
  -skip CustomResourceDefinition \
  -summary

echo "=== All validations passed ==="
```

### .yamllint.yml
```yaml
extends: default

rules:
  line-length:
    max: 200
    level: warning
  truthy:
    allowed-values: ['true', 'false', 'yes', 'no']
  comments:
    min-spaces-from-content: 1
  indentation:
    spaces: 2
    indent-sequences: consistent

ignore: |
  **/charts/
  **/.git/
```

### GitHub Actions Workflow
```yaml
# .github/workflows/validate.yml
name: Validate GitOps

on:
  pull_request:
    paths:
      - 'platform/**'
      - 'clusters/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install tools
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          sudo mv kubeconform /usr/local/bin/
          pip install yamllint

      - name: YAML Lint
        run: yamllint -c .yamllint.yml .

      - name: Kubeconform
        run: |
          find . -name '*.yaml' -not -path './charts/*' | xargs kubeconform \
            -schema-location default \
            -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
            -skip CustomResourceDefinition \
            -summary

      - name: Kustomize Build
        run: |
          for dir in $(find . -name kustomization.yaml -exec dirname {} \;); do
            echo "Building: $dir"
            kustomize build "$dir" > /dev/null
          done

  policy-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Chainsaw
        run: |
          curl -sL https://github.com/kyverno/chainsaw/releases/latest/download/chainsaw_linux_amd64.tar.gz | tar xz
          sudo mv chainsaw /usr/local/bin/

      - name: Setup Kind Cluster
        uses: helm/kind-action@v1

      - name: Install Kyverno
        run: |
          helm repo add kyverno https://kyverno.github.io/kyverno/
          helm install kyverno kyverno/kyverno -n kyverno --create-namespace --wait

      - name: Apply Policies
        run: kubectl apply -f platform/kyverno/policies/ --recursive

      - name: Run Policy Tests
        run: chainsaw test --test-dir platform/kyverno/policies/
```

## Part 3: Pre-commit Hooks

### .pre-commit-config.yaml
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
        args: ['--unsafe']  # Allow custom tags
      - id: check-added-large-files

  - repo: https://github.com/adrienverge/yamllint
    rev: v1.33.0
    hooks:
      - id: yamllint
        args: [-c, .yamllint.yml]

  - repo: local
    hooks:
      - id: kubeconform
        name: kubeconform
        entry: kubeconform -schema-location default -skip CustomResourceDefinition
        language: system
        files: \.yaml$
        exclude: charts/

      - id: kustomize-build
        name: kustomize-build
        entry: bash -c 'kustomize build $(dirname "$1") > /dev/null' --
        language: system
        files: kustomization\.yaml$
```

### Install Pre-commit
```bash
pip install pre-commit
pre-commit install
```

## Implementation Checklist

### Policy Testing
- [ ] Install Chainsaw
- [ ] Create test structure in policies directory
- [ ] Write tests for baseline policies (4)
- [ ] Write tests for security policies (6)
- [ ] Write tests for compliance policies (3)
- [ ] Write tests for generator policies (2)
- [ ] Add CI workflow for policy tests

### GitOps Validation
- [ ] Create validation script
- [ ] Add .yamllint.yml configuration
- [ ] Add GitHub Actions workflow
- [ ] Test kubeconform with CRD schemas

### Pre-commit
- [ ] Create .pre-commit-config.yaml
- [ ] Install pre-commit in repo
- [ ] Document in CONTRIBUTING.md

## Success Criteria
- [ ] All 31 policies have passing tests
- [ ] CI blocks PRs with invalid YAML
- [ ] CI blocks PRs that fail policy tests
- [ ] Pre-commit catches issues locally
- [ ] Documentation updated

## Notes
- Policy tests need a Kind cluster with Kyverno
- Cache CRD schemas for faster CI
- Consider Datree for additional policy checks
- Run tests in parallel for speed
