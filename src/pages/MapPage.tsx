import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchCategories, fetchComplaintsForCitizen, fetchComplaintsForStaff } from '@/lib/data';
import type { Category, Complaint } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import MapView from '@/components/MapView';
import { Spinner } from '@/components/ui';

export default function MapPage() {
  const { user, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = role === 'citizen'
      ? fetchComplaintsForCitizen(user.id)
      : fetchComplaintsForStaff();
    load.then(setComplaints).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, [user, role]);

  const filtered = useMemo(() => {
    let list = complaints ?? [];
    if (categoryFilter) list = list.filter((c) => c.category_id === categoryFilter);
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    return list.filter((c) => c.status !== 'rejected');
  }, [complaints, categoryFilter, statusFilter]);

  if (!complaints) return <Spinner label="Loading map…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {role === 'citizen' ? 'Community map' : 'Complaint map view'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Marker colour shows priority (grey low, blue medium, orange high, red urgent). Click a cluster to zoom in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-3">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No complaints to show for these filters.</p>
        ) : (
          <MapView complaints={filtered} className="h-[32rem]" />
        )}
      </div>
      <p className="text-xs text-slate-400">Showing {filtered.length} complaint{filtered.length === 1 ? '' : 's'} · Maps &copy; OpenStreetMap contributors</p>
    </div>
  );
}
