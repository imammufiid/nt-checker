import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Apple } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { authApi } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
import LoginForm from '../components/auth/LoginForm';
import ApiErrorBanner from '../components/ApiErrorBanner';
import { id } from '../lib/id';

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, login } = useAuth();
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, send back to wherever they wanted (or /).
  if (status === 'authed') {
    const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (input: { email: string; password: string }) => {
    setError(null);
    setSubmitting(true);
    try {
      const bundle = await authApi.login(input);
      login(bundle);
      const from =
        (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Apple className="text-emerald-600" size={22} />
        nt-checker
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{id.login.title}</h1>
      </div>

      <LoginForm onSubmit={handleSubmit} submitting={submitting} />

      <ApiErrorBanner
        error={error}
        codeMap={{
          UNAUTHORIZED: id.login.errors.unauthorized,
          RATE_LIMITED: id.login.errors.rateLimited,
          NETWORK_ERROR: id.login.errors.network,
          UNKNOWN: id.login.errors.generic,
        }}
      />

      <p className="text-sm text-slate-600">
        {id.login.noAccount}{' '}
        <Link
          to="/daftar"
          className="text-emerald-700 hover:underline font-medium"
        >
          {id.login.signupCta}
        </Link>
      </p>
    </div>
  );
}
