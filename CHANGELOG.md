# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure for Backstage infrastructure deployment
- CDK stacks for VPC, EKS, RDS PostgreSQL, and Backstage application
- Helm chart for Backstage Kubernetes deployment
- GitHub OAuth integration support
- AWS Secrets Manager integration via CSI driver
- Karpenter auto-scaling configuration
- GitHub Actions workflows for CI/CD
- Code quality tools: Checkstyle, SpotBugs, PMD, JaCoCo
