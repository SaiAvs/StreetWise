import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [ward, setWard] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
      setWard(profile.ward ?? '');
    }
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, ward: ward.trim() || null })
      .eq('id', user.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
    await refreshProfile();
  }

  const p: Profile | null = profile;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm text-slate-500">Update your details. Your account role is <strong>{p?.role}</strong>.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div>
          <label className="label">Email</label>
          <input className="input bg-slate-50" value={p?.email ?? ''} disabled />
        </div>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Ward / area</label>
            <input className="input" value={ward} onChange={(e) => setWard(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">Profile saved.</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>

      <p className="text-sm text-slate-500">
        Looking for your reports?{' '}
        <Link to={p?.role === 'citizen' ? '/complaints' : '/dashboard'} className="font-medium text-brand-600 hover:underline">
          Go to complaints
        </Link>
      </p>
    </div>
  );
}
