import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './jwt.strategy';

/**
 * Extracts the validated user attached to the request by `JwtStrategy.validate`.
 * Throws nothing — guard already enforces authentication, so by the time this
 * runs, `req.user` is populated. On public routes that opt into this decorator
 * the value will be `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthenticatedUser | undefined;
  },
);
