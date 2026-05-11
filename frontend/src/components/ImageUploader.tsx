import { useEffect, useRef, useState } from 'react';
import { Camera, Upload as UploadIcon, X } from 'lucide-react';

interface Props {
  onSubmit: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onSubmit, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleSelect = (f: File | undefined | null) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />

      {!preview ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white">
          <p className="text-slate-600 mb-5">
            Upload a photo of a nutrition label or ingredient list.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Camera size={18} /> Take photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <UploadIcon size={18} /> Upload file
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            JPEG, PNG, or WebP · max 10 MB
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={preview}
              alt="Selected label"
              className="w-full max-h-96 object-contain rounded-xl border bg-white"
            />
            <button
              onClick={clear}
              disabled={disabled}
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-white disabled:opacity-50"
              aria-label="Remove image"
            >
              <X size={18} />
            </button>
          </div>
          <button
            onClick={() => file && onSubmit(file)}
            disabled={disabled}
            className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {disabled ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      )}
    </div>
  );
}
