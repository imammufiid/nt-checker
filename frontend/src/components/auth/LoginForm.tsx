import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { id } from '../../lib/id';

interface Props {
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
  submitting?: boolean;
}

export default function LoginForm({ onSubmit, submitting }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    await onSubmit({ email: email.trim(), password });
  };

  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-slate-700"
        >
          {id.auth.email}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-slate-700"
        >
          {id.auth.password}
        </label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
            aria-label={
              showPassword ? id.auth.hidePassword : id.auth.showPassword
            }
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors min-h-11"
      >
        {submitting ? id.login.submitting : id.login.submit}
      </button>
    </form>
  );
}
