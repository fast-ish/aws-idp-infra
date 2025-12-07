# Local Validation

This guide covers how to validate changes locally before pushing.

## Prerequisites

```bash
# Required tools
java --version    # 21+
mvn --version     # 3.8+
cdk --version     # 2.x
kubectl version   # 1.28+
helm version      # 3.x
```

## Quick Validation

Run all checks:
```bash
mvn clean verify
```

This executes:
- Compilation
- Unit tests
- Checkstyle
- SpotBugs
- PMD
- Dependency check

## Individual Checks

### Build
```bash
mvn clean compile
```

### Unit Tests
```bash
mvn test
```

### Code Style (Checkstyle)
```bash
mvn checkstyle:check
```

### Static Analysis (SpotBugs)
```bash
mvn spotbugs:check
```

### Code Formatting (Spotless)
```bash
# Check formatting
mvn spotless:check

# Auto-fix formatting
mvn spotless:apply
```

### Security (Dependency Check)
```bash
mvn dependency-check:check
```

### PMD Analysis
```bash
mvn pmd:check
```

## CDK Validation

### Synthesize CloudFormation
```bash
cdk synth
```

### Diff Against Deployed
```bash
cdk diff
```

### List Stacks
```bash
cdk ls
```

## Helm Chart Validation

### Lint Chart
```bash
helm lint helm/chart/backstage
```

### Template Rendering
```bash
helm template backstage helm/chart/backstage \
  --namespace backstage \
  --set image.tag=latest
```

### Dry Run Install
```bash
helm install backstage helm/chart/backstage \
  --namespace backstage \
  --dry-run
```

## Configuration Validation

### Validate YAML Syntax
```bash
# Using Python
python -c "import yaml; yaml.safe_load(open('file.yaml'))"

# Using yq
yq eval '.' file.yaml
```

### Validate Mustache Templates
```bash
# Build will fail if templates are invalid
mvn compile
```

## Pre-Push Checklist

Before pushing changes:

- [ ] `mvn clean verify` passes
- [ ] `cdk synth` succeeds
- [ ] `helm lint` passes
- [ ] All new code has tests
- [ ] Documentation updated
- [ ] Commit messages follow conventions

## IDE Integration

### IntelliJ IDEA

1. Import Checkstyle configuration:
   - Settings → Editor → Code Style → Java → Import Scheme
   - Select `checkstyle.xml`

2. Enable Checkstyle plugin:
   - Settings → Plugins → Install "CheckStyle-IDEA"
   - Configure with project's `checkstyle.xml`

3. Enable SpotBugs plugin:
   - Settings → Plugins → Install "SpotBugs"
   - Configure with project's `spotbugs-exclude.xml`

### VS Code

1. Install Java Extension Pack
2. Install Checkstyle for Java extension
3. Configure workspace settings for checkstyle path

## Troubleshooting

### Maven Cache Issues
```bash
rm -rf ~/.m2/repository/fasti
mvn clean install -U
```

### CDK Context Issues
```bash
rm cdk.context.json
cp cdk.context.template.json cdk.context.json
# Re-edit with your values
```

### Helm Dependency Issues
```bash
helm dependency update helm/chart/backstage
```
