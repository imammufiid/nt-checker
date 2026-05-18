import { AlertTriangle } from 'lucide-react';
import { ApiError } from '../lib/api/client';
import { id } from '../lib/id';

interface Props {
  error: ApiError | Error | null;
  /**
   * Per-page overrides keyed on the error code, e.g.
   * `{ DUPLICATE_EMAIL: 'Email sudah terdaftar. Coba masuk.' }`.
   */
  codeMap?: Record<string, string>;
}

const DEFAULT_MAP: Record<string, string> = {
  UNAUTHORIZED: id.errors.unauthorized,
  TOKEN_EXPIRED: id.errors.unauthorized,
  RATE_LIMITED: id.errors.rateLimited,
  NOT_FOUND: id.errors.notFound,
  INVALID_INPUT: id.errors.invalidInput,
  NETWORK_ERROR: id.errors.network,
};

export default function ApiErrorBanner({ error, codeMap }: Props) {
  if (!error) return null;
  let message: string = id.errors.generic;
  if (error instanceof ApiError) {
    message =
      codeMap?.[error.code] ??
      DEFAULT_MAP[error.code] ??
      error.message ??
      id.errors.generic;
  } else if (error.message) {
    message = error.message;
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm flex items-start gap-2"
    >
      <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
