import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Apple } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { authApi } from '../lib/api/auth';
import { ApiError } from '../lib/api/client';
import SignupForm, {
  type SignupValues,
} from '../components/auth/SignupForm';
import ApiErrorBanner from '../components/ApiErrorBanner';
import { id } from '../lib/id';

export default function SignupPage() {
  const navigate = useNavigate();
  const { status, signup } = useAuth();
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authed') return <Navigate to="/" replace />;

  const handleSubmit = async (values: SignupValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const bundle = await authApi.signup(values);
      signup(bundle);
      navigate('/profil', { replace: true, state: { firstRun: true } });
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
        <h1 className="text-2xl font-semibold">{id.signup.title}</h1>
        <p className="text-slate-600 text-sm">{id.signup.subtitle}</p>
      </div>

      <SignupForm onSubmit={handleSubmit} submitting={submitting} />

      <ApiErrorBanner
        error={error}
        codeMap={{
          DUPLICATE_EMAIL: id.signup.errors.duplicateEmail,
          NETWORK_ERROR: id.errors.network,
          UNKNOWN: id.signup.errors.generic,
        }}
      />

      <p className="text-sm text-slate-600">
        {id.signup.haveAccount}{' '}
        <Link
          to="/masuk"
          className="text-emerald-700 hover:underline font-medium"
        >
          {id.signup.loginCta}
        </Link>
      </p>
    </div>
  );
}
