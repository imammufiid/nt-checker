import { Link, Outlet } from 'react-router-dom';
import { Apple } from 'lucide-react';
import AuthNav from './AuthNav';

export default function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Apple className="text-emerald-600" size={22} />
            nt-checker
          </Link>
          <AuthNav />
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
