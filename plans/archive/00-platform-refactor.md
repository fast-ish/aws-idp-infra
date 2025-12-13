# Internal Developer Platform - Foundation

> **Status: IMPLEMENTED** (Architecture Reference Document)

Production-ready internal developer platform (IDP) designed for professional environments with compliance requirements (PCI-DSS) and optimization capabilities.

> **Note**: This document serves as the architecture reference for the IDP. The single-cluster
> design has been implemented with namespace isolation for multi-tenancy. PCI-DSS compliance
> features (separate cluster, Falco rules) are available but optional based on requirements.

## Overview

Create `aws-idp-infra` as the foundation repository for internal developer platforms. This repo serves as the baseline template that can be instantiated for different environments - from rigid compliance environments to flexible development clusters.

## Design Principles

1. **Production-Ready**: No shortcuts - HA, security, observability from day one
2. **Compliance-Aware**: PCI-DSS ready architecture with clear boundaries
3. **Cost-Optimizable**: Right-sizing, spot instances, resource quotas
4. **Managed Services First**: ECR over Harbor, Grafana Cloud over self-hosted
5. **Single Cluster per Environment**: Namespace isolation, not cluster sprawl

## Environment Topology

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Production Topology                                 │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         PCI-DSS Environment                                  ││
│  │                         (Compliance Boundary)                                ││
│  │                                                                              ││
│  │  ┌─────────────────────┐                                                    ││
│  │  │   idp-pci Cluster   │  - Strict NetworkPolicies                         ││
│  │  │                     │  - No internet egress (allow-listed only)          ││
│  │  │  • Payment services │  - Encrypted at rest + transit                     ││
│  │  │  • Cardholder data  │  - Audit logging (CloudTrail, Falco)              ││
│  │  │  • PCI workloads    │  - Hardened node AMIs                              ││
│  │  │                     │  - Dedicated node pools                            ││
│  │  └──────────┬──────────┘                                                    ││
│  │             │                                                                ││
│  │             │ Events (one-way, encrypted)                                   ││
│  │             │ via EventBridge / SQS                                         ││
│  │             ▼                                                                ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                │                                                                 │
│                │ Cross-environment events                                        │
│                ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      Platform Environment                                    ││
│  │                      (IDP Foundation)                                        ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │                      idp-platform Cluster                                │││
│  │  │                                                                          │││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │││
│  │  │  │ backstage   │  │ argo        │  │ argocd      │  │ kyverno     │    │││
│  │  │  │             │  │             │  │             │  │             │    │││
│  │  │  │ Developer   │  │ CI Pipelines│  │ GitOps      │  │ Policy      │    │││
│  │  │  │ Portal      │  │ Workflows   │  │ Deployments │  │ Engine      │    │││
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │││
│  │  │                                                                          │││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │││
│  │  │  │ team-*      │  │ staging     │  │ preview     │  │ sandbox     │    │││
│  │  │  │             │  │             │  │             │  │             │    │││
│  │  │  │ Team        │  │ Pre-prod    │  │ PR          │  │ Experiments │    │││
│  │  │  │ Workloads   │  │ Testing     │  │ Previews    │  │ POCs        │    │││
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      Shared Services (Cross-Environment)                    ││
│  │                                                                              ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   ││
│  │  │ ECR           │  │ Grafana Cloud │  │ Route53       │                   ││
│  │  │ (Container    │  │ (Metrics,     │  │ (DNS)         │                   ││
│  │  │  Registry)    │  │  Logs, Traces)│  │               │                   ││
│  │  └───────────────┘  └───────────────┘  └───────────────┘                   ││
│  │                                                                              ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   ││
│  │  │ Secrets       │  │ KMS           │  │ S3            │                   ││
│  │  │ Manager       │  │ (Encryption)  │  │ (Artifacts)   │                   ││
│  │  └───────────────┘  └───────────────┘  └───────────────┘                   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Architecture - IDP Platform Cluster

This is the foundation - what aws-backstage-infra becomes:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           aws-idp-infra                                          │
│                    (Foundation Template)                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                              VPC Layer                                      │ │
│  │                                                                             │ │
│  │  CIDR: 10.100.0.0/16                                                       │ │
│  │                                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │ │
│  │  │ Public       │  │ Private      │  │ Isolated     │                     │ │
│  │  │ /20 per AZ   │  │ /19 per AZ   │  │ /21 per AZ   │                     │ │
│  │  │              │  │              │  │              │                     │ │
│  │  │ • ALB        │  │ • EKS Nodes  │  │ • RDS        │                     │ │
│  │  │ • NAT GW     │  │ • Pods       │  │ • ElastiCache│                     │ │
│  │  │ • Bastion    │  │ • Karpenter  │  │              │                     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                     │ │
│  │                                                                             │ │
│  │  VPC Endpoints: ECR, S3, Secrets Manager, STS, CloudWatch                  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                           EKS Cluster                                       │ │
│  │                                                                             │ │
│  │  Version: 1.34 │ Endpoint: Public + Private │ Logging: All                 │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                        Managed Addons                                 │  │ │
│  │  │                                                                       │  │ │
│  │  │  vpc-cni │ coredns │ kube-proxy │ ebs-csi │ pod-identity            │  │ │
│  │  │  karpenter │ aws-lb-controller │ metrics-server                      │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                      Platform Namespaces                              │  │ │
│  │  │                                                                       │  │ │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │ │
│  │  │  │ backstage  │ │ argo       │ │ argocd     │ │ kyverno    │        │  │ │
│  │  │  │            │ │            │ │            │ │            │        │  │ │
│  │  │  │ Portal     │ │ Workflows  │ │ GitOps     │ │ Policies   │        │  │ │
│  │  │  │ TechDocs   │ │ Events     │ │ AppSets    │ │ Admission  │        │  │ │
│  │  │  │ Scaffolder │ │ Sensors    │ │ Rollouts   │ │ Reports    │        │  │ │
│  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │  │ │
│  │  │                                                                       │  │ │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │ │
│  │  │  │ cert-mgr   │ │ ext-secrets│ │ grafana-   │ │ external-  │        │  │ │
│  │  │  │            │ │            │ │ agent      │ │ dns        │        │  │ │
│  │  │  │ TLS Certs  │ │ AWS→K8s    │ │ → Cloud   │ │ Route53    │        │  │ │
│  │  │  │ Let's Enc. │ │ Secrets    │ │ Metrics   │ │ Auto DNS   │        │  │ │
│  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │  │ │
│  │  │                                                                       │  │ │
│  │  │  ┌────────────┐                                                       │  │ │
│  │  │  │ reloader   │                                                       │  │ │
│  │  │  │            │                                                       │  │ │
│  │  │  │ Restart on │                                                       │  │ │
│  │  │  │ Secret chg │                                                       │  │ │
│  │  │  └────────────┘                                                       │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                       Team Namespaces                                 │  │ │
│  │  │                                                                       │  │ │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │ │
│  │  │  │ team-alpha │ │ team-beta  │ │ staging    │ │ preview-*  │        │  │ │
│  │  │  │            │ │            │ │            │ │            │        │  │ │
│  │  │  │ Quota: 4cpu│ │ Quota: 8cpu│ │ Shared     │ │ Ephemeral  │        │  │ │
│  │  │  │ Mem: 8Gi   │ │ Mem: 16Gi  │ │ Pre-prod   │ │ PR envs    │        │  │ │
│  │  │  │ NetworkPol │ │ NetworkPol │ │            │ │ TTL: 24h   │        │  │ │
│  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    Karpenter Node Pools                               │  │ │
│  │  │                                                                       │  │ │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │  │ │
│  │  │  │ system          │  │ platform        │  │ workloads       │      │  │ │
│  │  │  │                 │  │                 │  │                 │      │  │ │
│  │  │  │ • On-demand     │  │ • On-demand     │  │ • Spot + OD     │      │  │ │
│  │  │  │ • t3a.medium    │  │ • t3a.large     │  │ • t3a/m6a mix   │      │  │ │
│  │  │  │ • Platform pods │  │ • Backstage etc │  │ • Team workloads│      │  │ │
│  │  │  │ • 2-4 nodes     │  │ • 2-4 nodes     │  │ • 0-N nodes     │      │  │ │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                           Data Layer                                        │ │
│  │                                                                             │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │ │
│  │  │ Aurora         │  │ S3             │  │ Secrets Mgr    │               │ │
│  │  │ Serverless v2  │  │                │  │                │               │ │
│  │  │                │  │ • idp-artifacts│  │ • /idp/db/*    │               │ │
│  │  │ • backstage DB │  │ • idp-techdocs │  │ • /idp/oauth/* │               │ │
│  │  │ • argo archive │  │ • idp-backups  │  │ • /idp/api/*   │               │ │
│  │  │ Min: 0.5 ACU   │  │                │  │                │               │ │
│  │  │ Max: 4 ACU     │  │                │  │                │               │ │
│  │  └────────────────┘  └────────────────┘  └────────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Platform Components

### Core (Phase 1)

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **Backstage** | Developer Portal | Existing - migrate from aws-backstage-infra |
| **Argo Workflows** | CI Pipelines | Helm + IRSA, S3 artifacts |
| **Argo CD** | GitOps Deployments | Helm + ApplicationSets |
| **Argo Rollouts** | Progressive Delivery | Blue/green, canary, automated rollback |
| **Argo Events** | Event-driven Triggers | Webhooks → Workflows |
| **Kyverno** | Policy Engine | Baseline + custom policies |

### Infrastructure (Phase 2)

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **External Secrets** | Secrets Manager → K8s | ESO with IRSA |
| **Cert-Manager** | TLS Certificates | Let's Encrypt + Route53 |
| **ExternalDNS** | Auto Route53 records | Ingress/Service → DNS |
| **Reloader** | Restart on secret change | Watches ConfigMaps/Secrets |
| **Grafana Agent** | Metrics/Logs → Cloud | Grafana Cloud integration |

### Optional (Phase 3+)

| Component | Purpose | When to Add |
|-----------|---------|-------------|
| **Crossplane** | Self-service Infra | Teams need AWS resources |
| **Falco** | Runtime Security | PCI/compliance clusters |
| **Velero** | Backup/DR | Stateful workloads |

## Managed Services Stack

Prioritize managed services over self-hosted:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Managed Services (Preferred)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Container Registry     │  ECR                                                  │
│  ─────────────────────────────────────────────────────────────                  │
│  • Native IAM/IRSA integration                                                  │
│  • No ops overhead                                                               │
│  • Cross-region replication                                                      │
│  • Vulnerability scanning (Inspector)                                            │
│                                                                                  │
│  Observability          │  Grafana Cloud                                        │
│  ─────────────────────────────────────────────────────────────                  │
│  • Metrics (Prometheus remote write)                                            │
│  • Logs (Loki)                                                                   │
│  • Traces (Tempo)                                                                │
│  • Free tier: 10k metrics, 50GB logs                                            │
│  • No Prometheus/Grafana maintenance                                            │
│                                                                                  │
│  Secrets                │  AWS Secrets Manager + External Secrets Operator      │
│  ─────────────────────────────────────────────────────────────                  │
│  • Native AWS integration                                                        │
│  • Automatic rotation                                                            │
│  • ESO syncs to K8s secrets                                                      │
│                                                                                  │
│  DNS                    │  Route53                                              │
│  ─────────────────────────────────────────────────────────────                  │
│  • Native EKS integration                                                        │
│  • ExternalDNS for automatic records                                             │
│                                                                                  │
│  TLS                    │  ACM + Cert-Manager                                   │
│  ─────────────────────────────────────────────────────────────                  │
│  • ACM for ALB (free)                                                            │
│  • Cert-Manager + Let's Encrypt for in-cluster                                  │
│                                                                                  │
│  Database               │  Aurora Serverless v2                                 │
│  ─────────────────────────────────────────────────────────────                  │
│  • Scales to zero (min 0.5 ACU)                                                  │
│  • Multi-AZ automatic                                                            │
│  • Shared across platform components                                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## IAM Design - Function-Level Access

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IAM Role Structure                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Platform Roles (Human Users via SSO)                                           │
│  ─────────────────────────────────────────────────────────────                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-admin                                                                │   │
│  │ • Full EKS access (all namespaces)                                       │   │
│  │ • CDK deploy permissions                                                 │   │
│  │ • Secrets Manager read/write                                             │   │
│  │ • Aurora admin                                                           │   │
│  │ • Members: Platform team leads                                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-operator                                                             │   │
│  │ • EKS access (platform namespaces only)                                  │   │
│  │ • View secrets, no write                                                 │   │
│  │ • Argo/ArgoCD management                                                 │   │
│  │ • Members: Platform engineers                                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-viewer                                                               │   │
│  │ • Read-only EKS access                                                   │   │
│  │ • View logs, metrics                                                     │   │
│  │ • No secrets access                                                      │   │
│  │ • Members: Stakeholders, auditors                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Team Roles (Per-Team)                                                          │
│  ─────────────────────────────────────────────────────────────                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ team-{name}-developer                                                    │   │
│  │ • EKS: team-{name} namespace (full), staging (deploy)                   │   │
│  │ • Argo Workflows: submit, view, delete own                              │   │
│  │ • Argo CD: sync team applications                                       │   │
│  │ • ECR: push/pull team repos                                             │   │
│  │ • S3: team artifact prefix                                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ team-{name}-viewer                                                       │   │
│  │ • EKS: team-{name} namespace (read-only)                                │   │
│  │ • View workflows, deployments, logs                                      │   │
│  │ • No deploy/exec permissions                                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Service Account Roles (IRSA - Pod Identity)                                    │
│  ─────────────────────────────────────────────────────────────                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-backstage-sa                                                         │   │
│  │ • s3:GetObject,PutObject → idp-techdocs/*                               │   │
│  │ • secretsmanager:GetSecretValue → /idp/backstage/*                      │   │
│  │ • Bound to: backstage/backstage-sa                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-argo-controller-sa                                                   │   │
│  │ • s3:* → idp-artifacts/*                                                 │   │
│  │ • ecr:GetAuthorizationToken, BatchGetImage                              │   │
│  │ • secretsmanager:GetSecretValue → /idp/argo/*                           │   │
│  │ • Bound to: argo/argo-workflows-controller                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-argo-executor-sa                                                     │   │
│  │ • s3:GetObject,PutObject → idp-artifacts/*                              │   │
│  │ • ecr:* (push/pull)                                                      │   │
│  │ • Bound to: argo/argo-workflows-executor (workflow pods)                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-argocd-sa                                                            │   │
│  │ • ecr:GetAuthorizationToken, BatchGetImage                              │   │
│  │ • s3:GetObject → idp-artifacts/* (helm charts)                          │   │
│  │ • Bound to: argocd/argocd-application-controller                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ idp-external-secrets-sa                                                  │   │
│  │ • secretsmanager:GetSecretValue → /idp/*                                │   │
│  │ • Bound to: external-secrets/external-secrets                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
aws-idp-infra/
├── cdk.json
├── cdk.context.template.json
├── pom.xml
├── renovate.json
│
├── .github/
│   ├── workflows/
│   │   ├── validate.yml              # PR validation
│   │   ├── plan.yml                  # CDK diff on PR
│   │   └── deploy.yml                # Deploy on merge
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── AI_CONTEXT.md
│
├── src/main/java/fasti/sh/idp/
│   ├── Launch.java
│   └── stack/
│       │
│       ├── IdpStackProps.java        # Shared configuration
│       │
│       ├── foundation/
│       │   ├── VpcStack.java         # VPC, subnets, endpoints
│       │   ├── DataStack.java        # Aurora, S3 buckets
│       │   └── IamStack.java         # Platform + team roles
│       │
│       ├── cluster/
│       │   ├── EksStack.java         # EKS cluster
│       │   ├── AddonsStack.java      # Managed addons
│       │   └── KarpenterStack.java   # Node pools
│       │
│       ├── platform/
│       │   ├── BackstageStack.java   # Developer portal
│       │   ├── ArgoWorkflowsStack.java
│       │   ├── ArgoCdStack.java
│       │   ├── KyvernoStack.java
│       │   ├── ExternalSecretsStack.java
│       │   └── ObservabilityStack.java  # Grafana Agent
│       │
│       └── teams/
│           ├── TeamStack.java        # Per-team namespace
│           └── TeamStackProps.java
│
├── src/main/resources/
│   ├── production/v1/
│   │   ├── conf.mustache             # Main config
│   │   ├── vpc/
│   │   ├── eks/
│   │   ├── backstage/
│   │   ├── argo-workflows/
│   │   ├── argocd/
│   │   ├── kyverno/
│   │   └── teams/
│   │
│   └── pci/v1/                       # PCI-DSS variant
│       ├── conf.mustache
│       └── ...                       # Stricter configs
│
├── helm/
│   └── charts/
│       └── idp-team/                 # Team onboarding
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│               ├── namespace.yaml
│               ├── rbac.yaml
│               ├── network-policy.yaml
│               ├── resource-quota.yaml
│               └── limit-range.yaml
│
├── workflow-templates/               # Argo Workflow templates
│   ├── build/
│   │   ├── docker-kaniko.yaml
│   │   ├── java-maven.yaml
│   │   └── node-pnpm.yaml
│   ├── deploy/
│   │   ├── argocd-sync.yaml
│   │   └── helm-upgrade.yaml
│   ├── test/
│   │   └── integration.yaml
│   └── pipelines/
│       ├── ci.yaml                   # Build → Test → Push
│       └── cd.yaml                   # Deploy via ArgoCD
│
├── policies/                         # Kyverno policies
│   ├── baseline/
│   │   ├── require-labels.yaml
│   │   ├── require-requests-limits.yaml
│   │   ├── disallow-privileged.yaml
│   │   └── restrict-host-namespaces.yaml
│   └── platform/
│       ├── restrict-registries.yaml  # ECR only
│       └── require-probes.yaml
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRE_DEPLOYMENT.md
│   ├── DEPLOYMENT.md
│   ├── POST_DEPLOYMENT.md
│   ├── TEAM_ONBOARDING.md
│   └── TROUBLESHOOTING.md
│
└── plans/
    ├── 00-platform-refactor.md       # This document
    ├── 01-argo-workflows.md
    ├── 02-argocd.md
    └── 03-pci-environment.md
```

## CDK Context Configuration

```json
{
  "platform:id": "idp",
  "platform:organization": "fast-ish",
  "platform:account": "351619759866",
  "platform:region": "us-west-2",
  "platform:domain": "stxkxs.io",

  "deployment:id": "idp",
  "deployment:environment": "production",
  "deployment:version": "v1",

  "deployment:vpc:cidr": "10.100.0.0/16",
  "deployment:vpc:maxAzs": 3,

  "deployment:eks:version": "1.34",
  "deployment:eks:administrators": [
    {
      "username": "admin",
      "role": "arn:aws:iam::351619759866:role/AWSReservedSSO_AdministratorAccess_...",
      "email": "admin@example.com"
    }
  ],

  "deployment:aurora:minCapacity": 0.5,
  "deployment:aurora:maxCapacity": 4,

  "deployment:components": {
    "backstage": {
      "enabled": true,
      "domain": "backstage.stxkxs.io",
      "replicas": 2
    },
    "argo-workflows": {
      "enabled": true,
      "domain": "workflows.stxkxs.io"
    },
    "argocd": {
      "enabled": true,
      "domain": "argocd.stxkxs.io"
    },
    "kyverno": {
      "enabled": true
    },
    "external-secrets": {
      "enabled": true
    },
    "grafana-agent": {
      "enabled": true,
      "cloudEndpoint": "https://prometheus-xxx.grafana.net"
    }
  },

  "deployment:teams": [
    {
      "name": "platform",
      "quotas": { "cpu": "8", "memory": "16Gi" },
      "members": ["stxkxs"]
    }
  ],

  "deployment:observability:grafanaCloud": {
    "metricsEndpoint": "https://prometheus-xxx.grafana.net/api/prom/push",
    "logsEndpoint": "https://logs-xxx.grafana.net/loki/api/v1/push"
  }
}
```

## Cost Optimization

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Cost Optimization Strategy                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Compute                                                                         │
│  ─────────────────────────────────────────────────────────────                  │
│  • Karpenter spot instances for workload pools (70% savings)                    │
│  • On-demand for platform components (stability)                                │
│  • Right-sized instance families (t3a, m6a)                                     │
│  • Consolidation policy: WhenEmpty after 10m                                    │
│                                                                                  │
│  Database                                                                        │
│  ─────────────────────────────────────────────────────────────                  │
│  • Aurora Serverless v2: scales to 0.5 ACU (~$43/mo minimum)                   │
│  • Shared database for all platform components                                  │
│  • Separate schemas, not separate clusters                                      │
│                                                                                  │
│  Storage                                                                         │
│  ─────────────────────────────────────────────────────────────                  │
│  • S3 Intelligent Tiering for artifacts                                         │
│  • 30-day lifecycle for workflow artifacts                                      │
│  • GP3 EBS volumes (20% cheaper than GP2)                                       │
│                                                                                  │
│  Observability                                                                   │
│  ─────────────────────────────────────────────────────────────                  │
│  • Grafana Cloud free tier (10k metrics, 50GB logs)                            │
│  • No self-hosted Prometheus/Grafana/Loki maintenance                          │
│                                                                                  │
│  Networking                                                                      │
│  ─────────────────────────────────────────────────────────────                  │
│  • Single NAT Gateway (multi-AZ via routing, not HA NAT)                       │
│  • VPC Endpoints for ECR, S3 (avoid NAT charges)                               │
│                                                                                  │
│  Estimated Monthly Cost                                                          │
│  ─────────────────────────────────────────────────────────────                  │
│  EKS Control Plane:     $73                                                     │
│  EC2 (4-6 nodes avg):   $150-250 (with spot)                                   │
│  Aurora Serverless:     $50-100                                                 │
│  ALB:                   $25-50                                                  │
│  NAT Gateway:           $45                                                     │
│  S3/ECR:                $20-30                                                  │
│  ─────────────────────────────────────────────────────────────                  │
│  Total:                 ~$400-550/mo                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Migration Path

### From aws-backstage-infra → aws-idp-infra

```
Phase 1: Foundation (Week 1)
├── Create aws-idp-infra repo
├── Copy VPC configuration
├── Copy EKS configuration
├── Add IAM role structure
└── Test: VPC + EKS deploys clean

Phase 2: Platform Components (Week 2)
├── Migrate Backstage stack
├── Add External Secrets Operator
├── Add Kyverno baseline policies
├── Add Grafana Agent
└── Test: Backstage accessible

Phase 3: CI/CD (Week 3)
├── Deploy Argo Workflows
├── Create workflow templates
├── Integrate with Backstage scaffolder
└── Test: Workflows execute

Phase 4: GitOps (Week 4)
├── Deploy Argo CD
├── Create ApplicationSets
├── Migrate existing deployments
└── Test: GitOps flow works

Phase 5: Team Onboarding (Week 5)
├── Create team Helm chart
├── Document onboarding process
├── Add first team namespace
└── Test: Team can deploy

Cutover
├── Update DNS to new cluster
├── Decommission aws-backstage-infra
└── Archive old repo
```

## Compliance Considerations (PCI-DSS)

For PCI environments, deploy a separate cluster variant with:

```yaml
# pci/v1/conf.mustache differences

eks:
  endpointAccess: private_only      # No public API
  encryptionConfig:
    enabled: true
    kmsKeyArn: arn:aws:kms:...      # Customer-managed key

nodePools:
  - name: pci-workloads
    instanceTypes: [m6a.large]       # No spot for PCI
    taints:
      - key: pci-dss
        value: "true"
        effect: NoSchedule

networkPolicies:
  defaultDeny: true                  # Deny all by default
  allowedEgress:                     # Explicit allow-list
    - 10.0.0.0/8
    - payment-processor.com

additionalComponents:
  falco:
    enabled: true                    # Runtime security
  velero:
    enabled: true                    # Backup/DR
```

## ok-cli Repository Management

When adding new repositories to the IDP ecosystem, update `ok-cli` to include them:

### Files to Update

```
ok-cli/
├── conf/repos/
│   └── .ok.github.repo.{repo-name}     # Create repo config file
│
├── scripts/
│   ├── lib/common.sh                    # Add to REPO_NAMES and REPO_TYPES arrays
│   ├── setup/push-all-repos.sh          # Add to REPOS array
│   ├── utils/sync-repos.sh              # Add to REPOS array
│   ├── utils/force-push-all-repos.sh    # Add to REPOS array
│   ├── utils/update-repos.sh            # Add to REPOS array
│   └── utils/build-maven.sh             # Add to MAVEN_REPOS if Java/CDK repo
│
└── Makefile                             # Update destroy-repos, init-secrets, status targets
```

### Repo Config File Format

```bash
# conf/repos/.ok.github.repo.aws-idp-infra
REPO_NAME="aws-idp-infra"
REPO_DESCRIPTION="Internal Developer Platform infrastructure"
REPO_VISIBILITY="private"
REPO_DEFAULT_BRANCH="main"
```

### Example: Adding aws-idp-infra

```bash
# 1. Create repo config
cat > conf/repos/.ok.github.repo.aws-idp-infra << 'EOF'
REPO_NAME="aws-idp-infra"
REPO_DESCRIPTION="Internal Developer Platform - EKS, Argo, Backstage"
REPO_VISIBILITY="private"
REPO_DEFAULT_BRANCH="main"
EOF

# 2. Add to scripts/lib/common.sh
REPO_NAMES=("cdk-common" "ok-cli" "..." "aws-idp-infra")
REPO_TYPES=("maven" "shell" "..." "maven")

# 3. Add to REPOS arrays in:
#    - scripts/setup/push-all-repos.sh
#    - scripts/utils/sync-repos.sh
#    - scripts/utils/force-push-all-repos.sh
#    - scripts/utils/update-repos.sh

# 4. Add to MAVEN_REPOS in scripts/utils/build-maven.sh (if CDK/Java)
MAVEN_REPOS=("cdk-common" "..." "aws-idp-infra")
```

## Next Steps

1. **Create aws-idp-infra repository** - Bootstrap from aws-backstage-infra
2. **Update ok-cli** - Add new repo to management scripts
3. **Refactor VPC/EKS stacks** - Generalize naming, add flexibility
4. **Add IAM module** - Function-level roles
5. **Deploy Argo Workflows** - Per existing 01-argo-workflows.md plan
6. **Deploy Argo CD** - GitOps for team deployments
7. **Document team onboarding** - Self-service namespace creation

## References

- [CNCF Landscape](https://landscape.cncf.io/)
- [Backstage](https://backstage.io/)
- [Argo Project](https://argoproj.github.io/)
- [Kyverno](https://kyverno.io/)
- [External Secrets Operator](https://external-secrets.io/)
- [Grafana Cloud](https://grafana.com/products/cloud/)
- [PCI-DSS on AWS](https://aws.amazon.com/compliance/pci-dss-level-1-faqs/)
