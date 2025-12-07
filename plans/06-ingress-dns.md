# Plan 06: Ingress & DNS Configuration

## Objective
Configure ALB Ingress resources and Route53 DNS for all platform services.

## Context
- aws-load-balancer-controller is deployed
- external-dns is deployed and configured
- Services have ingress in helm values but may need GitOps manifests
- Domain configured: `{{deployment:domain}}` (e.g., fasti.sh)

## Services Requiring Ingress

| Service | Subdomain | Visibility | Auth |
|---------|-----------|------------|------|
| ArgoCD | argocd.{domain} | Internal | SSO/OIDC |
| Argo Workflows | workflows.{domain} | Internal | Server auth |
| Backstage | backstage.{domain} | Internal | GitHub OAuth |
| Grafana | grafana.{domain} | Internal | Grafana Cloud |

## Ingress Pattern

### Standard ALB Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: <service>-ingress
  namespace: <namespace>
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing  # or internal
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: <acm-cert-arn>
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/group.name: platform  # Share ALB
    # For internal services
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/inbound-cidrs: 10.0.0.0/8
spec:
  ingressClassName: alb
  rules:
    - host: <subdomain>.<domain>
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: <service>
                port:
                  number: <port>
```

## DNS Management

### External-DNS Annotations
external-dns will automatically create Route53 records for Ingress resources with these annotations:

```yaml
annotations:
  external-dns.alpha.kubernetes.io/hostname: argocd.fasti.sh
  external-dns.alpha.kubernetes.io/ttl: "300"
```

### Manual Route53 Records (if needed)
For services not using Ingress (e.g., NLB for gRPC):

```yaml
apiVersion: externaldns.k8s.io/v1alpha1
kind: DNSEndpoint
metadata:
  name: custom-dns
  namespace: external-dns
spec:
  endpoints:
    - dnsName: grpc.fasti.sh
      recordType: A
      targets:
        - <nlb-dns-name>
```

## Implementation

### Directory Structure
```
aws-idp-gitops/platform/ingress/
├── kustomization.yaml
├── argocd-ingress.yaml
├── argo-workflows-ingress.yaml
├── backstage-ingress.yaml
└── shared-alb-config.yaml
```

### 1. Shared ALB Configuration
```yaml
# shared-alb-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alb-config
  namespace: kube-system
data:
  # ALB group settings applied via annotations
  # This is for documentation; actual config is in annotations
```

### 2. ArgoCD Ingress
Already configured in helm values (`argocd.mustache`). Verify:
```yaml
server:
  ingress:
    enabled: true
    controller: aws
    ingressClassName: alb
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: "{{certificate.arn}}"
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/ssl-redirect: "443"
      alb.ingress.kubernetes.io/group.name: argo
```

### 3. Argo Workflows Ingress
Already configured in helm values (`argo-workflows.mustache`). Verify:
```yaml
server:
  ingress:
    enabled: true
    ingressClassName: alb
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: "{{certificate.arn}}"
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/group.name: argo
    hosts:
      - workflows.{{domain}}
```

### 4. Backstage Ingress
Check if Backstage deployment needs ingress in GitOps:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backstage-ingress
  namespace: backstage
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: "{{certificate.arn}}"
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/group.name: platform
    alb.ingress.kubernetes.io/healthcheck-path: /healthcheck
    external-dns.alpha.kubernetes.io/hostname: backstage.fasti.sh
spec:
  ingressClassName: alb
  rules:
    - host: backstage.fasti.sh
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backstage
                port:
                  number: 7007
```

## ACM Certificate

Ensure wildcard certificate exists:
```bash
aws acm list-certificates --query "CertificateSummaryList[?DomainName=='*.fasti.sh']"
```

If not, create via CDK or manually:
```bash
aws acm request-certificate \
  --domain-name "*.fasti.sh" \
  --validation-method DNS \
  --subject-alternative-names "fasti.sh"
```

## Verification Steps

### 1. Check Ingress Resources
```bash
kubectl get ingress -A
kubectl describe ingress <name> -n <namespace>
```

### 2. Check ALB Creation
```bash
aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'k8s')]"
```

### 3. Check DNS Records
```bash
# Via external-dns logs
kubectl logs -n external-dns -l app.kubernetes.io/name=external-dns

# Via Route53
aws route53 list-resource-record-sets --hosted-zone-id <zone-id> | grep argocd
```

### 4. Test Connectivity
```bash
curl -I https://argocd.fasti.sh
curl -I https://workflows.fasti.sh
curl -I https://backstage.fasti.sh
```

## Success Criteria
- [ ] All platform services accessible via HTTPS
- [ ] DNS records created automatically by external-dns
- [ ] SSL certificates valid (no browser warnings)
- [ ] ALB health checks passing
- [ ] Internal services not accessible from internet (if applicable)

## Notes
- Use ALB group.name to share ALB across services (cost saving)
- Consider WAF for public-facing services
- Set up ALB access logs to S3
- Monitor ALB metrics in CloudWatch
