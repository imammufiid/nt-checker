import { HttpException } from '@nestjs/common';

/**
 * Base class for all domain-specific exceptions. Carries the API error `code`
 * (per API_CONTRACT.md §11) alongside an HTTP status. The global
 * `HttpExceptionFilter` reads `code` to build the standard error envelope.
 */
export abstract class DomainException extends HttpException {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
