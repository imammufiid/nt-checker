import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  tier: 'free' | 'premium';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tier: 'free' | 'premium';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      // Defense-in-depth: bootstrap also enforces this before the app is up.
      throw new Error('JWT_ACCESS_SECRET is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    // Passport attaches the return value to `req.user`.
    return {
      id: payload.sub,
      email: payload.email,
      tier: payload.tier,
    };
  }
}
