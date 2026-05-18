import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { DomainException } from '../exceptions/domain.exception';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Single source of error responses for the API. Enforces the standard error
 * envelope per API_CONTRACT.md §1.3 and maps every exception class to an
 * appropriate `error.code` from §11.
 *
 * - `DomainException` subclasses carry their own `code` and details.
 * - `class-validator` failures (thrown by `ValidationPipe`) → INVALID_INPUT.
 * - Stock NestJS HttpException → mapped by status code.
 * - Unknown errors → 500 INTERNAL_ERROR with no stack leak.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body } = this.toEnvelope(exception);

    if (status >= 500) {
      // Log server errors with stack but never echo to client.
      this.logger.error(
        `[${req.method} ${req.url}] ${(exception as Error)?.message ?? 'unknown error'}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json(body);
  }

  private toEnvelope(exception: unknown): {
    status: number;
    body: ErrorEnvelope;
  } {
    // 1) Domain exceptions: trust their payload.
    if (exception instanceof DomainException) {
      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
          },
        },
      };
    }

    // 2) Stock HttpException (incl. ValidationPipe BadRequestException).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const message =
        typeof raw === 'string'
          ? raw
          : (raw as { message?: string | string[] }).message ??
            exception.message;
      const details =
        typeof raw === 'object' && raw !== null
          ? (raw as Record<string, unknown>)
          : undefined;
      const code = this.codeForStatus(status, details);

      // class-validator returns `message: string[]` from ValidationPipe.
      // Surface the first violation as the `message` and stash full set in details.
      let humanMessage: string;
      let extraDetails: Record<string, unknown> | undefined;

      if (Array.isArray(message)) {
        humanMessage = message[0] ?? 'Validation failed';
        extraDetails = {
          constraints: message,
        };
      } else if (typeof message === 'string') {
        humanMessage = message;
      } else {
        humanMessage = exception.message;
      }

      return {
        status,
        body: {
          success: false,
          error: {
            code,
            message: humanMessage,
            ...(extraDetails ? { details: extraDetails } : {}),
          },
        },
      };
    }

    // 3) Unknown — never leak.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
    };
  }

  private codeForStatus(
    status: number,
    body?: Record<string, unknown>,
  ): string {
    // Allow explicit `error: 'CODE'` overrides ONLY when it looks like an API
    // error-code (UPPER_SNAKE_CASE). The stock NestJS HttpException payload
    // uses `error: 'Unauthorized' | 'Bad Request' | ...` which is the HTTP
    // status text, NOT an API error code — those must NOT leak through.
    if (
      body &&
      typeof body.error === 'string' &&
      /^[A-Z][A-Z0-9_]*$/.test(body.error)
    ) {
      return body.error;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'INVALID_INPUT';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'DUPLICATE_EMAIL';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'EXTRACTION_FAILED';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'LLM_UNAVAILABLE';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
