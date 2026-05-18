import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface RefreshClaims {
  sub: string;
  jti: string;
  family: string;
  iat?: number;
  exp?: number;
}

interface RotationContext {
  userAgent: string | null;
  ip: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------------- Public API ----------------

  async signup(
    email: string,
    password: string,
    name: string | undefined,
    ctx: RotationContext,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email: normalized } });
    if (existing) {
      throw new DuplicateEmailException();
    }

    const passwordHash = await bcrypt.hash(password, this.bcryptCost());
    const user = await this.users.save(
      this.users.create({
        email: normalized,
        passwordHash,
        name: name ?? null,
        subscriptionTier: 'free',
      }),
    );

    const tokens = await this.issueTokensForNewSession(user, ctx);
    return { user, tokens };
  }

  async login(
    email: string,
    password: string,
    ctx: RotationContext,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email: normalized } });

    // Identical error path for unknown-email AND wrong-password to defeat
    // email enumeration per THREAT_MODEL.md F-AUTH-4.
    const passwordOk =
      user !== null && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !passwordOk) {
      // Run a dummy compare on unknown-email to keep timing close. (Best-effort
      // — full constant-time login is SEC-004's job.)
      if (!user) {
        await bcrypt.compare(
          password,
          '$2b$12$abcdefghijklmnopqrstuv0000000000000000000000000000000000',
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokensForNewSession(user, ctx);
    return { user, tokens };
  }

  /**
   * Rotation per backend.md §6.3.
   *  - bad signature / no row / hash mismatch → 401
   *  - already-revoked row → reuse detected → revoke whole family + 401
   *  - otherwise: revoke current, issue new pair under same familyId
   */
  async refresh(
    refreshJwt: string | undefined,
    ctx: RotationContext,
  ): Promise<{ tokens: IssuedTokens; userId: string }> {
    if (!refreshJwt) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: RefreshClaims;
    try {
      payload = await this.jwt.verifyAsync<RefreshClaims>(refreshJwt, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = await this.refreshTokens.findOne({
      where: { id: payload.jti },
    });
    if (!row) {
      // Either rotated-away or logged out. Refuse.
      throw new UnauthorizedException('Invalid refresh token');
    }

    const incomingHash = this.hashToken(refreshJwt);
    if (incomingHash !== row.tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (row.revokedAt) {
      // Reuse of a revoked token → revoke the whole family.
      this.logger.warn(
        `[security] refresh reuse detected family=${row.familyId} user=${row.userId} — revoking family`,
      );
      await this.refreshTokens.delete({ familyId: row.familyId });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findOne({ where: { id: row.userId } });
    if (!user) {
      // User deleted mid-session — clean up + 401.
      await this.refreshTokens.delete({ id: row.id });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Mark old row as revoked (tombstone for reuse detection), then mint the
    // replacement under the same family.
    row.revokedAt = new Date();
    await this.refreshTokens.save(row);

    const tokens = await this.issueTokensForFamily(user, row.familyId, ctx);
    return { tokens, userId: user.id };
  }

  async logout(refreshJwt: string | undefined): Promise<void> {
    if (!refreshJwt) return; // Idempotent: no cookie → nothing to do.
    let payload: RefreshClaims | null = null;
    try {
      payload = await this.jwt.verifyAsync<RefreshClaims>(refreshJwt, {
        secret: this.refreshSecret(),
      });
    } catch {
      // Bad signature — nothing to delete by jti; just no-op.
      return;
    }
    if (payload?.jti) {
      await this.refreshTokens.delete({ id: payload.jti });
    }
  }

  // ---------------- Password helpers (exposed for tests) ----------------

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.bcryptCost());
  }

  comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // ---------------- Internal ----------------

  private async issueTokensForNewSession(
    user: User,
    ctx: RotationContext,
  ): Promise<IssuedTokens> {
    const familyId = randomUUID();
    return this.issueTokensForFamily(user, familyId, ctx);
  }

  private async issueTokensForFamily(
    user: User,
    familyId: string,
    ctx: RotationContext,
  ): Promise<IssuedTokens> {
    const accessTtl = this.accessTtlSec();
    const refreshTtl = this.refreshTtlSec();

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, tier: user.subscriptionTier },
      { secret: this.accessSecret(), expiresIn: accessTtl },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti, family: familyId },
      { secret: this.refreshSecret(), expiresIn: refreshTtl },
    );

    await this.refreshTokens.save(
      this.refreshTokens.create({
        id: jti,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        revokedAt: null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      refreshExpiresIn: refreshTtl,
    };
  }

  private hashToken(jwtString: string): string {
    return createHash('sha256').update(jwtString).digest('hex');
  }

  private accessSecret(): string {
    const v = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!v) throw new Error('JWT_ACCESS_SECRET is required');
    return v;
  }

  private refreshSecret(): string {
    const v = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!v) throw new Error('JWT_REFRESH_SECRET is required');
    return v;
  }

  private accessTtlSec(): number {
    return Number(this.config.get('JWT_ACCESS_TTL_SEC') ?? 900);
  }

  private refreshTtlSec(): number {
    return Number(this.config.get('JWT_REFRESH_TTL_SEC') ?? 604800);
  }

  private bcryptCost(): number {
    const v = Number(this.config.get('BCRYPT_COST') ?? 12);
    return v >= 10 ? v : 12;
  }
}
