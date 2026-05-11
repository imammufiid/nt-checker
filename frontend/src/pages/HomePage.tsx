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
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">
          Makanan ini sehat atau tidak?
        </h1>
        <p className="text-slate-600 mt-1">
          Foto label gizi atau daftar bahan di kemasan — kami bantu jelaskan
          dalam bahasa yang mudah dipahami.
        </p>
      </div>

      <ImageUploader onSubmit={handleUpload} disabled={busy} />

      {busy && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-sm">
          Sedang menganalisis label… biasanya butuh 5–15 detik.
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
