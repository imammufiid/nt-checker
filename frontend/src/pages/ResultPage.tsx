import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Scan } from '../lib/types';
import { api } from '../lib/api';
import VerdictCard from '../components/VerdictCard';
import NutritionTable from '../components/NutritionTable';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get(id)
      .then(setScan)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error || !scan)
    return <p className="text-rose-600">{error ?? 'Not found'}</p>;

  const severityColor = {
    low: 'text-slate-600',
    medium: 'text-amber-700',
    high: 'text-rose-700',
  };

  return (
    <div className="space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back
      </Link>

      {scan.productName && (
        <h1 className="text-xl font-semibold">{scan.productName}</h1>
      )}

      <VerdictCard scan={scan} />

      <div className="grid md:grid-cols-2 gap-5">
        <section className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Nutrition (per serving)</h3>
          <NutritionTable nutrition={scan.nutrition} />
        </section>

        <section className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Ingredients</h3>
          {scan.ingredients.length > 0 ? (
            <ol className="list-decimal list-inside text-sm space-y-1">
              {scan.ingredients.map((ing, i) => (
                <li key={i} className="text-slate-700">
                  {ing}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">No ingredients detected.</p>
          )}
        </section>
      </div>

      {scan.redFlagIngredients && scan.redFlagIngredients.length > 0 && (
        <section className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Red flags</h3>
          <ul className="space-y-2">
            {scan.redFlagIngredients.map((rf, i) => (
              <li key={i} className="text-sm">
                <span className={`font-medium ${severityColor[rf.severity]}`}>
                  {rf.ingredient}
                </span>
                <span className="text-slate-600"> — {rf.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Scanned image</h3>
        <img
          src={scan.imageUrl}
          alt="Scanned label"
          className="max-w-full max-h-96 rounded-lg border"
        />
      </section>
    </div>
  );
}
