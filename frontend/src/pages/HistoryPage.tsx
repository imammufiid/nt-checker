import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { Scan } from '../lib/types';
import { api } from '../lib/api';

const tierBadge: Record<Scan['verdict']['tier'], string> = {
  healthy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  moderate: 'text-amber-700 bg-amber-50 border-amber-200',
  unhealthy: 'text-rose-700 bg-rose-50 border-rose-200',
};

export default function HistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setScans(await api.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scan?')) return;
    await api.remove(id);
    load();
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-rose-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>

      {scans.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">
          No scans yet.{' '}
          <Link to="/" className="text-emerald-700 hover:underline">
            Scan a label
          </Link>{' '}
          to get started.
        </div>
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => (
            <li
              key={scan.id}
              className="bg-white border rounded-xl p-3 flex gap-3 items-center"
            >
              <img
                src={scan.imageUrl}
                alt=""
                className="w-16 h-16 object-cover rounded-lg border flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/scan/${scan.id}`}
                  className="font-medium hover:underline truncate block"
                >
                  {scan.productName ?? 'Unknown product'}
                </Link>
                <p className="text-xs text-slate-500">
                  {new Date(scan.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded border font-medium ${tierBadge[scan.verdict.tier]}`}
              >
                {scan.verdict.tier} · {scan.verdict.score}
              </span>
              <button
                onClick={() => handleDelete(scan.id)}
                className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                aria-label="Delete scan"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
