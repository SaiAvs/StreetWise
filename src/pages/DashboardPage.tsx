import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, FileText, Loader2, Plus, Send, Wrench,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchComplaintsForCitizen, fetchComplaintsForStaff } from '@/lib/data';
import type { Complaint } from '@/lib/types';
import { STATUS_LABELS, STATUS_STYLES, timeAgo } from '@/lib/types';
import { StatCard, EmptyState } from '@/components/ui';
import MapView from '@/components/MapView';

export default function DashboardPage() {
  const { user, profile, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load =
      role === 'citizen'
        ? fetchComplaintsForCitizen(user.id)
        : fetchComplaintsForStaff();
    load.then(setComplaints).catch((e) => setError(e.message));
  }, [user, role]);

  const stats = useMemo(() => {
    const list = complaints ?? [];
    const by = (fn: (c: Complaint) => boolean) => list.filter(fn).length;
    return {
      total: list.length,
      pending: by((c) => ['submitted', 'under_review'].includes(c.status)),
      inProgress: by((c) => ['assigned', 'in_progress'].includes(c.status)),
      resolved: by((c) => c.status === 'resolved'),
      urgent: by((c) => c.priority === 'urgent' && c.status !== 'resolved' && c.status !== 'rejected'),
    };
  }, [complaints]);

  const recent = useMemo(() => (complaints ?? []).slice(0, 5), [complaints]);
  const mapped = useMemo(
    () => (complaints ?? []).filter((c) => c.status !== 'rejected').slice(0, 100),
    [complaints]
  );

  if (error) {
    return <p className="card border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>;
  }
  if (!complaints) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your dashboard…
      </div>
    );
  }

  const isCitizen = role === 'citizen';
  const firstName = (profile?.full_name || 'there').split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            {isCitizen ? `Welcome, ${firstName}` : 'Work dashboard'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isCitizen
              ? 'Track your reports and see how your city is responding.'
              : role === 'authority'
                ? 'Complaints assigned to you and open work in the queue.'
                : 'Platform-wide overview of complaints, people and performance.'}
          </p>
        </div>
        {isCitizen && (
          <Link to="/report" className="btn-primary">
            <Plus className="h-4 w-4" /> Report an issue
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total complaints" value={stats.total} icon={<FileText className="h-5 w-5" />} tone="slate" />
        {isCitizen ? (
          <>
            <StatCard label="Awaiting review" value={stats.pending} icon={<Clock className="h-5 w-5" />} tone="amber" />
            <StatCard label="In progress" value={stats.inProgress} icon={<Wrench className="h-5 w-5" />} tone="blue" />
            <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
          </>
        ) : (
          <>
            <StatCard label="New / under review" value={stats.pending} icon={<Clock className="h-5 w-5" />} tone="amber" />
            <StatCard label="In progress" value={stats.inProgress} icon={<Wrench className="h-5 w-5" />} tone="blue" />
            <StatCard label="Urgent open" value={stats.urgent} icon={<Send className="h-5 w-5" />} tone="red" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Recent activity</h2>
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              message={
                isCitizen
                  ? 'Your submitted complaints will appear here with live status updates.'
                  : 'Complaints will appear here as citizens report them.'
              }
              action={
                isCitizen ? (
                  <Link to="/report" className="btn-primary">Report your first issue</Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link to={`/complaints/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-400">
                        {c.reference_number} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    <span className={`badge shrink-0 ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {isCitizen ? 'Your issues on the map' : 'Issues on the map'}
            </h2>
            <Link to="/map" className="text-sm font-medium text-brand-600 hover:underline">
              Full map →
            </Link>
          </div>
          <div className="p-4">
            {mapped.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No mapped complaints yet.</p>
            ) : (
              <MapView complaints={mapped} className="h-72" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
