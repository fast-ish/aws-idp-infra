# Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no feature or bug fix) |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system or external dependency changes |
| `ci` | CI configuration changes |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

## Scopes

Common scopes for this project:

| Scope | Description |
|-------|-------------|
| `helm` | Helm chart changes |
| `cdk` | CDK stack changes |
| `database` | Database configuration |
| `secrets` | Secrets management |
| `network` | Network/VPC changes |
| `iam` | IAM policies and roles |
| `karpenter` | Karpenter configuration |
| `ingress` | Ingress/ALB configuration |
| `deps` | Dependency updates |
| `ci` | GitHub Actions workflows |

## Examples

### Feature
```
feat(helm): add horizontal pod autoscaler support

- Add HPA template to Helm chart
- Configure min/max replicas in values.yaml
- Add CPU/memory target utilization settings
```

### Bug Fix
```
fix(database): correct Aurora connection pool settings

The connection pool was exhausting under load due to
incorrect max connections setting.

Fixes #42
```

### Documentation
```
docs(readme): update deployment prerequisites

Add Helm 3.x requirement and AWS CLI version
```

### Refactor
```
refactor(cdk): extract common VPC configuration

Move VPC configuration to shared method for reuse
across multiple stacks.
```

### Breaking Change
```
feat(helm)!: change service port from 3000 to 7007

BREAKING CHANGE: The default service port has changed.
Update any external configurations that reference the old port.
```

## Best Practices

1. **Keep commits atomic**: Each commit should represent one logical change
2. **Write clear descriptions**: First line should be clear and concise (50 chars max)
3. **Use imperative mood**: "Add feature" not "Added feature"
4. **Reference issues**: Include issue numbers when applicable
5. **Explain why, not what**: The code shows what changed; explain why

## Validation

Commit messages are validated by CI. Invalid messages will fail the PR checks.

### Valid
```
feat(helm): add resource limits configuration
fix: resolve null pointer in template processing
docs: update contributing guidelines
```

### Invalid
```
Fixed bug              # Missing type
feat: Add new feature  # Should be lowercase
feature(helm): add x   # Invalid type
```
