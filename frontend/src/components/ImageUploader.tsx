import { useEffect, useRef, useState } from 'react';
import { Camera, Upload as UploadIcon, X } from 'lucide-react';

interface Props {
  onSubmit: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onSubmit, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const handleSelect = (f: File | undefined | null) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Browser tidak mendukung kamera. Gunakan "Pilih dari galeri".',
      );
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setStream(s);
    } catch {
      setCameraError(
        'Tidak bisa membuka kamera. Pastikan izin akses sudah diberikan, atau coba pakai "Pilih dari galeri".',
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const captured = new File([blob], `kamera-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        handleSelect(captured);
        stopCamera();
      },
      'image/jpeg',
      0.92,
    );
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />

      {stream && !preview && (
        <div className="space-y-3">
          <div className="relative bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-96 object-contain"
            />
            <button
              onClick={stopCamera}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-white"
              aria-label="Tutup kamera"
            >
              <X size={18} />
            </button>
          </div>
          <button
            onClick={capturePhoto}
            disabled={disabled}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            <Camera size={18} /> Jepret
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={preview}
              alt="Foto label"
              className="w-full max-h-96 object-contain rounded-xl border bg-white"
            />
            <button
              onClick={clear}
              disabled={disabled}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-white disabled:opacity-50"
              aria-label="Hapus foto"
            >
              <X size={18} />
            </button>
          </div>
          <button
            onClick={() => file && onSubmit(file)}
            disabled={disabled}
            className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {disabled ? 'Sedang menganalisis…' : 'Analisis'}
          </button>
        </div>
      )}

      {!stream && !preview && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white">
          <p className="text-slate-600 mb-5">
            Unggah foto label gizi atau daftar bahan di kemasan.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Camera size={18} /> Buka kamera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <UploadIcon size={18} /> Pilih dari galeri
            </button>
          </div>
          {cameraError && (
            <p className="text-xs text-rose-600 mt-3">{cameraError}</p>
          )}
          <p className="text-xs text-slate-400 mt-4">
            JPEG, PNG, atau WebP · maks 10 MB
          </p>
        </div>
      )}
    </div>
  );
}
