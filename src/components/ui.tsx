import type { ReactNode } from 'react';
import {
  STATUS_LABELS, STATUS_STYLES, PRIORITY_LABELS, PRIORITY_STYLES,
  type ComplaintStatus, type Priority,
} from '@/lib/types';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  title, message, action, icon,
}: { title: string; message: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-400">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card flex items-start gap-3 border-red-200 bg-red-50 px-5 py-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div>
        <p className="text-sm font-semibold text-red-800">Something went wrong</p>
        <p className="text-sm text-red-700">{message}</p>
      </div>
    </div>
  );
}

export function StatCard({
  label, value, icon, tone = 'brand',
}: { label: string; value: ReactNode; icon: ReactNode; tone?: 'brand' | 'amber' | 'blue' | 'emerald' | 'red' | 'slate' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`rounded-lg p-2.5 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="font-display text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
