import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Apple, Camera } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import { scansApi } from '../lib/api/scans';
import { useAuth } from '../lib/auth';
import { id } from '../lib/id';

export default function HomePage() {
  const { status } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const scan = await scansApi.upload(file);
      navigate(`/scan/${scan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto');
    } finally {
      setBusy(false);
    }
  };

  // Signed-out marketing hero: hide the uploader until the user signs up.
  if (status !== 'authed') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div className="flex items-center gap-2 text-emerald-700">
          <Apple size={26} />
          <span className="text-lg font-semibold">nt-checker</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          {id.home.heroTitle}
        </h1>
        <p className="text-slate-600 text-base sm:text-lg">
          {id.home.heroSubtitle}
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <Link
            to="/daftar"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 min-h-11"
          >
            <Camera size={18} />
            {id.home.signupCta}
          </Link>
          <p className="text-sm text-slate-600">
            {id.home.loginPrompt}{' '}
            <Link
              to="/masuk"
              className="text-emerald-700 hover:underline font-medium"
            >
              {id.home.loginCta}
            </Link>
          </p>
        </div>
      </div>
    );
  }

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
