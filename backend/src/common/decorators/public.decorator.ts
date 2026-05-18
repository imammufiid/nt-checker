import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt-out marker for the globally-registered `JwtAuthGuard`. Apply to a
 * controller class or a route handler that should NOT require a bearer token
 * (e.g. `/auth/*`, `/health`, `/uploads/*`).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
