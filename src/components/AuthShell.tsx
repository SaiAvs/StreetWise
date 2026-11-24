import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

export default function AuthShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="relative hidden flex-1 overflow-hidden bg-brand-800 lg:block">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, #4E956C 0, transparent 40%), radial-gradient(circle at 80% 70%, #A8C9AE 0, transparent 45%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-3">
            <span className="rounded-xl bg-white/15 p-2"><MapPin className="h-6 w-6" /></span>
            <span className="font-display text-2xl font-bold">StreetWise</span>
          </Link>
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Your city, one report at a time.
            </h1>
            <p className="mt-4 max-w-md text-brand-100">
              Report civic issues in seconds, follow every step authorities take, and see
              your neighbourhood improve — transparently.
            </p>
          </div>
          <p className="text-sm text-brand-200">AI-assisted civic issue management · Transparent tracking</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <span className="rounded-lg bg-brand-600 p-1.5 text-white"><MapPin className="h-5 w-5" /></span>
            <span className="font-display text-xl font-bold text-slate-900">StreetWise</span>
          </Link>
          <div className="card p-8">{children}</div>
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export function useAuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return { email, setEmail, password, setPassword, error, setError, busy, setBusy };
}

export function AuthField(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <input
        className="input"
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required
      />
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={busy}>
      {busy ? 'Please wait…' : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{message}</p>
  );
}

export type { FormEvent };
