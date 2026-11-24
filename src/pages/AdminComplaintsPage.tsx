import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchCategories, fetchComplaintsForStaff } from '@/lib/data';
import type { Category, Complaint, ComplaintStatus, Priority, Profile } from '@/lib/types';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, STATUS_STYLES, timeAgo } from '@/lib/types';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';

export default function AdminComplaintsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authorities, setAuthorities] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaintsForStaff().then(setComplaints).catch((e) => setError(e.message));
    fetchCategories().then(setCategories).catch(() => {});
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'authority')
      .then(({ data }: { data: Profile[] | null }) => setAuthorities(data ?? []));
  }, [user]);

  const filtered = useMemo(() => {
    let list = complaints ?? [];
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (priorityFilter) list = list.filter((c) => c.priority === priorityFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.reference_number.toLowerCase().includes(q) ||
          (c.profiles?.full_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [complaints, statusFilter, priorityFilter, query]);

  async function assign(complaintId: string, authorityId: string) {
    setAssigning(complaintId);
    setAssignError(null);
    const { error: err } = await supabase.rpc('staff_update_complaint', {
      p_complaint_id: complaintId,
      p_status: 'assigned',
      p_priority: null,
      p_assigned_to: authorityId || null,
      p_remarks: authorityId ? 'Complaint assigned by administrator.' : 'Assignment cleared by administrator.',
    });
    if (err) setAssignError(err.message);
    setAssigning(null);
    const refreshed = await fetchComplaintsForStaff();
    setComplaints(refreshed);
  }

  if (error) return <ErrorState message={error} />;
  if (!complaints) return <Spinner label="Loading all complaints…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Complaint management</h1>
        <p className="mt-1 text-sm text-slate-500">Every complaint on the platform. Assign work to authorities and audit progress.</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search reference, title or citizen…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {assignError && <ErrorState message={assignError} />}

      {filtered.length === 0 ? (
        <EmptyState title="No complaints found" message="Nothing matches the current filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Complaint</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Assigned to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <Link to={`/complaints/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {c.reference_number} · {c.profiles?.full_name || 'Unknown citizen'} · {timeAgo(c.created_at)}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${STATUS_STYLES[c.status as ComplaintStatus]}`}>{STATUS_LABELS[c.status as ComplaintStatus]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${PRIORITY_STYLES[c.priority as Priority]}`}>{PRIORITY_LABELS[c.priority as Priority]}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{c.categories?.name ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <select
                      className="input w-44 py-1.5 text-xs"
                      value={c.assigned_to ?? ''}
                      disabled={assigning === c.id}
                      onChange={(e) => assign(c.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {authorities.map((a) => (
                        <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
