import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, History, RotateCcw, Send,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { evidenceUrl } from '@/lib/data';
import {
  fetchComplaint, fetchComplaintUpdates, updateComplaintStatus,
} from '@/lib/data';
import type { Complaint, ComplaintUpdate, ComplaintStatus } from '@/lib/types';
import { STATUS_LABELS, STATUS_FLOW, STATUS_STYLES, formatDateTime, timeAgo } from '@/lib/types';
import { ErrorState, PriorityBadge, Spinner, StatusBadge } from '@/components/ui';
import MapView from '@/components/MapView';
import { CategoryIcon } from '@/components/CategoryIcon';

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [updates, setUpdates] = useState<ComplaintUpdate[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenMsg, setReopenMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await fetchComplaint(id);
      if (!c) {
        setError('Complaint not found or you do not have access to it.');
        setComplaint(null);
        return;
      }
      setComplaint(c);
      setUpdates(await fetchComplaintUpdates(id));
      const urls = await Promise.all(c.image_urls.map((p) => evidenceUrl(p)));
      setImageUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load complaint.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isStaff = role === 'authority' || role === 'admin';
  const isOwner = !!user && complaint?.citizen_id === user.id;

  async function act(nextStatus: ComplaintStatus) {
    if (!complaint) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateComplaintStatus(
        complaint.id,
        { status: nextStatus, assigned_to: nextStatus === 'assigned' && !complaint.assigned_to && role === 'authority' ? user!.id : undefined },
        remarks.trim() || `Marked as ${STATUS_LABELS[nextStatus]}.`
      );
      setRemarks('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed.');
    }
    setBusy(false);
  }

  async function requestReopen() {
    if (!complaint) return;
    setBusy(true);
    setReopenMsg(null);
    setActionError(null);
    const { error: err } = await supabase.rpc('request_reopen', {
      p_complaint_id: complaint.id,
      p_reason: reopenReason,
    });
    setBusy(false);
    if (err) {
      setActionError(err.message);
      return;
    }
    setReopenReason('');
    setReopenMsg('Reopen request sent. Staff will review it.');
    await load();
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState message={error} />
        <button onClick={() => navigate(-1)} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Go back</button>
      </div>
    );
  }
  if (!complaint) return <Spinner label="Loading complaint…" />;

  const canReopen = isOwner && complaint.status === 'resolved' && !complaint.reopen_open && complaint.reopen_count < 2;
  const nextStatuses = isStaff ? (STATUS_FLOW[complaint.status as ComplaintStatus] ?? []) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-400">{complaint.reference_number}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">{complaint.title}</h1>
          </div>
          <div className="flex gap-2">
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <CategoryIcon name={complaint.categories?.icon ?? 'AlertCircle'} className="h-4 w-4" />
            {complaint.categories?.name ?? 'Uncategorised'}
          </span>
          <span>Reported {formatDateTime(complaint.created_at)} ({timeAgo(complaint.created_at)})</span>
          {complaint.resolved_at && <span className="text-emerald-700">Resolved {formatDateTime(complaint.resolved_at)}</span>}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{complaint.description}</p>

        {(complaint.ai_analysis || complaint.ai_confidence != null) && (
          <div className="mt-4 rounded-lg bg-brand-50/70 px-4 py-3 text-xs text-slate-600">
            <strong className="text-slate-800">AI analysis at submission:</strong> {complaint.ai_analysis}
            {complaint.ai_confidence != null && <> · confidence {(complaint.ai_confidence * 100).toFixed(0)}%</>}
            {complaint.ai_severity && <> · estimated visual severity {complaint.ai_severity}</>}
            <span className="mt-1 block text-[11px] text-slate-400">Estimate only — final category and priority were confirmed by the reporter and staff.</span>
          </div>
        )}

        {complaint.address && <p className="mt-3 text-sm text-slate-500"><strong>Address:</strong> {complaint.address}</p>}
      </div>

      {imageUrls.length > 0 && (
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Evidence photos</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {imageUrls.filter(Boolean).map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-200">
                <img src={url} alt={`Evidence ${i + 1}`} className="aspect-square w-full object-cover transition-transform hover:scale-105" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 pt-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Location</h2>
        </div>
        <div className="p-4">
          <MapView complaints={[complaint]} className="h-56" />
        </div>
      </div>

      {/* Citizen reopen flow */}
      {canReopen && (
        <div className="card border-amber-200 bg-amber-50/60 p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
            <RotateCcw className="h-5 w-5 text-amber-600" /> Issue not actually fixed?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Request a reopen (you have {2 - complaint.reopen_count} request{2 - complaint.reopen_count === 1 ? '' : 's'} left). Staff will review and decide.
          </p>
          <textarea
            className="input mt-3 min-h-20"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Explain what is still wrong (at least 10 characters)…"
          />
          {reopenMsg && <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {reopenMsg}</p>}
          <button onClick={requestReopen} className="btn-primary mt-3" disabled={busy || reopenReason.trim().length < 10}>
            <Send className="h-4 w-4" /> Request reopen
          </button>
        </div>
      )}
      {isOwner && complaint.reopen_open && (
        <p className="card border-amber-200 bg-amber-50/60 px-5 py-3 text-sm text-amber-800">
          Your reopen request is pending staff review.
        </p>
      )}

      {/* Staff actions */}
      {isStaff && nextStatuses.length > 0 && (
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Update complaint</h2>
          <textarea
            className="input mt-3 min-h-20"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Progress note / remarks shared with the citizen (optional)…"
          />
          {actionError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => act(s)}
                disabled={busy}
                className={s === 'resolved' ? 'btn bg-emerald-600 text-white hover:bg-emerald-700' : s === 'rejected' ? 'btn-danger' : 'btn-primary'}
              >
                {s === 'assigned' && !complaint.assigned_to && role === 'authority' ? 'Assign to me' : `Mark ${STATUS_LABELS[s]}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Every change is recorded in the complaint history with your name and note.
          </p>
        </div>
      )}

      {/* History */}
      <div className="card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
          <History className="h-5 w-5 text-slate-400" /> Complaint history
        </h2>
        <ol className="mt-4 space-y-0">
          {updates.map((u, i) => (
            <li key={u.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < updates.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
              <span className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-brand-500 bg-white" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {u.prev_status && u.prev_status !== u.new_status
                    ? `${STATUS_LABELS[u.prev_status as ComplaintStatus] ?? u.prev_status} → ${STATUS_LABELS[u.new_status as ComplaintStatus] ?? u.new_status}`
                    : u.prev_status
                      ? 'Update'
                      : 'Complaint submitted'}
                </p>
                <p className="text-sm text-slate-600">{u.remarks}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {u.profiles?.full_name || 'System'} · {formatDateTime(u.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
