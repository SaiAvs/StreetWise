import { useEffect, useMemo, useState } from 'react';
import {
  Bar as BarChart, Bar, CartesianGrid, Cell, Legend, Pie as PieChart, Pie,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/lib/auth';
import { fetchComplaintsForStaff } from '@/lib/data';
import type { Complaint } from '@/lib/types';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/types';
import { ErrorState, Spinner, StatCard } from '@/components/ui';
import { CheckCircle2, Clock, FileText, Users } from 'lucide-react';

const COLORS = ['#214D37', '#4E956C', '#F59E0B', '#DC5252', '#16A36A', '#718075'];

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchComplaintsForStaff().then(setComplaints).catch((e) => setError(e.message));
  }, [user]);

  const data = useMemo(() => {
    const list = complaints ?? [];
    const byCategory = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byPriority = new Map<string, number>();
    const byMonth = new Map<string, number>();
    let resolutionMs = 0;
    let resolvedCount = 0;

    for (const c of list) {
      byCategory.set(c.categories?.name ?? 'Other', (byCategory.get(c.categories?.name ?? 'Other') ?? 0) + 1);
      byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
      byPriority.set(c.priority, (byPriority.get(c.priority) ?? 0) + 1);
      const month = c.created_at.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      if (c.resolved_at) {
        resolutionMs += new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
        resolvedCount += 1;
      }
    }

    const avgDays = resolvedCount > 0 ? resolutionMs / resolvedCount / 86400000 : 0;
    const rate = list.length > 0 ? Math.round((resolvedCount / list.length) * 100) : 0;

    return {
      total: list.length,
      resolvedCount,
      rate,
      avgDays,
      byCategory: [...byCategory.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      byStatus: [...byStatus.entries()].map(([name, value]) => ({ name: STATUS_LABELS[name as keyof typeof STATUS_LABELS] ?? name, value })),
      byPriority: [...byPriority.entries()].map(([name, value]) => ({ name: PRIORITY_LABELS[name as keyof typeof PRIORITY_LABELS] ?? name, value })),
      byMonth: [...byMonth.entries()].sort().map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        count,
      })),
    };
  }, [complaints]);

  if (error) return <ErrorState message={error} />;
  if (!complaints) return <Spinner label="Crunching platform data…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Analytics & reports</h1>
        <p className="mt-1 text-sm text-slate-500">All figures come from live complaint records.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total complaints" value={data.total} icon={<FileText className="h-5 w-5" />} tone="slate" />
        <StatCard label="Resolved" value={data.resolvedCount} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Resolution rate" value={`${data.rate}%`} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Avg resolution time" value={data.avgDays > 0 ? `${data.avgDays.toFixed(1)} days` : '—'} icon={<Clock className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Complaints by category</h2>
          {data.byCategory.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E1" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#214D37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Status distribution</h2>
          {data.byStatus.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {data.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">Monthly trend</h2>
          {data.byMonth.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E1" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4E956C" radius={[4, 4, 0, 0]} name="Complaints" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">Priority distribution</h2>
          {data.byPriority.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byPriority}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E8E1" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Complaints">
                    {data.byPriority.map((entry, i) => (
                      <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
