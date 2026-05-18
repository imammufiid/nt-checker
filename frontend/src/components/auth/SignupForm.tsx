import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { id } from '../../lib/id';

export interface SignupValues {
  email: string;
  password: string;
  name: string;
}

interface Props {
  onSubmit: (input: SignupValues) => Promise<void>;
  submitting?: boolean;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignupForm({ onSubmit, submitting }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!name.trim()) return id.signup.errors.nameRequired;
    if (!EMAIL_RE.test(email.trim())) return id.signup.errors.invalidEmail;
    if (password.length < 8) return id.signup.errors.passwordTooShort;
    return null;
  };

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const err = validate();
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    await onSubmit({
      email: email.trim(),
      password,
      name: name.trim(),
    });
  };

  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label
          htmlFor="signup-name"
          className="block text-sm font-medium text-slate-700"
        >
          {id.auth.name}
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="signup-email"
          className="block text-sm font-medium text-slate-700"
        >
          {id.auth.email}
        </label>
        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="block text-sm font-medium text-slate-700"
        >
          {id.auth.password}
        </label>
        <div className="relative">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-describedby="signup-password-help"
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
        <p id="signup-password-help" className="text-xs text-slate-500">
          {id.auth.passwordHelp}
        </p>
      </div>

      {clientError && (
        <p role="alert" className="text-sm text-rose-700">
          {clientError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors min-h-11"
      >
        {submitting ? id.signup.submitting : id.signup.submit}
      </button>
    </form>
  );
}
