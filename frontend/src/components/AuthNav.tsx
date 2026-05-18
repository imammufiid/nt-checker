import { NavLink } from 'react-router-dom';
import { History, Home, LogIn, LogOut, Target, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { id } from '../lib/id';

const baseLink =
  'px-3 py-2 min-h-11 rounded-lg text-sm flex items-center gap-1.5 transition-colors';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `${baseLink} ${
    isActive
      ? 'bg-emerald-50 text-emerald-700'
      : 'text-slate-600 hover:bg-slate-100'
  }`;

/**
 * Auth-aware top nav. Replaces the hard-coded "Pindai · Riwayat" links in
 * Layout. See frontend.md §11 for touch-target rule (min-h-11).
 */
export default function AuthNav() {
  const { status } = useAuth();

  if (status !== 'authed') {
    return (
      <nav className="flex items-center gap-1" aria-label="Navigasi utama">
        <NavLink to="/masuk" className={linkClass}>
          <LogIn size={16} /> {id.nav.login}
        </NavLink>
        <NavLink to="/daftar" className={linkClass}>
          {id.nav.signup}
        </NavLink>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1 flex-wrap" aria-label="Navigasi utama">
      <NavLink to="/" end className={linkClass}>
        <Home size={16} /> {id.nav.home}
      </NavLink>
      <NavLink to="/riwayat" className={linkClass}>
        <History size={16} /> {id.nav.history}
      </NavLink>
      <NavLink to="/hari-ini" className={linkClass}>
        <Target size={16} /> {id.nav.today}
      </NavLink>
      <NavLink to="/profil" className={linkClass}>
        <User size={16} /> {id.nav.profile}
      </NavLink>
      <NavLink to="/keluar" className={linkClass}>
        <LogOut size={16} /> {id.nav.logout}
      </NavLink>
    </nav>
  );
}
