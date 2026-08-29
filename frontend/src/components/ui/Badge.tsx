import React from 'react';
import type { DataProvenance, SpillStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'amber' | 'danger' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'xs', className = '' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-[#161D1B] text-[#A5B1AC] border-[#29332F]',
    accent: 'bg-[#236B5B]/30 text-[#5EE6C0] border-[#38B99A]/50',
    amber: 'bg-[#E8A84E]/15 text-[#E8A84E] border-[#E8A84E]/40',
    danger: 'bg-[#A83E43]/25 text-[#F05D5E] border-[#F05D5E]/40',
    outline: 'bg-transparent text-[#E8EFEC] border-[#3A4741]',
    subtle: 'bg-[#111716] text-[#68746F] border-[#202925]',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 font-mono tracking-tight',
    sm: 'text-[11px] px-2 py-0.5 font-mono',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-xs border uppercase ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: SpillStatus }) {
  const map: Record<SpillStatus, { label: string; variant: 'default' | 'accent' | 'amber' | 'danger' }> = {
    detected: { label: 'SAR DETECTED', variant: 'amber' },
    under_investigation: { label: 'CORRELATING', variant: 'accent' },
    attributed: { label: 'ATTRIBUTED', variant: 'danger' },
    closed: { label: 'CLOSED / CAPPED', variant: 'default' },
  };

  const item = map[status] || { label: status.toUpperCase(), variant: 'default' };

  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function ProvenanceTag({ provenance }: { provenance: DataProvenance }) {
  const map: Record<DataProvenance, { label: string; bg: string; text: string; border: string; desc: string }> = {
    OBSERVED: {
      label: 'OBSERVED',
      bg: 'bg-[#111716]',
      text: 'text-[#5EE6C0]',
      border: 'border-[#38B99A]/40',
      desc: 'Direct sensor measurement (Sentinel-1 SAR C-Band backscatter, AIS broadcast packet)',
    },
    DERIVED: {
      label: 'DERIVED',
      bg: 'bg-[#161D1B]',
      text: 'text-[#A5B1AC]',
      border: 'border-[#29332F]',
      desc: 'Deterministic computation (Polygon segmentation, speed anomaly, Hausdorff distance)',
    },
    ESTIMATED: {
      label: 'ESTIMATED',
      bg: 'bg-[#1C2522]',
      text: 'text-[#E8A84E]',
      border: 'border-[#E8A84E]/40',
      desc: 'Scientific hydrodynamic hindcast projection (CMEMS surface currents + ERA5 wind leeway)',
    },
    SIMULATED: {
      label: 'SIMULATED',
      bg: 'bg-[#161D1B]',
      text: 'text-[#D5B76A]',
      border: 'border-[#3A4741]',
      desc: 'Synthetic / test simulation vector',
    },
  };

  const item = map[provenance] || map.OBSERVED;

  return (
    <span
      title={item.desc}
      className={`inline-flex items-center gap-1 text-[9px] font-mono tracking-widest font-semibold px-1.5 py-0.5 rounded-xs border ${item.bg} ${item.text} ${item.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
      {item.label}
    </span>
  );
}
