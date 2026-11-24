import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchCategories, fetchComplaintsForCitizen, fetchComplaintsForStaff } from '@/lib/data';
import type { Category, Complaint, ComplaintStatus, Priority } from '@/lib/types';
import { STATUS_LABELS, STATUS_STYLES, PRIORITY_LABELS, PRIORITY_STYLES, timeAgo } from '@/lib/types';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';

export default function ComplaintsPage() {
  const { user, role } = useAuth();
  const [params, setParams] = useSearchParams();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const isCitizen = role === 'citizen';
  const statusFilter = params.get('status') ?? '';
  const categoryFilter = params.get('category') ?? '';
  const priorityFilter = params.get('priority') ?? '';

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = isCitizen
      ? fetchComplaintsForCitizen(user.id)
      : fetchComplaintsForStaff();
    load.then(setComplaints).catch((e) => setError(e.message));
  }, [user, isCitizen]);

  const filtered = useMemo(() => {
    let list = complaints ?? [];
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (categoryFilter) list = list.filter((c) => c.category_id === categoryFilter);
    if (priorityFilter) list = list.filter((c) => c.priority === priorityFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || c.reference_number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [complaints, statusFilter, categoryFilter, priorityFilter, query]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {isCitizen ? 'My complaints' : 'Work queue'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isCitizen ? 'Every report you have submitted, with live status.' : 'Complaints assigned to you and open work you can pick up.'}
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search title or reference number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Filter className="h-4 w-4 text-slate-400" />
        <select className="input w-auto" value={statusFilter} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="input w-auto" value={priorityFilter} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {!complaints ? (
        <Spinner label="Loading complaints…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No complaints found"
          message={complaints.length === 0 ? 'Nothing has been reported yet.' : 'No complaints match the current filters.'}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                to={`/complaints/${c.id}`}
                className="card block p-5 transition-shadow hover:shadow-lift"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-400">{c.reference_number}</p>
                    <h3 className="mt-0.5 font-semibold text-slate-900">{c.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{c.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <span className={`badge ${PRIORITY_STYLES[c.priority as Priority]}`}>{PRIORITY_LABELS[c.priority as Priority]}</span>
                    <span className={`badge ${STATUS_STYLES[c.status as ComplaintStatus]}`}>{STATUS_LABELS[c.status as ComplaintStatus]}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{c.categories?.name ?? 'Uncategorised'}</span>
                  {c.address && <span className="truncate">{c.address}</span>}
                  <span>Reported {timeAgo(c.created_at)}</span>
                  {c.assigned_to && c.profiles && <span>Assigned to {c.profiles.full_name || 'staff'}</span>}
                  {c.image_urls.length > 0 && <span>{c.image_urls.length} photo{c.image_urls.length > 1 ? 's' : ''}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
