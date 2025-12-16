import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// AWS Services

export const EKSIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <path d="M40 16L58 26V54L40 64L22 54V26L40 16Z" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 16V64M22 26L58 54M58 26L22 54" stroke="white" strokeWidth="2" opacity="0.7"/>
    <circle cx="40" cy="40" r="8" fill="white"/>
    <circle cx="40" cy="16" r="4" fill="white"/>
    <circle cx="40" cy="64" r="4" fill="white"/>
    <circle cx="22" cy="26" r="4" fill="white"/>
    <circle cx="58" cy="26" r="4" fill="white"/>
    <circle cx="22" cy="54" r="4" fill="white"/>
    <circle cx="58" cy="54" r="4" fill="white"/>
  </svg>
);

export const VPCIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#8B5CF6"/>
    <rect x="16" y="16" width="48" height="48" rx="4" fill="none" stroke="white" strokeWidth="2.5"/>
    <rect x="24" y="24" width="32" height="32" rx="2" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 2"/>
    <circle cx="40" cy="40" r="6" fill="white"/>
    <path d="M16 32H24M56 32H64M16 48H24M56 48H64" stroke="white" strokeWidth="2.5"/>
  </svg>
);

export const S3Icon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#22C55E"/>
    <path d="M40 18L56 26V38L40 46L24 38V26L40 18Z" fill="white" opacity="0.9"/>
    <path d="M40 34L56 42V54L40 62L24 54V42L40 34Z" fill="white" opacity="0.7"/>
    <path d="M24 26L40 34L56 26" stroke="#22C55E" strokeWidth="1.5"/>
    <path d="M40 34V46" stroke="#22C55E" strokeWidth="1.5"/>
  </svg>
);

export const SecretsManagerIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#EF4444"/>
    <rect x="26" y="34" width="28" height="26" rx="3" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M32 34V28C32 23.6 35.6 20 40 20C44.4 20 48 23.6 48 28V34" fill="none" stroke="white" strokeWidth="2.5"/>
    <circle cx="40" cy="46" r="4" fill="white"/>
    <path d="M40 50V54" stroke="white" strokeWidth="2.5"/>
  </svg>
);

export const IAMIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#EF4444"/>
    <circle cx="40" cy="30" r="10" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M24 58C24 48 31 42 40 42C49 42 56 48 56 58" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 42V58M32 50H48" stroke="white" strokeWidth="2" opacity="0.6"/>
  </svg>
);

export const ALBIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#8B5CF6"/>
    <circle cx="40" cy="40" r="18" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M28 40H52M40 28V52" stroke="white" strokeWidth="2.5"/>
    <circle cx="40" cy="28" r="4" fill="white"/>
    <circle cx="40" cy="52" r="4" fill="white"/>
    <circle cx="28" cy="40" r="4" fill="white"/>
    <circle cx="52" cy="40" r="4" fill="white"/>
  </svg>
);

export const CloudWatchIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#EC4899"/>
    <circle cx="40" cy="40" r="20" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 24V40L52 46" fill="none" stroke="white" strokeWidth="2.5"/>
    <circle cx="40" cy="40" r="3" fill="white"/>
  </svg>
);

export const Route53Icon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#8B5CF6"/>
    <circle cx="40" cy="40" r="20" fill="none" stroke="white" strokeWidth="2.5"/>
    <ellipse cx="40" cy="40" rx="20" ry="8" fill="none" stroke="white" strokeWidth="2"/>
    <ellipse cx="40" cy="40" rx="8" ry="20" fill="none" stroke="white" strokeWidth="2"/>
    <text x="40" y="46" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">53</text>
  </svg>
);

export const RDSIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#3B82F6"/>
    <ellipse cx="40" cy="26" rx="18" ry="8" fill="white" opacity="0.9"/>
    <path d="M22 26V54C22 58.4 30 62 40 62C50 62 58 58.4 58 54V26" fill="none" stroke="white" strokeWidth="2.5"/>
    <ellipse cx="40" cy="40" rx="18" ry="8" fill="none" stroke="white" strokeWidth="2" opacity="0.6"/>
    <ellipse cx="40" cy="54" rx="18" ry="8" fill="none" stroke="white" strokeWidth="2" opacity="0.6"/>
  </svg>
);

// Platform Tools

export const ArgoCDIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <circle cx="40" cy="40" r="20" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M30 40L38 48L52 32" fill="none" stroke="white" strokeWidth="3"/>
    <circle cx="40" cy="40" r="8" fill="none" stroke="white" strokeWidth="2" opacity="0.5"/>
  </svg>
);

export const ArgoWorkflowsIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <rect x="20" y="24" width="16" height="12" rx="2" fill="white"/>
    <rect x="44" y="24" width="16" height="12" rx="2" fill="white"/>
    <rect x="32" y="44" width="16" height="12" rx="2" fill="white"/>
    <path d="M28 36V40H40V44M52 36V40H40" stroke="white" strokeWidth="2"/>
  </svg>
);

export const ArgoEventsIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <circle cx="28" cy="40" r="10" fill="white" opacity="0.9"/>
    <path d="M38 40H54" stroke="white" strokeWidth="3"/>
    <path d="M48 34L56 40L48 46" fill="white"/>
    <circle cx="28" cy="40" r="4" fill="#F97316"/>
  </svg>
);

export const ArgoRolloutsIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <rect x="20" y="28" width="18" height="24" rx="2" fill="white" opacity="0.5"/>
    <rect x="42" y="28" width="18" height="24" rx="2" fill="white"/>
    <path d="M35 40H45" stroke="white" strokeWidth="2"/>
    <path d="M41 36L45 40L41 44" fill="none" stroke="white" strokeWidth="2"/>
  </svg>
);

export const BackstageIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#9333EA"/>
    <circle cx="40" cy="32" r="12" fill="white"/>
    <path d="M22 58C22 48 30 42 40 42C50 42 58 48 58 58" fill="white"/>
    <rect x="34" y="50" width="12" height="8" rx="1" fill="#9333EA"/>
  </svg>
);

export const KarpenterIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#06B6D4"/>
    <rect x="24" y="24" width="14" height="14" rx="2" fill="white"/>
    <rect x="42" y="24" width="14" height="14" rx="2" fill="white"/>
    <rect x="24" y="42" width="14" height="14" rx="2" fill="white"/>
    <rect x="42" y="42" width="14" height="14" rx="2" fill="white" opacity="0.5"/>
    <path d="M56 56L64 64M60 52L68 60" stroke="white" strokeWidth="2"/>
  </svg>
);

export const CertManagerIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#22C55E"/>
    <path d="M40 18L56 28V44L40 62L24 44V28L40 18Z" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M32 40L38 46L50 34" fill="none" stroke="white" strokeWidth="3"/>
  </svg>
);

export const ExternalSecretsIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#EAB308"/>
    <rect x="26" y="30" width="28" height="24" rx="3" fill="none" stroke="white" strokeWidth="2.5"/>
    <circle cx="40" cy="42" r="5" fill="white"/>
    <path d="M40 47V50" stroke="white" strokeWidth="2"/>
    <path d="M18 36L26 42M18 44L26 42M62 36L54 42M62 44L54 42" stroke="white" strokeWidth="2"/>
  </svg>
);

export const ExternalDNSIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#3B82F6"/>
    <circle cx="40" cy="40" r="16" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 24V56M24 40H56" stroke="white" strokeWidth="2"/>
    <path d="M18 32L28 40M18 48L28 40M62 32L52 40M62 48L52 40" stroke="white" strokeWidth="2"/>
  </svg>
);

export const GrafanaAlloyIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <circle cx="40" cy="40" r="18" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M28 50L36 38L44 44L52 30" fill="none" stroke="white" strokeWidth="2.5"/>
    <circle cx="36" cy="38" r="3" fill="white"/>
    <circle cx="44" cy="44" r="3" fill="white"/>
    <circle cx="52" cy="30" r="3" fill="white"/>
  </svg>
);

export const MetricsServerIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#14B8A6"/>
    <rect x="22" y="44" width="8" height="16" rx="1" fill="white"/>
    <rect x="36" y="32" width="8" height="28" rx="1" fill="white"/>
    <rect x="50" y="24" width="8" height="36" rx="1" fill="white"/>
    <path d="M26 40L40 28L54 20" fill="none" stroke="white" strokeWidth="2" opacity="0.6"/>
  </svg>
);

export const ReloaderIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#8B5CF6"/>
    <circle cx="40" cy="40" r="16" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 28V40L48 44" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M52 28C56 32 58 36 58 40" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M54 22L52 28L58 30" fill="none" stroke="white" strokeWidth="2"/>
  </svg>
);

// Infrastructure Tools

export const HelmIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#0F766E"/>
    <circle cx="40" cy="40" r="18" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M40 22V34M40 46V58" stroke="white" strokeWidth="3"/>
    <path d="M26 32L36 38M44 42L54 48" stroke="white" strokeWidth="3"/>
    <path d="M26 48L36 42M44 38L54 32" stroke="white" strokeWidth="3"/>
    <circle cx="40" cy="40" r="4" fill="white"/>
  </svg>
);

export const CDKIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <rect x="24" y="20" width="32" height="40" rx="3" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M32 32H48M32 40H44M32 48H40" stroke="white" strokeWidth="2"/>
    <rect x="24" y="20" width="32" height="8" rx="3" fill="white" opacity="0.3"/>
  </svg>
);

export const KubernetesIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#326CE5"/>
    <path d="M40 16L58 26V54L40 64L22 54V26L40 16Z" fill="none" stroke="white" strokeWidth="2.5"/>
    <circle cx="40" cy="40" r="10" fill="white"/>
    <path d="M40 30V50M32 36L48 44M48 36L32 44" stroke="#326CE5" strokeWidth="2"/>
  </svg>
);

export const DockerIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#2496ED"/>
    <path d="M18 40H62C62 52 52 60 40 60C28 60 18 52 18 40Z" fill="white" opacity="0.3"/>
    <rect x="22" y="32" width="8" height="6" rx="1" fill="white"/>
    <rect x="32" y="32" width="8" height="6" rx="1" fill="white"/>
    <rect x="42" y="32" width="8" height="6" rx="1" fill="white"/>
    <rect x="32" y="24" width="8" height="6" rx="1" fill="white"/>
    <rect x="42" y="24" width="8" height="6" rx="1" fill="white"/>
    <rect x="52" y="32" width="8" height="6" rx="1" fill="white"/>
    <rect x="42" y="16" width="8" height="6" rx="1" fill="white"/>
  </svg>
);

export const GitIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F05032"/>
    <circle cx="32" cy="28" r="6" fill="white"/>
    <circle cx="48" cy="40" r="6" fill="white"/>
    <circle cx="32" cy="52" r="6" fill="white"/>
    <path d="M32 34V46M38 28L42 40" stroke="white" strokeWidth="3"/>
  </svg>
);

export const TerraformIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#7C3AED"/>
    <path d="M28 22V38L42 46V30L28 22Z" fill="white"/>
    <path d="M44 30V46L58 38V22L44 30Z" fill="white" opacity="0.7"/>
    <path d="M28 42V58L42 50V34L28 42Z" fill="white" opacity="0.5"/>
  </svg>
);

// Additional utility icons

export const NetworkIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#8B5CF6"/>
    <circle cx="40" cy="24" r="8" fill="white"/>
    <circle cx="24" cy="52" r="8" fill="white"/>
    <circle cx="56" cy="52" r="8" fill="white"/>
    <path d="M40 32V40L24 48M40 40L56 48" stroke="white" strokeWidth="2.5"/>
  </svg>
);

export const SecurityIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#EF4444"/>
    <path d="M40 16L56 24V40C56 52 48 60 40 64C32 60 24 52 24 40V24L40 16Z" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M32 40L38 46L50 34" fill="none" stroke="white" strokeWidth="3"/>
  </svg>
);

export const DatabaseIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#3B82F6"/>
    <ellipse cx="40" cy="24" rx="18" ry="8" fill="white"/>
    <path d="M22 24V56C22 60.4 30 64 40 64C50 64 58 60.4 58 56V24" fill="none" stroke="white" strokeWidth="2.5"/>
    <ellipse cx="40" cy="40" rx="18" ry="8" fill="none" stroke="white" strokeWidth="2"/>
    <ellipse cx="40" cy="56" rx="18" ry="8" fill="none" stroke="white" strokeWidth="2"/>
  </svg>
);

export const StorageIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#22C55E"/>
    <rect x="20" y="20" width="40" height="12" rx="2" fill="white"/>
    <rect x="20" y="34" width="40" height="12" rx="2" fill="white" opacity="0.8"/>
    <rect x="20" y="48" width="40" height="12" rx="2" fill="white" opacity="0.6"/>
    <circle cx="52" cy="26" r="2" fill="#22C55E"/>
    <circle cx="52" cy="40" r="2" fill="#22C55E"/>
    <circle cx="52" cy="54" r="2" fill="#22C55E"/>
  </svg>
);

export const FlowIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#14B8A6"/>
    <circle cx="24" cy="40" r="8" fill="white"/>
    <circle cx="56" cy="40" r="8" fill="white"/>
    <path d="M32 40H48" stroke="white" strokeWidth="3"/>
    <path d="M44 34L50 40L44 46" fill="none" stroke="white" strokeWidth="2"/>
  </svg>
);

export const PipelineIcon: React.FC<IconProps> = ({ className = '', size = 48 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="#F97316"/>
    <rect x="16" y="34" width="12" height="12" rx="2" fill="white"/>
    <rect x="34" y="34" width="12" height="12" rx="2" fill="white"/>
    <rect x="52" y="34" width="12" height="12" rx="2" fill="white"/>
    <path d="M28 40H34M46 40H52" stroke="white" strokeWidth="2"/>
  </svg>
);
