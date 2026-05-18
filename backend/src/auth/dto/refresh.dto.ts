import { IsOptional, IsString } from 'class-validator';

/**
 * Refresh primarily happens via httpOnly cookie. This body is the fallback for
 * non-browser clients (e.g. future mobile native).
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
