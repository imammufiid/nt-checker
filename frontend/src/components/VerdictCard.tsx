import type { Scan } from '../lib/types';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const tierConfig = {
  healthy: {
    label: 'Sehat',
    Icon: CheckCircle2,
    classes: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  moderate: {
    label: 'Cukup',
    Icon: AlertTriangle,
    classes: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  unhealthy: {
    label: 'Tidak Sehat',
    Icon: XCircle,
    classes: 'bg-rose-50 border-rose-200 text-rose-800',
  },
} as const;

export default function VerdictCard({ scan }: { scan: Scan }) {
  const cfg = tierConfig[scan.verdict.tier];
  const Icon = cfg.Icon;

  return (
    <div className={`border rounded-xl p-5 ${cfg.classes}`}>
      <div className="flex items-start gap-3">
        <Icon size={36} className="flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold">{cfg.label}</h2>
            <span className="text-sm font-medium">
              Skor: {scan.verdict.score}/100
            </span>
          </div>
          <p className="font-medium mt-1">{scan.verdict.summary}</p>
          <p className="text-sm mt-2 opacity-90">{scan.verdict.explanation}</p>
          {scan.extractionConfidence === 'low' && (
            <p className="text-xs mt-3 opacity-80 italic">
              ⚠️ Foto kurang jelas — coba ambil ulang dengan cahaya yang lebih
              terang supaya hasil lebih akurat.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
