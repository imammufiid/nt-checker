import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: { to: string; label: string };
}

export default function EmptyState({ icon, title, body, cta }: Props) {
  return (
    <div className="bg-white border rounded-xl p-8 text-center text-slate-600">
      {icon && (
        <div className="flex justify-center text-slate-400 mb-3">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {body && <p className="text-sm mt-1">{body}</p>}
      {cta && (
        <Link
          to={cta.to}
          className="inline-flex items-center mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
