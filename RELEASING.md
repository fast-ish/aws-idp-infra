# Releasing

This document describes the release process for aws-backstage-infra.

## Version Scheme

This project uses [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE]
```

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- **PRERELEASE**: Optional suffix (e.g., `-rc1`, `-beta`)

## Release Types

### Standard Release

For production-ready releases:
```
v1.0.0, v1.1.0, v2.0.0
```

### Pre-release

For testing before production:
```
v1.0.0-rc1, v1.0.0-beta, v2.0.0-alpha
```

## Release Process

### 1. Prepare Release

1. Ensure all changes are merged to `main`
2. Update `CHANGELOG.md` with release notes
3. Create release notes file (optional):
   ```bash
   cp releases/TEMPLATE.md releases/v1.0.0.md
   # Edit with release details
   ```

### 2. Create Release (Automated)

#### Option A: Tag Push
```bash
git tag v1.0.0
git push origin v1.0.0
```

#### Option B: GitHub UI
1. Go to Actions → "Publish Release"
2. Click "Run workflow"
3. Enter version (e.g., `1.0.0`)
4. Optionally set as draft or pre-release
5. Click "Run workflow"

### 3. Verify Release

1. Check [Releases page](https://github.com/stxkxs/aws-backstage-infra/releases)
2. Verify artifacts are attached
3. Verify release notes are correct
4. Test deployment from release

## Workflow Details

The `publish-release.yml` workflow:

1. **Validates** version format
2. **Builds** and tests the project
3. **Creates** GitHub release
4. **Uploads** JAR artifacts with checksums
5. **Updates** CHANGELOG.md on main branch
6. **Notifies** of release status

## Release Artifacts

Each release includes:

| Artifact | Description |
|----------|-------------|
| `aws-backstage-infra-X.Y.Z.jar` | Main JAR file |
| `aws-backstage-infra-X.Y.Z.jar.sha256` | JAR checksum |
| `aws-backstage-infra-X.Y.Z-sources.jar` | Source code JAR |
| `aws-backstage-infra-X.Y.Z-sources.jar.sha256` | Sources checksum |
| `aws-backstage-infra-X.Y.Z.pom` | Maven POM file |

## Release Notes

### Template

```markdown
## Release vX.Y.Z

### Release Date: YYYY-MM-DD

### Highlights
- Key feature or fix

### Changes

#### Features
- feat: description (#issue)

#### Bug Fixes
- fix: description (#issue)

#### Documentation
- docs: description

### Breaking Changes
- Description of breaking change

### Upgrade Notes
Steps required to upgrade from previous version

### Contributors
- @username
```

### Auto-generated Notes

If no `releases/vX.Y.Z.md` file exists, notes are auto-generated from:
- Commit messages since last tag
- Categorized by type (feat, fix, docs, etc.)
- Contributors list

## Hotfix Process

For urgent fixes to production:

1. Create branch from release tag:
   ```bash
   git checkout -b hotfix/v1.0.1 v1.0.0
   ```

2. Make and commit fix

3. Tag and release:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. Merge back to main:
   ```bash
   git checkout main
   git merge hotfix/v1.0.1
   ```

## Rollback

To rollback a release:

1. Deploy previous version:
   ```bash
   # Get previous release JAR
   gh release download v1.0.0

   # Or revert CDK deployment
   cdk deploy --context version=1.0.0
   ```

2. If needed, yank the release:
   ```bash
   gh release delete v1.0.1 --yes
   git push --delete origin v1.0.1
   ```

## Post-Release

After release:

1. Announce in appropriate channels
2. Update any dependent projects
3. Monitor for issues
4. Start next development cycle
