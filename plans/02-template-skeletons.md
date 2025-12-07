# Plan 02: Complete Template Skeletons

## Objective
Flesh out the skeleton/ directories for Python, Rails, React, and Data Pipeline templates with production-ready code examples.

## Context
- java-service-template is 100% complete (use as reference)
- Other templates have template.yaml and basic structure but minimal code
- Each template has optional features (database, cache, messaging) that need examples

## Templates to Complete

### 1. python-service-template (FastAPI)

**Files to add/enhance in `skeleton/`:**

```
skeleton/${{values.name}}/
├── src/
│   ├── main.py                    # FastAPI app with middleware, CORS, health
│   ├── config.py                  # Pydantic settings with env vars
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py              # Example CRUD routes
│   │   ├── deps.py                # Dependency injection (db, cache)
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── items.py           # Example resource endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                # SQLAlchemy base
│   │   └── item.py                # Example model
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── item.py                # Pydantic schemas
│   ├── services/
│   │   ├── __init__.py
│   │   └── item_service.py        # Business logic
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py             # Database session
│   │   └── migrations/            # Alembic migrations
│   ├── cache/
│   │   ├── __init__.py
│   │   └── redis.py               # Redis client
│   └── tasks/
│       ├── __init__.py
│       └── celery_app.py          # Celery with Redis broker
├── tests/
│   ├── conftest.py                # Fixtures
│   ├── test_api.py
│   └── test_services.py
├── alembic.ini
├── pyproject.toml
├── Dockerfile
└── k8s/                           # Already exists
```

**Key implementations:**
- [ ] FastAPI app with OpenTelemetry middleware
- [ ] SQLAlchemy async with Aurora PostgreSQL/MySQL
- [ ] DynamoDB client with boto3
- [ ] Redis cache client
- [ ] Celery tasks with Redis broker (if celery selected)
- [ ] ARQ tasks (if arq selected)
- [ ] Alembic migrations setup
- [ ] Health/readiness endpoints
- [ ] Structured JSON logging

---

### 2. rails-api-template

**Files to add/enhance in `skeleton/`:**

```
skeleton/${{values.name}}/
├── app/
│   ├── controllers/
│   │   ├── application_controller.rb
│   │   ├── health_controller.rb
│   │   └── api/
│   │       └── v1/
│   │           ├── base_controller.rb
│   │           └── items_controller.rb   # Example resource
│   ├── models/
│   │   ├── application_record.rb
│   │   └── item.rb                       # Example model
│   ├── serializers/
│   │   └── item_serializer.rb            # JSON:API serializer
│   ├── services/
│   │   └── item_service.rb               # Service object
│   ├── jobs/
│   │   ├── application_job.rb
│   │   └── example_job.rb                # Sidekiq job example
│   └── channels/
│       ├── application_cable/
│       │   ├── channel.rb
│       │   └── connection.rb
│       └── notifications_channel.rb      # Action Cable example
├── config/
│   ├── database.yml                      # Aurora config
│   ├── redis.yml                         # Redis config
│   ├── sidekiq.yml                       # Sidekiq config
│   ├── initializers/
│   │   ├── redis.rb
│   │   ├── sidekiq.rb
│   │   └── opentelemetry.rb              # OTel setup
│   └── routes.rb
├── db/
│   └── migrate/
│       └── 001_create_items.rb           # Example migration
├── spec/
│   ├── rails_helper.rb
│   ├── spec_helper.rb
│   ├── requests/
│   │   └── items_spec.rb
│   └── jobs/
│       └── example_job_spec.rb
├── Gemfile
├── Dockerfile
└── k8s/                                  # Already exists
```

**Key implementations:**
- [ ] Rails API-only app setup
- [ ] Aurora PostgreSQL/MySQL database.yml
- [ ] Redis cache and Action Cable adapter
- [ ] Sidekiq with Redis (if sidekiq selected)
- [ ] Solid Queue (if solid_queue selected)
- [ ] Action Cable websocket example
- [ ] OpenTelemetry instrumentation
- [ ] JSON:API serialization
- [ ] RSpec test examples

---

### 3. react-frontend-template (Next.js)

**Files to add/enhance in `skeleton/`:**

```
skeleton/${{values.name}}/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with providers
│   │   ├── page.tsx                      # Home page
│   │   ├── loading.tsx                   # Loading state
│   │   ├── error.tsx                     # Error boundary
│   │   ├── health/
│   │   │   └── route.ts                  # Health endpoint
│   │   └── dashboard/
│   │       ├── page.tsx                  # Example protected page
│   │       └── layout.tsx
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── footer.tsx
│   │   └── providers/
│   │       ├── query-provider.tsx        # React Query
│   │       ├── auth-provider.tsx         # Cognito auth
│   │       └── analytics-provider.tsx    # PostHog/Sentry
│   ├── lib/
│   │   ├── api.ts                        # API client
│   │   ├── auth.ts                       # Cognito helpers
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   └── use-api.ts
│   └── types/
│       └── index.ts
├── public/
│   └── assets/
├── tests/
│   ├── setup.ts
│   └── components/
│       └── button.test.tsx
├── next.config.js
├── tailwind.config.ts
├── package.json
├── Dockerfile
└── k8s/                                  # Already exists
```

**Key implementations:**
- [ ] Next.js 14 App Router setup
- [ ] React Query for data fetching
- [ ] Cognito authentication flow (if cognito selected)
- [ ] PostHog analytics initialization (if posthog selected)
- [ ] Sentry error tracking (if sentry selected)
- [ ] CloudWatch RUM (if rum selected)
- [ ] shadcn/ui component examples
- [ ] Tailwind CSS configuration
- [ ] Jest + React Testing Library setup

---

### 4. data-pipeline-template (Druid OLAP)

**Files to add/enhance in `skeleton/`:**

```
skeleton/${{values.name}}/
├── druid/
│   ├── ingestion/
│   │   ├── kafka-supervisor.json         # Kafka ingestion spec
│   │   ├── kinesis-supervisor.json       # Kinesis ingestion spec
│   │   └── s3-batch-spec.json            # S3 batch ingestion
│   ├── schemas/
│   │   └── events.json                   # Example schema
│   └── queries/
│       └── example-queries.sql           # Example Druid SQL
├── workflows/
│   ├── argo/
│   │   ├── pipeline-workflow.yaml        # Main Argo Workflow
│   │   ├── ingestion-workflow.yaml       # Druid ingestion trigger
│   │   └── backfill-workflow.yaml        # Historical data backfill
│   ├── airflow/
│   │   └── dags/
│   │       └── pipeline_dag.py           # Airflow DAG (if airflow)
│   └── step-functions/
│       └── pipeline.asl.json             # Step Functions (if step-functions)
├── transformations/
│   ├── dbt/
│   │   ├── dbt_project.yml
│   │   ├── profiles.yml.example
│   │   ├── models/
│   │   │   ├── staging/
│   │   │   │   └── stg_events.sql
│   │   │   └── marts/
│   │   │       └── fct_events.sql
│   │   └── tests/
│   │       └── test_events.sql
│   └── sql/
│       └── transformations.sql
├── consumers/
│   ├── kafka/
│   │   └── consumer.py                   # Kafka consumer example
│   └── kinesis/
│       └── consumer.py                   # Kinesis consumer example
├── schemas/
│   ├── avro/
│   │   └── event.avsc                    # Avro schema
│   └── glue/
│       └── schema-registry.json          # Glue schema
├── tests/
│   ├── test_ingestion.py
│   └── test_transformations.py
├── Dockerfile
├── requirements.txt
└── k8s/                                  # Already exists
```

**Key implementations:**
- [ ] Druid ingestion specs for Kafka/Kinesis/S3
- [ ] Argo Workflow DAGs for pipeline orchestration
- [ ] Airflow DAG example (if airflow selected)
- [ ] dbt models with staging/marts pattern
- [ ] Kafka/Kinesis consumer examples
- [ ] Avro/Glue schema examples
- [ ] Data quality tests

## Success Criteria
- [ ] Each template generates a working, runnable project
- [ ] Optional features are conditionally included based on parameters
- [ ] All templates follow the same patterns as java-service-template
- [ ] Generated projects pass linting and basic tests
- [ ] Kubernetes manifests work with the platform (IRSA, network policies)

## Notes
- Use Jinja2 conditionals in skeleton files: `{%- if values.database == 'aurora-postgresql' %}`
- Reference java-service-template for patterns
- Test each template by running it through Backstage scaffolder
