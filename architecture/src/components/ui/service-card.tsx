'use client';

import { motion } from 'framer-motion';
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import { ExternalLink, Info, Zap, Database, Clock } from 'lucide-react';

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: string[];
  color?: string;
  delay?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  docsUrl?: string;
  status?: 'active' | 'provisioning' | 'degraded';
  metrics?: {
    label: string;
    value: string;
  }[];
  tags?: string[];
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  icon,
  title,
  description,
  details = [],
  color = 'bg-slate-800',
  delay = 0,
  className = '',
  size = 'md',
  docsUrl,
  status = 'active',
  metrics = [],
  tags = [],
}) => {
  const sizeClasses = {
    sm: 'p-3 min-w-[140px]',
    md: 'p-4 min-w-[180px]',
    lg: 'p-5 min-w-[220px]',
  };

  const statusColors = {
    active: 'bg-green-500',
    provisioning: 'bg-yellow-500',
    degraded: 'bg-red-500',
  };

  const statusLabels = {
    active: 'Active',
    provisioning: 'Provisioning',
    degraded: 'Degraded',
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay, ease: 'easeOut' }}
          whileHover={{ scale: 1.02, y: -2 }}
          className={cn(
            sizeClasses[size],
            color,
            'rounded-xl border border-slate-700/50',
            'backdrop-blur-sm shadow-xl hover:shadow-2xl hover:border-orange-500/50',
            'transition-all duration-300 group cursor-pointer',
            'ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
            className
          )}
          tabIndex={0}
          role="button"
          aria-label={`View details for ${title}`}
        >
          <div className="flex items-start gap-3">
            <motion.div
              whileHover={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 0.3 }}
              className="flex-shrink-0 relative"
            >
              {icon}
              <span className={cn(
                'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                statusColors[status],
                status === 'provisioning' && 'animate-pulse'
              )} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight mb-1 group-hover:text-orange-300 transition-colors flex items-center gap-1">
                {title}
                <Info className="w-3 h-3 text-slate-500 group-hover:text-orange-400 transition-colors" />
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
              {details.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-1"
                >
                  {details.slice(0, 2).map((detail, idx) => (
                    <li key={idx} className="text-slate-500 text-[10px] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-orange-400"></span>
                      {detail}
                    </li>
                  ))}
                  {details.length > 2 && (
                    <li className="text-orange-400 text-[10px] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-orange-400"></span>
                      +{details.length - 2} more...
                    </li>
                  )}
                </motion.ul>
              )}
            </div>
          </div>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-slate-900/95 backdrop-blur-xl border-slate-700/50 p-0 overflow-hidden"
        sideOffset={8}
      >
        {/* Popover Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-b border-slate-700/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-white">{title}</h4>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] border-0',
                    status === 'active' && 'bg-green-500/20 text-green-400',
                    status === 'provisioning' && 'bg-yellow-500/20 text-yellow-400',
                    status === 'degraded' && 'bg-red-500/20 text-red-400'
                  )}
                >
                  {statusLabels[status]}
                </Badge>
              </div>
              <p className="text-slate-400 text-sm">{description}</p>
            </div>
          </div>
        </div>

        {/* Popover Body */}
        <div className="p-4 space-y-4">
          {/* Details */}
          {details.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3 text-orange-400" />
                Features
              </h5>
              <ul className="space-y-1.5">
                {details.map((detail, idx) => (
                  <li key={idx} className="text-slate-400 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60"></span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {metrics.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                <Database className="w-3 h-3 text-purple-400" />
                Metrics
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map((metric, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">{metric.label}</div>
                    <div className="text-sm font-mono text-white">{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="text-[10px] bg-slate-800 text-slate-300 border-slate-700"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Docs Link */}
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              View Documentation
            </a>
          )}
        </div>

        {/* Quick Actions Footer */}
        <div className="bg-slate-800/50 border-t border-slate-700/50 px-4 py-2">
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Click to view in AWS Console
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface LayerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  color?: string;
  delay?: number;
  className?: string;
}

export const Layer: React.FC<LayerProps> = ({
  title,
  subtitle,
  children,
  color = 'from-slate-800/50 to-slate-900/50',
  delay = 0,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay }}
      className={cn(
        'relative bg-gradient-to-br rounded-2xl border border-slate-700/30 p-6',
        color,
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4 cursor-pointer group/layer hover:opacity-90 transition-opacity">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-orange-500 to-amber-500 group-hover/layer:from-orange-400 group-hover/layer:to-amber-400 transition-all"></div>
        <div>
          <h2 className="text-lg font-bold text-white group-hover/layer:text-orange-300 transition-colors">{title}</h2>
          {subtitle && <p className="text-slate-400 text-xs">{subtitle}</p>}
        </div>
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
};

interface DataFlowArrowProps {
  className?: string;
  direction?: 'right' | 'down' | 'left' | 'up';
  label?: string;
}

export const DataFlowArrow: React.FC<DataFlowArrowProps> = ({
  className = '',
  direction = 'right',
  label,
}) => {
  const rotations = {
    right: 'rotate-0',
    down: 'rotate-90',
    left: 'rotate-180',
    up: '-rotate-90',
  };

  return (
    <div className={`flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform ${className}`}>
      {label && <span className="text-[9px] text-slate-500 whitespace-nowrap">{label}</span>}
      <motion.svg
        width="48"
        height="16"
        viewBox="0 0 48 16"
        className={`text-orange-400/60 ${rotations[direction]}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.path
          d="M0 8 L40 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        />
        <motion.path
          d="M36 4 L44 8 L36 12"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.5 }}
        />
      </motion.svg>
    </div>
  );
};
