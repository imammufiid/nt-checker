import { Link, NavLink, Outlet } from 'react-router-dom';
import { Apple, History, Upload } from 'lucide-react';

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700'
        : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Apple className="text-emerald-600" size={22} />
            nt-checker
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              <Upload size={16} /> Pindai
            </NavLink>
            <NavLink to="/history" className={linkClass}>
              <History size={16} /> Riwayat
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">
        nt-checker MVP · Powered by Claude
      </footer>
    </div>
  );
}
