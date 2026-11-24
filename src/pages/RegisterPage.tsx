import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AuthShell, { AuthField, SubmitButton, FormError, useAuthForm } from '@/components/AuthShell';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const form = useAuthForm();
  const [fullName, setFullName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    form.setError(null);
    if (passwordTooWeak(form.password)) {
      form.setError('Password must be at least 8 characters and include a number.');
      return;
    }
    if (form.password !== confirm) {
      form.setError('Passwords do not match.');
      return;
    }
    form.setBusy(true);
    const { error, needsEmailConfirm } = await signUp(form.email.trim(), form.password, fullName.trim());
    form.setBusy(false);
    if (error) {
      form.setError(error);
      return;
    }
    if (needsEmailConfirm) {
      setDone(true);
    } else {
      navigate('/dashboard');
    }
  }

  if (done) {
    return (
      <AuthShell footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link>}>
        <h2 className="font-display text-2xl font-bold text-slate-900">Check your email</h2>
        <p className="mt-2 text-sm text-slate-500">
          We sent a confirmation link to <strong>{form.email}</strong>. Confirm your address to
          activate your account, then sign in.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <h2 className="font-display text-2xl font-bold text-slate-900">Create your account</h2>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Public registration creates citizen accounts. Authority accounts are provisioned
        separately through an official invitation.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Full name" type="text" value={fullName} onChange={setFullName} placeholder="Priya Sharma" autoComplete="name" />
        <AuthField label="Email" type="email" value={form.email} onChange={form.setEmail} placeholder="you@example.com" autoComplete="email" />
        <AuthField label="Password" type="password" value={form.password} onChange={form.setPassword} placeholder="At least 8 characters, 1 number" autoComplete="new-password" />
        <AuthField label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat password" autoComplete="new-password" />
        <FormError message={form.error} />
        <SubmitButton busy={form.busy}>Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}

function passwordTooWeak(pw: string): boolean {
  return pw.length < 8 || !/\d/.test(pw);
}
