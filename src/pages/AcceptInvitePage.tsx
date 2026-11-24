import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AuthShell, { SubmitButton, FormError, useAuthForm } from '@/components/AuthShell';

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  return <AcceptInviteInner code={params.get('code') ?? ''} />;
}

function AcceptInviteInner({ code }: { code: string }) {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const form = useAuthForm();
  const [fullName, setFullName] = useState('');
  const [step, setStep] = useState<'form' | 'done'>('form');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    form.setError(null);
    form.setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('accept-authority-invite', {
        body: { code, email: form.email.trim().toLowerCase(), password: form.password, full_name: fullName.trim() },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (loginError) {
        setStep('done');
        return;
      }
      await refreshProfile();
      navigate('/dashboard');
    } catch (err) {
      form.setError(err instanceof Error ? err.message : 'Invite acceptance failed.');
    }
    form.setBusy(false);
  }

  if (step === 'done') {
    return (
      <AuthShell footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>}>
        <h2 className="font-display text-2xl font-bold text-slate-900">Authority account created</h2>
        <p className="mt-2 text-sm text-slate-500">Sign in with the email and password you just set.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link>}>
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-900">
        <ShieldCheck className="h-6 w-6 text-brand-600" /> Authority invitation
      </h2>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {code
          ? 'Set up your staff account using the invite code in your invitation link.'
          : 'This page needs an invite code: open the invitation link you received (…/accept-invite?code=YOUR-CODE).'}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Invite code</label>
          <input className="input bg-slate-50" value={code} disabled />
        </div>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Work email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => form.setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Choose password</label>
          <input className="input" type="password" value={form.password} onChange={(e) => form.setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <FormError message={form.error} />
        <SubmitButton busy={form.busy}>Create authority account</SubmitButton>
      </form>
    </AuthShell>
  );
}
