# Plan 03: TechDocs for All Templates

## Objective
Add MkDocs-based documentation to each software template for Backstage TechDocs integration.

## Context
- Backstage TechDocs is configured with local MkDocs builder
- No templates currently have docs/ directory
- Templates have `backstage.io/techdocs-ref: dir:.` annotation ready

## Structure for Each Template

```
<template>/
├── docs/
│   ├── index.md                    # Overview
│   ├── getting-started.md          # Quick start guide
│   ├── architecture.md             # Design decisions
│   ├── configuration.md            # Environment variables, settings
│   ├── development.md              # Local development guide
│   ├── deployment.md               # Kubernetes deployment
│   ├── infrastructure.md           # AWS resources (if applicable)
│   ├── observability.md            # Metrics, logs, traces
│   ├── troubleshooting.md          # Common issues
│   └── api.md                      # API reference (if applicable)
├── mkdocs.yml
└── catalog-info.yaml               # Already has techdocs-ref
```

## mkdocs.yml Template

```yaml
site_name: ${{values.name}}
site_description: Documentation for ${{values.name}}

nav:
  - Home: index.md
  - Getting Started: getting-started.md
  - Architecture: architecture.md
  - Configuration: configuration.md
  - Development: development.md
  - Deployment: deployment.md
  - Infrastructure: infrastructure.md
  - Observability: observability.md
  - Troubleshooting: troubleshooting.md
  - API Reference: api.md

plugins:
  - techdocs-core

markdown_extensions:
  - admonition
  - codehilite
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - toc:
      permalink: true
```

## Documentation Content by Template

### java-service-template
- Spring Boot project structure
- Maven/Gradle build configuration
- Aurora PostgreSQL/MySQL connection
- DynamoDB integration
- ElastiCache Redis caching
- SQS/SNS messaging patterns
- OpenTelemetry instrumentation
- Health actuator endpoints

### python-service-template
- FastAPI project structure
- UV/Poetry/Pip package management
- SQLAlchemy async patterns
- Celery/ARQ task queues
- Alembic migrations
- Pytest configuration
- OpenTelemetry setup

### rails-api-template
- Rails API-only structure
- ActiveRecord with Aurora
- Sidekiq/Solid Queue jobs
- Action Cable websockets
- RSpec testing
- Rails credentials/secrets

### react-frontend-template
- Next.js App Router structure
- React Query data fetching
- Cognito authentication flow
- CloudFront CDN configuration
- PostHog/Sentry integration
- Tailwind CSS theming

### data-pipeline-template
- Druid OLAP architecture
- Kafka/Kinesis ingestion
- Argo Workflows orchestration
- dbt transformation patterns
- Data quality testing
- Schema registry usage

## Implementation Steps

### 1. Create Base mkdocs.yml for Each Template
```bash
for template in java-service python-service rails-api react-frontend data-pipeline; do
  mkdir -p /Users/bs/codes/fastish/v2/${template}-template/skeleton/\${{values.name}}/docs
done
```

### 2. Create Documentation Files
For each template, create the docs/ directory with appropriate content.

### 3. Update catalog-info.yaml
Ensure annotation exists:
```yaml
metadata:
  annotations:
    backstage.io/techdocs-ref: dir:.
```

### 4. Test TechDocs Generation
```bash
# In each template skeleton
npx @techdocs/cli generate --source-dir . --output-dir ./site
npx @techdocs/cli serve
```

## Success Criteria
- [ ] Each template has mkdocs.yml and docs/ directory
- [ ] TechDocs generates without errors
- [ ] Documentation is accessible in Backstage
- [ ] Content is specific to each template type
- [ ] Code examples are accurate and tested

## Notes
- Use Jinja2 conditionals for optional feature docs
- Keep docs DRY - link to platform docs for common topics
- Include architecture diagrams (Mermaid supported)
- Add runbook links for operations
