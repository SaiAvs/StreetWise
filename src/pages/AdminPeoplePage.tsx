import { useEffect, useState } from 'react';
import { Copy, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { formatDate } from '@/lib/types';
import { ErrorState, Spinner, StatCard } from '@/components/ui';

interface InviteRow {
  id: string;
  code: string;
  email: string | null;
  is_accepted: boolean;
  expires_at: string;
}

export default function AdminPeoplePage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    const [{ data: profiles, error: pErr }, { data: invitesData, error: iErr }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('authority_invites').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (pErr) setError(pErr.message);
    if (iErr) setError(iErr.message);
    setPeople((profiles as Profile[]) ?? []);
    setInvites((invitesData as InviteRow[]) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function createInvite() {
    setBusy(true);
    setError(null);
    const code = 'SWA-' + Array.from({ length: 2 }, () => Math.random().toString(36).slice(2, 6).toUpperCase()).join('-');
    const { error: err } = await supabase.from('authority_invites').insert({
      code,
      email: inviteEmail.trim().toLowerCase() || null,
      invited_by: user!.id,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCreatedInvite(code);
    setInviteEmail('');
    await load();
  }

  // Invites are service-role only, so the client list may be empty by design.
  const citizens = (people ?? []).filter((p) => p.role === 'citizen');
  const authorities = (people ?? []).filter((p) => p.role === 'authority');

  if (!people) return <Spinner label="Loading people…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">People & permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage citizens and authorities. Authority access is granted only through invites.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={people.length} icon={<Users className="h-5 w-5" />} tone="slate" />
        <StatCard label="Citizens" value={citizens.length} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Authorities" value={authorities.length} icon={<ShieldCheck className="h-5 w-5" />} tone="blue" />
        <StatCard label="Admins" value={people.filter((p) => p.role === 'admin').length} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
      </div>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
          <UserPlus className="h-5 w-5 text-brand-600" /> Invite an authority
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate an invite code and share the link <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/accept-invite?code=…</code> with the staff member. They set their own password on the invite page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className="input max-w-xs flex-1"
            placeholder="Work email (optional, locks the invite to this address)"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            type="email"
          />
          <button className="btn-primary" onClick={createInvite} disabled={busy}>
            {busy ? 'Generating…' : 'Create invite'}
          </button>
        </div>
        {createdInvite && (
          <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Invite created: <code className="text-brand-700">{createdInvite}</code></p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-white px-2 py-1 text-xs text-slate-600">
                {window.location.origin}/accept-invite?code={createdInvite}
              </code>
              <button
                className="btn-secondary px-2.5 py-1 text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/accept-invite?code=${createdInvite}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 text-sm">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <code className="font-semibold text-slate-800">{inv.code}</code>
                  {inv.email && <span className="text-slate-500"> · {inv.email}</span>}
                </span>
                <span className={`badge ${inv.is_accepted ? 'bg-emerald-100 text-emerald-800' : inv.expires_at < new Date().toISOString() ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>
                  {inv.is_accepted ? 'Accepted' : inv.expires_at < new Date().toISOString() ? 'Expired' : `Expires ${formatDate(inv.expires_at)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <ErrorState message={error} />}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Ward</th>
              <th className="px-5 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {people.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-3 font-medium text-slate-800">{p.full_name || '—'}</td>
                <td className="px-5 py-3 text-slate-600">{p.email}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${p.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : p.role === 'authority' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                    {p.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{p.ward ?? '—'}</td>
                <td className="px-5 py-3 text-slate-500">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
