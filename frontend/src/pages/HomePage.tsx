import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import { api } from '../lib/api';

export default function HomePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const scan = await api.upload(file);
      navigate(`/scan/${scan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Is this food healthy?</h1>
        <p className="text-slate-600 mt-1">
          Scan a nutrition label or ingredient list — get an instant health
          verdict.
        </p>
      </div>

      <ImageUploader onSubmit={handleUpload} disabled={busy} />

      {busy && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-sm">
          Analyzing label with Claude… this usually takes 5–15 seconds.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
