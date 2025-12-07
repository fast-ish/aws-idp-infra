# Release Notes

This directory contains release notes for each version.

## Structure

```
releases/
├── README.md       # This file
├── TEMPLATE.md     # Template for new releases
├── v1.0.0.md       # Release notes for v1.0.0
└── v1.1.0.md       # Release notes for v1.1.0
```

## Creating Release Notes

1. Copy the template:
   ```bash
   cp TEMPLATE.md vX.Y.Z.md
   ```

2. Edit with release details

3. Commit and push before releasing

## Auto-Generated Notes

If no release notes file exists, the publish-release workflow will auto-generate notes from:
- Commit messages since last tag
- Categorized by type (feat, fix, docs)
- Contributors list

## Template Sections

- **Highlights**: Key changes in this release
- **Features**: New functionality
- **Bug Fixes**: Issues resolved
- **Breaking Changes**: Changes requiring migration
- **Upgrade Notes**: Steps to upgrade
- **Contributors**: People who contributed
