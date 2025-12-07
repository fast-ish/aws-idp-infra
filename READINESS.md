# Production Readiness Checklist

Use this checklist to verify production readiness before deploying.

## Infrastructure

### Network
- [ ] VPC configured with proper CIDR ranges
- [ ] Private subnets for workloads
- [ ] Public subnets for load balancers
- [ ] NAT Gateways for outbound traffic
- [ ] VPC flow logs enabled

### EKS Cluster
- [ ] Latest supported Kubernetes version
- [ ] Control plane logging enabled
- [ ] Private endpoint access configured
- [ ] RBAC properly configured
- [ ] Pod security standards enforced

### Database
- [ ] Multi-AZ deployment (Aurora)
- [ ] Encryption at rest enabled
- [ ] Automated backups configured
- [ ] Deletion protection enabled
- [ ] Performance Insights enabled

### Security
- [ ] KMS keys for encryption
- [ ] Secrets in AWS Secrets Manager
- [ ] IAM roles follow least privilege
- [ ] Security groups properly scoped
- [ ] Network policies in place

## Application

### Backstage
- [ ] Production configuration applied
- [ ] GitHub OAuth configured
- [ ] Database connection verified
- [ ] Health checks configured
- [ ] Resource limits set

### Helm Chart
- [ ] Values reviewed for production
- [ ] Image pull policy appropriate
- [ ] Service account with IRSA
- [ ] Secrets properly mounted
- [ ] Ingress TLS configured

### Observability
- [ ] Logging configured (CloudWatch/Grafana)
- [ ] Metrics collection enabled
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] Tracing enabled (optional)

## Operations

### Scaling
- [ ] Karpenter configured
- [ ] NodePool limits appropriate
- [ ] HPA configured (if needed)
- [ ] Resource requests/limits set

### Disaster Recovery
- [ ] Backup strategy documented
- [ ] Recovery procedures tested
- [ ] RTO/RPO defined
- [ ] Cross-region backup (if needed)

### Maintenance
- [ ] Update procedures documented
- [ ] Rollback procedures tested
- [ ] On-call rotation defined
- [ ] Runbooks created

## Compliance

### Documentation
- [ ] Architecture documented
- [ ] Security controls documented
- [ ] Access procedures documented
- [ ] Incident response plan

### Access Control
- [ ] Admin access restricted
- [ ] Audit logging enabled
- [ ] Access reviews scheduled
- [ ] Break-glass procedures

## Pre-Launch

### Testing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Failover testing completed
- [ ] Integration testing completed

### Communication
- [ ] Stakeholders notified
- [ ] Support team trained
- [ ] Documentation published
- [ ] Monitoring dashboards shared

## Post-Launch

### Monitoring
- [ ] All dashboards green
- [ ] No critical alerts
- [ ] Performance baseline established
- [ ] Error rates acceptable

### Validation
- [ ] User acceptance testing passed
- [ ] All integrations working
- [ ] Backup/restore verified
- [ ] Security scan passed
