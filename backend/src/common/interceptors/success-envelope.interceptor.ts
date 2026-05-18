import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/**
 * Wraps every successful (2xx) response body in the standard
 * `{ success: true, data }` envelope per API_CONTRACT.md §1.3.
 *
 * Pass-throughs (no wrapping):
 *   - 204 No Content (no body)
 *   - Already-wrapped bodies that have `success: true` (defensive — lets
 *     controllers pre-wrap if they need pagination siblings).
 */
@Injectable()
export class SuccessEnvelopeInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | T | undefined>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | T | undefined> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        if (res.statusCode === 204) {
          return undefined;
        }
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>)
        ) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
