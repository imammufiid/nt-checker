import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, IssuedTokens } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../users/user.entity';

const REFRESH_COOKIE = 'nt_refresh';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.signup(
      body.email,
      body.password,
      body.name,
      this.requestCtx(req),
    );
    this.setRefreshCookie(res, tokens);
    return this.authResponse(user, tokens);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(
      body.email,
      body.password,
      this.requestCtx(req),
    );
    this.setRefreshCookie(res, tokens);
    return this.authResponse(user, tokens);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const incoming = cookieToken ?? body.refresh_token;
    const { tokens } = await this.auth.refresh(incoming, this.requestCtx(req));
    this.setRefreshCookie(res, tokens);
    return {
      access_token: tokens.accessToken,
      expires_in: tokens.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(cookieToken);
    this.clearRefreshCookie(res);
    return undefined;
  }

  // ---------------- helpers ----------------

  private authResponse(user: User, tokens: IssuedTokens) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription_tier: user.subscriptionTier,
        created_at: user.createdAt,
      },
      tokens: {
        access_token: tokens.accessToken,
        expires_in: tokens.expiresIn,
      },
    };
  }

  private setRefreshCookie(res: Response, tokens: IssuedTokens): void {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: tokens.refreshExpiresIn * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.cookie(REFRESH_COOKIE, '', {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 0,
    });
  }

  private requestCtx(req: Request) {
    return {
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      ip: (req.ip as string | undefined) ?? null,
    };
  }
}
