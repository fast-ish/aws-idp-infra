'use client';

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import {
  EKSIcon,
  VPCIcon,
  S3Icon,
  SecretsManagerIcon,
  IAMIcon,
  ALBIcon,
  CloudWatchIcon,
  Route53Icon,
  ArgoCDIcon,
  ArgoWorkflowsIcon,
  ArgoEventsIcon,
  ArgoRolloutsIcon,
  BackstageIcon,
  KarpenterIcon,
  CertManagerIcon,
  ExternalSecretsIcon,
  ExternalDNSIcon,
  GrafanaAlloyIcon,
  MetricsServerIcon,
  ReloaderIcon,
  HelmIcon,
  CDKIcon,
  KubernetesIcon,
  GitIcon,
  RDSIcon,
} from '../icons/aws-icons';
import { ServiceCard, Layer, DataFlowArrow } from '../ui/service-card';

type ViewMode = 'infrastructure' | 'platform' | 'data-flow' | 'deployment';

export const IdpArchitecture: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('infrastructure');

  const views: { id: ViewMode; label: string; description: string }[] = [
    { id: 'infrastructure', label: 'Infrastructure', description: 'AWS Cloud Resources' },
    { id: 'platform', label: 'Platform', description: 'IDP Core Components' },
    { id: 'data-flow', label: 'Data Flow', description: 'GitOps & CI/CD Paths' },
    { id: 'deployment', label: 'Deployment', description: 'CDK & Helm Pipeline' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <KubernetesIcon size={40} />
                </motion.div>
                <div>
                  <h1 className="text-xl font-bold text-white">Internal Developer Platform</h1>
                  <p className="text-slate-400 text-sm">AWS EKS + GitOps Infrastructure</p>
                </div>
              </div>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
              {views.map((view) => (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer
                    ${activeView === view.id
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2 cursor-help" title="Services that are running">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-slate-400">Active</span>
              </div>
              <div className="flex items-center gap-2 cursor-help" title="Data flow direction">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-slate-400">Data Flow</span>
              </div>
              <div className="flex items-center gap-2 cursor-help" title="AWS managed services">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span className="text-slate-400">AWS Service</span>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        {/* View Description */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            {views.find(v => v.id === activeView)?.label} View
          </h2>
          <p className="text-slate-400">
            {views.find(v => v.id === activeView)?.description}
          </p>
        </motion.div>

        {/* Architecture Diagram */}
        {activeView === 'infrastructure' && <InfrastructureView />}
        {activeView === 'platform' && <PlatformView />}
        {activeView === 'data-flow' && <DataFlowView />}
        {activeView === 'deployment' && <DeploymentView />}
      </main>

      {/* Footer Stats */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-sm"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="grid grid-cols-6 gap-6">
            {[
              { label: 'CDK Version', value: '2.219.0', icon: <CDKIcon size={24} /> },
              { label: 'Nested Stacks', value: '10+', icon: <VPCIcon size={24} /> },
              { label: 'Helm Charts', value: '12+', icon: <HelmIcon size={24} /> },
              { label: 'EKS Addons', value: '8+', icon: <KubernetesIcon size={24} /> },
              { label: 'Argo Components', value: '4', icon: <ArgoCDIcon size={24} /> },
              { label: 'Availability Zones', value: '3', icon: <EKSIcon size={24} /> },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + idx * 0.1 }}
                className="text-center cursor-pointer hover:bg-slate-800/30 rounded-lg p-2 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {stat.icon}
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <span className="text-slate-500 text-sm">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

const InfrastructureView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* AWS Cloud Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative border-2 border-dashed border-orange-500/30 rounded-3xl p-8 bg-gradient-to-br from-orange-950/10 to-slate-950"
      >
        <div className="absolute -top-4 left-8 bg-slate-950 px-4 py-1 rounded-full border border-orange-500/30 cursor-pointer hover:border-orange-500/60 hover:bg-slate-900 transition-all">
          <span className="text-orange-400 text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            AWS Cloud
          </span>
        </div>

        {/* VPC Layer */}
        <Layer
          title="VPC Network"
          subtitle="10.0.0.0/16 - Multi-AZ - Private & Public Subnets"
          color="from-purple-900/20 to-slate-900/50"
          delay={0.1}
          className="mb-6"
        >
          <div className="grid grid-cols-3 gap-4">
            {['us-west-2a', 'us-west-2b', 'us-west-2c'].map((az, idx) => (
              <motion.div
                key={az}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/50 transition-all"
              >
                <div className="text-xs text-slate-500 mb-3">Availability Zone: {az}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs cursor-help" title="NAT Gateway attached">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-slate-400">Public Subnet (10.0.{idx}.0/24)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs cursor-help" title="Private workloads">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span className="text-slate-400">Private Subnet (10.0.{idx + 10}.0/24)</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center gap-8 mt-6">
            <ServiceCard
              icon={<VPCIcon size={36} />}
              title="NAT Gateway"
              description="Egress for private subnets"
              details={['High availability', 'Auto-scaling bandwidth', '2 NAT Gateways']}
              delay={0.4}
              size="sm"
              status="active"
              metrics={[
                { label: 'Gateways', value: '2' },
                { label: 'Elastic IPs', value: '2' },
              ]}
              tags={['networking', 'egress', 'ha']}
              docsUrl="https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html"
            />
            <ServiceCard
              icon={<ALBIcon size={36} />}
              title="Internet Gateway"
              description="Public internet access"
              details={['Ingress routing', 'Redundant by default']}
              delay={0.5}
              size="sm"
              status="active"
              tags={['networking', 'ingress']}
              docsUrl="https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html"
            />
          </div>
        </Layer>

        {/* EKS Layer */}
        <Layer
          title="Amazon EKS Cluster"
          subtitle="Kubernetes 1.28+ - Managed Control Plane"
          color="from-orange-900/20 to-slate-900/50"
          delay={0.3}
          className="mb-6"
        >
          <div className="grid grid-cols-4 gap-4 mb-6">
            <ServiceCard
              icon={<EKSIcon size={36} />}
              title="Control Plane"
              description="Managed Kubernetes API"
              details={['Multi-AZ deployment', 'OIDC provider', 'Encrypted etcd', 'Pod Identity']}
              delay={0.4}
              status="active"
              metrics={[
                { label: 'Version', value: '1.28+' },
                { label: 'Uptime', value: '99.95%' },
              ]}
              tags={['kubernetes', 'managed', 'control-plane']}
              docsUrl="https://docs.aws.amazon.com/eks/latest/userguide/clusters.html"
            />
            <ServiceCard
              icon={<KarpenterIcon size={36} />}
              title="Karpenter"
              description="Node auto-provisioning"
              details={['Spot instance support', 'Right-sizing', 'Multi-instance types', 'Consolidation']}
              delay={0.5}
              status="active"
              metrics={[
                { label: 'Node Pools', value: '3+' },
                { label: 'Spot Enabled', value: 'Yes' },
              ]}
              tags={['autoscaling', 'spot', 'cost-optimization']}
              docsUrl="https://karpenter.sh/docs/"
            />
            <ServiceCard
              icon={<ALBIcon size={36} />}
              title="AWS LB Controller"
              description="Ingress management"
              details={['ALB/NLB support', 'TLS termination', 'Target group binding']}
              delay={0.6}
              status="active"
              metrics={[
                { label: 'Ingresses', value: '5+' },
                { label: 'Services', value: '10+' },
              ]}
              tags={['ingress', 'load-balancer', 'tls']}
              docsUrl="https://kubernetes-sigs.github.io/aws-load-balancer-controller/"
            />
            <ServiceCard
              icon={<ExternalSecretsIcon size={36} />}
              title="External Secrets"
              description="Secret synchronization"
              details={['AWS Secrets Manager', 'Auto-refresh (1h)', 'ClusterSecretStore']}
              delay={0.7}
              status="active"
              metrics={[
                { label: 'Secrets Synced', value: '10+' },
                { label: 'Refresh', value: '1h' },
              ]}
              tags={['security', 'secrets', 'sync']}
              docsUrl="https://external-secrets.io/latest/"
            />
          </div>

          {/* Additional EKS Addons */}
          <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-700/20">
            <h4 className="text-sm font-semibold text-white mb-3">EKS Addons</h4>
            <div className="grid grid-cols-4 gap-3">
              {[
                { name: 'cert-manager', desc: 'TLS certificate management', icon: <CertManagerIcon size={24} /> },
                { name: 'external-dns', desc: 'DNS record automation', icon: <ExternalDNSIcon size={24} /> },
                { name: 'Metrics Server', desc: 'Resource metrics', icon: <MetricsServerIcon size={24} /> },
                { name: 'Reloader', desc: 'ConfigMap/Secret reload', icon: <ReloaderIcon size={24} /> },
              ].map((addon, idx) => (
                <motion.div
                  key={addon.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + idx * 0.1 }}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 cursor-pointer hover:border-orange-500/50 hover:bg-slate-900/70 transition-all flex items-center gap-2"
                  title={addon.desc}
                >
                  {addon.icon}
                  <div>
                    <div className="text-sm font-medium text-white">{addon.name}</div>
                    <div className="text-[10px] text-slate-500">{addon.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Layer>

        {/* Data Services Layer */}
        <Layer
          title="Data Services"
          subtitle="Storage - Secrets - Observability"
          color="from-green-900/20 to-slate-900/50"
          delay={0.5}
        >
          <div className="grid grid-cols-4 gap-6">
            <ServiceCard
              icon={<S3Icon size={40} />}
              title="S3 Buckets"
              description="Artifact & cache storage"
              details={[
                'Argo Workflows artifacts',
                'Backstage cache',
                'KMS encryption',
                'Lifecycle policies',
              ]}
              delay={0.6}
              size="lg"
              status="active"
              metrics={[
                { label: 'Buckets', value: '3+' },
                { label: 'Storage Class', value: 'Standard' },
              ]}
              tags={['storage', 'artifacts', 'encrypted']}
              docsUrl="https://docs.aws.amazon.com/s3/"
            />
            <ServiceCard
              icon={<SecretsManagerIcon size={40} />}
              title="Secrets Manager"
              description="Credential storage"
              details={[
                'Git repository creds',
                'TLS certificates',
                'API keys',
                'Database passwords',
              ]}
              delay={0.7}
              size="lg"
              status="active"
              metrics={[
                { label: 'Secrets', value: '10+' },
                { label: 'Rotation', value: 'Supported' },
              ]}
              tags={['security', 'secrets', 'credentials']}
              docsUrl="https://docs.aws.amazon.com/secretsmanager/"
            />
            <ServiceCard
              icon={<RDSIcon size={40} />}
              title="Aurora PostgreSQL"
              description="Backstage metadata"
              details={[
                'PostgreSQL 15+',
                'Multi-AZ deployment',
                'Encrypted storage',
                'Auto-scaling',
              ]}
              delay={0.8}
              size="lg"
              status="active"
              metrics={[
                { label: 'Engine', value: 'Aurora' },
                { label: 'Version', value: '15+' },
              ]}
              tags={['database', 'postgres', 'backstage']}
              docsUrl="https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/"
            />
            <ServiceCard
              icon={<CloudWatchIcon size={40} />}
              title="CloudWatch"
              description="Logs & metrics"
              details={[
                'Container Insights',
                'Log Groups',
                'Custom dashboards',
                'Alarms',
              ]}
              delay={0.9}
              size="lg"
              status="active"
              metrics={[
                { label: 'Log Groups', value: '5+' },
                { label: 'Retention', value: '30 days' },
              ]}
              tags={['monitoring', 'logs', 'metrics']}
              docsUrl="https://docs.aws.amazon.com/cloudwatch/"
            />
          </div>
        </Layer>

        {/* Observability Layer */}
        <Layer
          title="Observability"
          subtitle="Monitoring - Logging - Metrics"
          color="from-pink-900/20 to-slate-900/50"
          delay={0.7}
          className="mt-6"
        >
          <div className="grid grid-cols-3 gap-4">
            <ServiceCard
              icon={<GrafanaAlloyIcon size={36} />}
              title="Grafana Alloy"
              description="Telemetry collector"
              details={['OTLP ingestion', 'Prometheus scraping', 'Log forwarding']}
              delay={0.8}
              status="active"
              metrics={[
                { label: 'Targets', value: '20+' },
                { label: 'Interval', value: '30s' },
              ]}
              tags={['otel', 'prometheus', 'collector']}
              docsUrl="https://grafana.com/docs/alloy/latest/"
            />
            <ServiceCard
              icon={<Route53Icon size={36} />}
              title="Route 53"
              description="DNS management"
              details={['External-DNS integration', 'Auto record creation', 'Health checks']}
              delay={0.9}
              status="active"
              metrics={[
                { label: 'Hosted Zones', value: '2' },
                { label: 'Records', value: 'Auto' },
              ]}
              tags={['dns', 'routing', 'external-dns']}
              docsUrl="https://docs.aws.amazon.com/route53/"
            />
            <ServiceCard
              icon={<IAMIcon size={36} />}
              title="IAM / IRSA"
              description="Pod identity"
              details={['Service account roles', 'Least privilege', 'OIDC federation']}
              delay={1.0}
              status="active"
              metrics={[
                { label: 'Roles', value: '10+' },
                { label: 'Type', value: 'IRSA' },
              ]}
              tags={['iam', 'security', 'irsa']}
              docsUrl="https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html"
            />
          </div>
        </Layer>
      </motion.div>
    </div>
  );
};

const PlatformView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* IDP Platform Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative border-2 border-dashed border-purple-500/30 rounded-3xl p-8 bg-gradient-to-br from-purple-950/10 to-slate-950"
      >
        <div className="absolute -top-4 left-8 bg-slate-950 px-4 py-1 rounded-full border border-purple-500/30 cursor-pointer hover:border-purple-500/60 hover:bg-slate-900 transition-all">
          <span className="text-purple-400 text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            Internal Developer Platform
          </span>
        </div>

        {/* Developer Portal */}
        <Layer
          title="Developer Portal"
          subtitle="Self-service infrastructure & software catalog"
          color="from-purple-900/20 to-slate-900/50"
          delay={0.1}
          className="mb-6"
        >
          <div className="grid grid-cols-2 gap-6">
            <ServiceCard
              icon={<BackstageIcon size={40} />}
              title="Backstage"
              description="Developer portal"
              details={[
                'Software catalog',
                'Tech docs',
                'Custom templates',
                'Plugin ecosystem',
              ]}
              delay={0.2}
              size="lg"
              status="active"
              metrics={[
                { label: 'Templates', value: '10+' },
                { label: 'Plugins', value: '5+' },
              ]}
              tags={['portal', 'catalog', 'templates']}
              docsUrl="https://backstage.io/docs/"
            />
            <ServiceCard
              icon={<RDSIcon size={40} />}
              title="PostgreSQL"
              description="Backstage database"
              details={[
                'Catalog storage',
                'User data',
                'Template history',
                'Encrypted at rest',
              ]}
              delay={0.3}
              size="lg"
              status="active"
              metrics={[
                { label: 'Engine', value: 'PostgreSQL' },
                { label: 'Size', value: 'db.t3.medium' },
              ]}
              tags={['database', 'backstage', 'postgres']}
            />
          </div>
        </Layer>

        {/* GitOps Layer */}
        <Layer
          title="GitOps & Continuous Delivery"
          subtitle="Declarative, git-based deployments"
          color="from-orange-900/20 to-slate-900/50"
          delay={0.3}
          className="mb-6"
        >
          <div className="grid grid-cols-2 gap-6">
            <ServiceCard
              icon={<ArgoCDIcon size={40} />}
              title="ArgoCD"
              description="GitOps engine"
              details={[
                'Auto-sync enabled',
                'Self-heal',
                'Prune resources',
                'Multi-cluster support',
              ]}
              delay={0.4}
              size="lg"
              status="active"
              metrics={[
                { label: 'Applications', value: '20+' },
                { label: 'Sync Policy', value: 'Auto' },
              ]}
              tags={['gitops', 'cd', 'declarative']}
              docsUrl="https://argo-cd.readthedocs.io/"
            />
            <ServiceCard
              icon={<ArgoRolloutsIcon size={40} />}
              title="Argo Rollouts"
              description="Progressive delivery"
              details={[
                'Canary deployments',
                'Blue-green',
                'Analysis runs',
                'Auto rollback',
              ]}
              delay={0.5}
              size="lg"
              status="active"
              metrics={[
                { label: 'Strategies', value: '2' },
                { label: 'Rollback', value: 'Auto' },
              ]}
              tags={['canary', 'blue-green', 'progressive']}
              docsUrl="https://argoproj.github.io/argo-rollouts/"
            />
          </div>
        </Layer>

        {/* CI/CD Layer */}
        <Layer
          title="CI/CD & Event-Driven Automation"
          subtitle="Workflow orchestration & event triggers"
          color="from-orange-900/20 to-slate-900/50"
          delay={0.5}
        >
          <div className="grid grid-cols-2 gap-6">
            <ServiceCard
              icon={<ArgoWorkflowsIcon size={40} />}
              title="Argo Workflows"
              description="CI/CD pipelines"
              details={[
                'Kubernetes-native',
                'DAG workflows',
                'S3 artifact storage',
                'Template library',
              ]}
              delay={0.6}
              size="lg"
              status="active"
              metrics={[
                { label: 'Templates', value: '15+' },
                { label: 'Artifacts', value: 'S3' },
              ]}
              tags={['ci', 'workflows', 'pipelines']}
              docsUrl="https://argoproj.github.io/argo-workflows/"
            />
            <ServiceCard
              icon={<ArgoEventsIcon size={40} />}
              title="Argo Events"
              description="Event-driven triggers"
              details={[
                'Webhook sources',
                'GitHub integration',
                'SQS support',
                'Sensor filters',
              ]}
              delay={0.7}
              size="lg"
              status="active"
              metrics={[
                { label: 'Event Sources', value: '5+' },
                { label: 'Sensors', value: '10+' },
              ]}
              tags={['events', 'webhooks', 'triggers']}
              docsUrl="https://argoproj.github.io/argo-events/"
            />
          </div>
        </Layer>
      </motion.div>

      {/* Security Configuration */}
      <Layer
        title="Security Configuration"
        subtitle="TLS - Authentication - Authorization"
        color="from-red-900/20 to-slate-900/50"
        delay={0.7}
      >
        <div className="grid grid-cols-4 gap-4">
          <ServiceCard
            icon={<CertManagerIcon size={36} />}
            title="TLS Certificates"
            description="Automated cert management"
            details={['Let\'s Encrypt issuer', 'Auto-renewal', 'Wildcard support', 'ACME DNS01']}
            delay={0.8}
            status="active"
            metrics={[
              { label: 'Certs', value: '5+' },
              { label: 'Issuer', value: 'LE' },
            ]}
            tags={['tls', 'certificates', 'encryption']}
          />
          <ServiceCard
            icon={<IAMIcon size={36} />}
            title="RBAC"
            description="Role-based access"
            details={['Namespace isolation', 'Service accounts', 'Role bindings', 'Least privilege']}
            delay={0.9}
            status="active"
            metrics={[
              { label: 'Roles', value: '10+' },
              { label: 'Bindings', value: '20+' },
            ]}
            tags={['rbac', 'security', 'access']}
          />
          <ServiceCard
            icon={<SecretsManagerIcon size={36} />}
            title="Secret Management"
            description="External Secrets sync"
            details={['AWS SM integration', 'Auto-refresh', 'Encryption', 'Rotation support']}
            delay={1.0}
            status="active"
            metrics={[
              { label: 'Secrets', value: '10+' },
              { label: 'Refresh', value: '1h' },
            ]}
            tags={['secrets', 'encryption', 'sync']}
          />
          <ServiceCard
            icon={<IAMIcon size={36} />}
            title="Pod Identity"
            description="IRSA configuration"
            details={['S3 access', 'Secrets Manager', 'RDS access', 'Fine-grained IAM']}
            delay={1.1}
            status="active"
            metrics={[
              { label: 'Roles', value: '10+' },
              { label: 'Type', value: 'IRSA' },
            ]}
            tags={['iam', 'irsa', 'pod-identity']}
          />
        </div>
      </Layer>
    </div>
  );
};

const DataFlowView: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* GitOps Flow */}
      <Layer
        title="GitOps Deployment Flow"
        subtitle="Git-based continuous delivery"
        color="from-blue-900/20 to-slate-900/50"
      >
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-blue-500 flex items-center justify-center mb-2">
                <span className="text-2xl">👤</span>
              </div>
              <span className="text-xs text-slate-400">Developer</span>
              <span className="text-[10px] text-slate-600 mt-1">Push Code</span>
            </motion.div>

            <DataFlowArrow direction="right" label="1. Git Push" />

            <ServiceCard
              icon={<GitIcon size={32} />}
              title="Git Repository"
              description="Source of truth"
              details={['Manifests', 'Helm charts', 'Kustomize']}
              delay={0.3}
              size="sm"
              status="active"
              tags={['git', 'source']}
            />

            <DataFlowArrow direction="right" label="2. Detect" />

            <ServiceCard
              icon={<ArgoCDIcon size={32} />}
              title="ArgoCD"
              description="Sync & reconcile"
              details={['Diff detection', 'Auto-sync', 'Health check']}
              delay={0.4}
              size="sm"
              status="active"
              tags={['gitops', 'sync']}
            />

            <DataFlowArrow direction="right" label="3. Apply" />

            <ServiceCard
              icon={<KubernetesIcon size={32} />}
              title="Kubernetes"
              description="Apply manifests"
              details={['Resource creation', 'Rolling update', 'Health probes']}
              delay={0.5}
              size="sm"
              status="active"
              tags={['k8s', 'apply']}
            />

            <DataFlowArrow direction="right" label="4. Rollout" />

            <ServiceCard
              icon={<ArgoRolloutsIcon size={32} />}
              title="Rollouts"
              description="Progressive delivery"
              details={['Canary', 'Analysis', 'Promotion']}
              delay={0.6}
              size="sm"
              status="active"
              tags={['canary', 'rollout']}
            />
          </div>
        </div>
      </Layer>

      {/* CI/CD Flow */}
      <Layer
        title="CI/CD Workflow Flow"
        subtitle="Event-driven build & test pipelines"
        color="from-green-900/20 to-slate-900/50"
        delay={0.3}
      >
        <div className="flex items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-green-500 flex items-center justify-center mb-2">
              <span className="text-2xl">📡</span>
            </div>
            <span className="text-xs text-slate-400">Event</span>
            <span className="text-[10px] text-slate-600 mt-1">Webhook/Push</span>
          </motion.div>

          <DataFlowArrow direction="right" label="1. Trigger" />

          <ServiceCard
            icon={<ArgoEventsIcon size={32} />}
            title="Event Source"
            description="Webhook receiver"
            details={['GitHub webhook', 'Filtering', 'Validation']}
            delay={0.5}
            size="sm"
            status="active"
            tags={['events', 'webhook']}
          />

          <DataFlowArrow direction="right" label="2. Process" />

          <ServiceCard
            icon={<ArgoEventsIcon size={32} />}
            title="Sensor"
            description="Event processing"
            details={['Filter events', 'Transform', 'Trigger workflows']}
            delay={0.6}
            size="sm"
            status="active"
            tags={['sensor', 'filter']}
          />

          <DataFlowArrow direction="right" label="3. Execute" />

          <ServiceCard
            icon={<ArgoWorkflowsIcon size={32} />}
            title="Workflow"
            description="CI pipeline"
            details={['Build', 'Test', 'Push image']}
            delay={0.7}
            size="sm"
            status="active"
            tags={['ci', 'build']}
          />

          <DataFlowArrow direction="right" label="4. Store" />

          <ServiceCard
            icon={<S3Icon size={32} />}
            title="Artifacts"
            description="S3 storage"
            details={['Build logs', 'Test results', 'Images']}
            delay={0.8}
            size="sm"
            status="active"
            tags={['s3', 'artifacts']}
          />
        </div>
      </Layer>

      {/* Developer Self-Service Flow */}
      <Layer
        title="Developer Self-Service Flow"
        subtitle="Backstage templates to deployed application"
        color="from-purple-900/20 to-slate-900/50"
        delay={0.5}
      >
        <div className="flex items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-purple-500 flex items-center justify-center mb-2">
              <span className="text-2xl">👩‍💻</span>
            </div>
            <span className="text-xs text-slate-400">Developer</span>
            <span className="text-[10px] text-slate-600 mt-1">Request</span>
          </motion.div>

          <DataFlowArrow direction="right" label="1. Template" />

          <ServiceCard
            icon={<BackstageIcon size={32} />}
            title="Backstage"
            description="Select template"
            details={['Service template', 'Fill parameters', 'Submit']}
            delay={0.7}
            size="sm"
            status="active"
            tags={['backstage', 'template']}
          />

          <DataFlowArrow direction="right" label="2. Scaffold" />

          <ServiceCard
            icon={<GitIcon size={32} />}
            title="Git Repository"
            description="Created repo"
            details={['Scaffolded code', 'CI config', 'K8s manifests']}
            delay={0.8}
            size="sm"
            status="active"
            tags={['git', 'scaffold']}
          />

          <DataFlowArrow direction="right" label="3. Register" />

          <ServiceCard
            icon={<ArgoCDIcon size={32} />}
            title="ArgoCD App"
            description="Auto-registered"
            details={['App created', 'Sync enabled', 'Monitoring']}
            delay={0.9}
            size="sm"
            status="active"
            tags={['argocd', 'app']}
          />

          <DataFlowArrow direction="right" label="4. Deploy" />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
            className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-green-500 flex items-center justify-center mb-2">
              <span className="text-2xl">🚀</span>
            </div>
            <span className="text-xs text-slate-400">Running</span>
            <span className="text-[10px] text-slate-600 mt-1">Application</span>
          </motion.div>
        </div>
      </Layer>

      {/* Secrets Flow */}
      <Layer
        title="Secrets Management Flow"
        subtitle="AWS Secrets Manager to Kubernetes Secrets"
        color="from-red-900/20 to-slate-900/50"
        delay={0.7}
      >
        <div className="flex items-center justify-between gap-4">
          <ServiceCard
            icon={<SecretsManagerIcon size={32} />}
            title="Secrets Manager"
            description="AWS secrets"
            details={['Credentials', 'API keys', 'Certificates']}
            delay={0.8}
            size="sm"
            status="active"
            tags={['aws', 'secrets']}
          />

          <DataFlowArrow direction="right" label="1. Fetch" />

          <ServiceCard
            icon={<ExternalSecretsIcon size={32} />}
            title="External Secrets"
            description="Sync operator"
            details={['ClusterSecretStore', 'Auto-refresh', 'Mapping']}
            delay={0.9}
            size="sm"
            status="active"
            tags={['eso', 'sync']}
          />

          <DataFlowArrow direction="right" label="2. Create" />

          <ServiceCard
            icon={<KubernetesIcon size={32} />}
            title="K8s Secret"
            description="Native secret"
            details={['Namespace scoped', 'Encrypted', 'Mounted']}
            delay={1.0}
            size="sm"
            status="active"
            tags={['k8s', 'secret']}
          />

          <DataFlowArrow direction="right" label="3. Detect" />

          <ServiceCard
            icon={<ReloaderIcon size={32} />}
            title="Reloader"
            description="Pod restart"
            details={['Watch secrets', 'Rolling restart', 'Zero downtime']}
            delay={1.1}
            size="sm"
            status="active"
            tags={['reloader', 'restart']}
          />

          <DataFlowArrow direction="right" label="4. Update" />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
            className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-green-500 flex items-center justify-center mb-2">
              <span className="text-2xl">🔐</span>
            </div>
            <span className="text-xs text-slate-400">Updated</span>
            <span className="text-[10px] text-slate-600 mt-1">Pods</span>
          </motion.div>
        </div>
      </Layer>
    </div>
  );
};

const DeploymentView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* CDK Stack Hierarchy */}
      <Layer
        title="CDK Stack Architecture"
        subtitle="Infrastructure as Code - Java CDK"
        color="from-yellow-900/20 to-slate-900/50"
      >
        <div className="relative">
          {/* Main Stack */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/50 rounded-xl p-6 border border-yellow-500/30 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <CDKIcon size={40} />
              <div>
                <h3 className="text-white font-bold">IdpStack</h3>
                <p className="text-slate-400 text-xs">Main CDK Stack - Orchestrates all nested stacks</p>
              </div>
            </div>

            {/* Nested Stacks Grid */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'NetworkNestedStack', desc: 'VPC, Subnets, NAT', icon: <VPCIcon size={28} />, dep: 'None' },
                { name: 'EksNestedStack', desc: 'EKS Cluster', icon: <EKSIcon size={28} />, dep: 'Network' },
                { name: 'AddonsNestedStack', desc: 'Core K8s Addons', icon: <HelmIcon size={28} />, dep: 'EKS' },
                { name: 'ObservabilityStack', desc: 'Grafana Alloy', icon: <GrafanaAlloyIcon size={28} />, dep: 'EKS' },
                { name: 'IdpSetupStack', desc: 'TLS, Storage, IAM', icon: <CertManagerIcon size={28} />, dep: 'Addons' },
                { name: 'BackstageStack', desc: 'Developer Portal', icon: <BackstageIcon size={28} />, dep: 'Setup' },
                { name: 'ArgoCdStack', desc: 'GitOps Engine', icon: <ArgoCDIcon size={28} />, dep: 'Setup' },
                { name: 'ArgoWorkflowsStack', desc: 'CI/CD Pipelines', icon: <ArgoWorkflowsIcon size={28} />, dep: 'ArgoCD' },
                { name: 'ArgoEventsStack', desc: 'Event Triggers', icon: <ArgoEventsIcon size={28} />, dep: 'Workflows' },
                { name: 'ArgoRolloutsStack', desc: 'Progressive Delivery', icon: <ArgoRolloutsIcon size={28} />, dep: 'Events' },
              ].map((stack, idx) => (
                <motion.div
                  key={stack.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                  className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/50 hover:border-yellow-500/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {stack.icon}
                    <span className="text-xs font-medium text-white truncate group-hover:text-yellow-400 transition-colors">{stack.name.replace('NestedStack', '').replace('Stack', '')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{stack.desc}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[9px] text-slate-600">Depends:</span>
                    <span className="text-[9px] text-orange-400">{stack.dep}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Deployment Order */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
            <h4 className="text-sm font-semibold text-white mb-3">Deployment Order</h4>
            <div className="flex items-center justify-between text-xs">
              {['Network', 'EKS', 'Addons', 'Setup', 'Backstage', 'Argo Stack'].map((step, idx) => (
                <React.Fragment key={step}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + idx * 0.1 }}
                    className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform"
                    title={`Step ${idx + 1}: Deploy ${step}`}
                  >
                    <span className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold mb-1 hover:bg-orange-500 transition-colors">
                      {idx + 1}
                    </span>
                    <span className="text-slate-400 text-center">{step}</span>
                  </motion.div>
                  {idx < 5 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.9 + idx * 0.1 }}
                      className="flex-1 h-0.5 bg-gradient-to-r from-orange-500 to-orange-400"
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </Layer>

      {/* Helm Chart Deployment */}
      <Layer
        title="Helm Chart Deployment"
        subtitle="Kubernetes package management"
        color="from-blue-900/20 to-slate-900/50"
        delay={0.3}
      >
        <div className="flex items-center justify-between gap-6">
          <ServiceCard
            icon={<CDKIcon size={36} />}
            title="CDK Values"
            description="Mustache templating"
            details={['Dynamic configuration', 'Context injection', 'Environment-specific']}
            delay={0.4}
            status="active"
            metrics={[
              { label: 'Templates', value: '20+' },
              { label: 'Variables', value: '50+' },
            ]}
            tags={['cdk', 'mustache', 'config']}
          />

          <DataFlowArrow direction="right" label="Generate" />

          <ServiceCard
            icon={<HelmIcon size={36} />}
            title="Helm Values"
            description="values.yaml"
            details={['Component configs', 'Resource limits', 'Node selectors']}
            delay={0.5}
            status="active"
            tags={['helm', 'values', 'yaml']}
          />

          <DataFlowArrow direction="right" label="Template" />

          <ServiceCard
            icon={<KubernetesIcon size={36} />}
            title="K8s Resources"
            description="Manifests"
            details={['Deployments', 'Services', 'ConfigMaps', 'Secrets']}
            delay={0.6}
            status="active"
            metrics={[
              { label: 'Resources', value: '50+' },
              { label: 'Namespaces', value: '10+' },
            ]}
            tags={['kubernetes', 'manifests']}
          />

          <DataFlowArrow direction="right" label="Apply" />

          <ServiceCard
            icon={<EKSIcon size={36} />}
            title="EKS Cluster"
            description="Running pods"
            details={['Rolling updates', 'Health checks', 'Auto-scaling']}
            delay={0.7}
            status="active"
            metrics={[
              { label: 'Pods', value: '30+' },
              { label: 'Services', value: '15+' },
            ]}
            tags={['eks', 'deployment', 'running']}
          />
        </div>

        {/* Helm Charts List */}
        <div className="mt-6 bg-slate-800/20 rounded-xl p-4 border border-slate-700/20">
          <h4 className="text-sm font-semibold text-white mb-3">Deployed Helm Charts</h4>
          <div className="grid grid-cols-6 gap-3">
            {[
              { name: 'cert-manager', version: '1.17+' },
              { name: 'karpenter', version: '1.1+' },
              { name: 'external-dns', version: '1.15+' },
              { name: 'external-secrets', version: '0.12+' },
              { name: 'argocd', version: '7.8+' },
              { name: 'argo-workflows', version: '0.45+' },
              { name: 'argo-events', version: '2.4+' },
              { name: 'argo-rollouts', version: '2.38+' },
              { name: 'backstage', version: '2.6+' },
              { name: 'alloy', version: '0.12+' },
              { name: 'metrics-server', version: '3.12+' },
              { name: 'reloader', version: '1.2+' },
            ].map((chart, idx) => (
              <motion.div
                key={chart.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + idx * 0.05 }}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 cursor-pointer hover:border-blue-500/50 transition-all"
              >
                <div className="text-sm font-medium text-white">{chart.name}</div>
                <div className="text-[10px] text-orange-400 mt-1">v{chart.version}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layer>

      {/* CLI Commands */}
      <Layer
        title="Deployment Commands"
        subtitle="CDK CLI deployment options"
        color="from-green-900/20 to-slate-900/50"
        delay={0.5}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-900 rounded-lg p-4 font-mono text-sm"
        >
          <div className="text-slate-500"># Deploy all stacks (nested mode)</div>
          <div className="text-green-400">cdk deploy --all</div>
          <div className="text-slate-500 mt-4"># Deploy independent stacks</div>
          <div className="text-green-400">cdk deploy --context independent-stacks=true</div>
          <div className="text-green-400">cdk deploy *-network</div>
          <div className="text-green-400">cdk deploy *-eks</div>
          <div className="text-green-400">cdk deploy *-core-addons</div>
          <div className="text-slate-500 mt-4"># Synthesize CloudFormation</div>
          <div className="text-green-400">cdk synth</div>
        </motion.div>
      </Layer>
    </div>
  );
};

export default IdpArchitecture;
