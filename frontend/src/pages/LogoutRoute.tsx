import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/**
 * Mount-and-redirect logout route. Linkable from anywhere (incl. the auth-aware
 * nav). Fire-and-forgets the BE call — the in-memory state is cleared whether
 * or not the network round-trip succeeded.
 */
export default function LogoutRoute() {
  const { logout, status } = useAuth();

  useEffect(() => {
    void logout();
  }, [logout]);

  // If we're still authed (the logout hasn't completed yet), show a tiny
  // loading state so we don't bounce away with the cookie still set.
  if (status === 'authed' || status === 'bootstrapping') {
    return (
      <div className="py-16 flex justify-center">
        <div
          className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-emerald-600 animate-spin"
          aria-label="Keluar"
          role="status"
        />
      </div>
    );
  }

  return <Navigate to="/masuk" replace />;
}
