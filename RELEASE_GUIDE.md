# Release Guide

Step-by-step guide for creating releases.

## Pre-Release Checklist

Before starting a release:

- [ ] All PRs merged to main
- [ ] CI passing on main branch
- [ ] CHANGELOG.md updated
- [ ] Documentation current
- [ ] No critical issues open

## Release Steps

### 1. Determine Version

Based on changes since last release:

| Change Type | Version Bump |
|-------------|--------------|
| Breaking changes | Major (X.0.0) |
| New features | Minor (0.X.0) |
| Bug fixes only | Patch (0.0.X) |

### 2. Update Changelog

Edit `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Changed behavior

### Fixed
- Bug fix description
```

### 3. Create Release Notes (Optional)

For detailed releases:

```bash
cp releases/TEMPLATE.md releases/v1.2.0.md
# Edit with release details
```

### 4. Create Release

#### Option A: Git Tag

```bash
# Ensure on main branch
git checkout main
git pull

# Create and push tag
git tag v1.2.0
git push origin v1.2.0
```

#### Option B: GitHub Actions

1. Go to Actions tab
2. Select "Publish Release" workflow
3. Click "Run workflow"
4. Enter version: `1.2.0`
5. Click "Run workflow"

### 5. Verify Release

1. Check [Releases page](https://github.com/stxkxs/aws-backstage-infra/releases)
2. Verify:
   - Release notes correct
   - Artifacts attached
   - No workflow errors

### 6. Post-Release

1. Announce release
2. Update dependent projects
3. Monitor for issues

## Hotfix Release

For urgent production fixes:

```bash
# Create hotfix branch
git checkout -b hotfix/1.2.1 v1.2.0

# Make fix
git commit -m "fix: critical bug"

# Release
git tag v1.2.1
git push origin v1.2.1

# Merge to main
git checkout main
git merge hotfix/1.2.1
git push
```

## Rollback

If release has issues:

```bash
# Delete release (GitHub UI or CLI)
gh release delete v1.2.0 --yes

# Delete tag
git push --delete origin v1.2.0
git tag -d v1.2.0

# Deploy previous version
cdk deploy --context version=1.1.0
```

## Version History

Track major releases:

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2024-XX-XX | Initial release |

## FAQ

**Q: Can I release from a branch other than main?**
A: Not recommended. Always release from main.

**Q: What if the release workflow fails?**
A: Fix the issue, delete the partial release, and retry.

**Q: How do I make a pre-release?**
A: Use version suffix: `1.2.0-rc1` or select "pre-release" in workflow.
