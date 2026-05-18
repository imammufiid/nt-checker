import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

/**
 * Route guard. Renders a centered skeleton while AuthProvider is bootstrapping
 * (avoids a flash of /masuk on every page load) and bounces unauth'd users to
 * the login page, preserving the originally requested location in `state.from`
 * so LoginPage can redirect back after success.
 */
export default function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return (
      <div className="py-16 flex justify-center">
        <div
          className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-emerald-600 animate-spin"
          aria-label="Memuat"
          role="status"
        />
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <Navigate to="/masuk" replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}
