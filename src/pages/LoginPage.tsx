import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AuthShell, { AuthField, SubmitButton, FormError, useAuthForm } from '@/components/AuthShell';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const form = useAuthForm();
  const [redirecting, setRedirecting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    form.setError(null);
    form.setBusy(true);
    const { error } = await signIn(form.email.trim(), form.password);
    form.setBusy(false);
    if (error) {
      form.setError(error);
      return;
    }
    setRedirecting(true);
    navigate('/dashboard');
  }

  return (
    <AuthShell
      footer={
        <>
          New to StreetWise?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Create a citizen account
          </Link>
        </>
      }
    >
      <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
      <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to report and track civic issues.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Email" type="email" value={form.email} onChange={form.setEmail} placeholder="you@example.com" autoComplete="email" />
        <AuthField label="Password" type="password" value={form.password} onChange={form.setPassword} placeholder="••••••••" autoComplete="current-password" />
        <FormError message={form.error} />
        <SubmitButton busy={form.busy || redirecting}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
