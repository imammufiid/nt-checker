import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { HealthProfile } from '../lib/types';
import { usersApi } from '../lib/api/users';
import { ApiError } from '../lib/api/client';
import ProfileForm from '../components/profile/ProfileForm';
import ApiErrorBanner from '../components/ApiErrorBanner';
import { id } from '../lib/id';

interface LocationState {
  firstRun?: boolean;
}

export default function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const firstRun = !!(location.state as LocationState | null)?.firstRun;

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(!firstRun);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (firstRun) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await usersApi.getProfile();
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firstRun]);

  const handleSubmit = async (next: HealthProfile) => {
    setSubmitting(true);
    setError(null);
    setSavedToast(false);
    try {
      const saved = await usersApi.putProfile(next);
      setProfile(saved);
      if (firstRun) {
        // Clear the firstRun state and route to goal setup (future wave; will 404
        // until /tujuan ships — that's expected and called out in the task).
        navigate('/tujuan', { replace: true });
        return;
      }
      setSavedToast(true);
      // Auto-hide toast after a few seconds.
      window.setTimeout(() => setSavedToast(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{id.profile.title}</h1>
        <p className="text-slate-600 text-sm">{id.profile.subtitle}</p>
      </div>

      {firstRun && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-sm"
        >
          {id.profile.firstRunBanner}
        </div>
      )}

      <ApiErrorBanner error={error} />

      {loading ? (
        <div className="py-16 flex justify-center">
          <div
            className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-emerald-600 animate-spin"
            aria-label={id.common.loading}
            role="status"
          />
        </div>
      ) : (
        <ProfileForm
          initial={profile}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {savedToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-lg flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="text-emerald-300" />
          {id.profile.saved}
        </div>
      )}
    </div>
  );
}
