import type { AuthBundle, AuthUser, RefreshResponse } from '../types';
import { request } from './client';

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  signup(input: SignupInput): Promise<AuthBundle> {
    return request<AuthBundle>('/auth/signup', {
      method: 'POST',
      body: input,
      skipAuth: true,
      skipRefresh: true,
    });
  },

  login(input: LoginInput): Promise<AuthBundle> {
    return request<AuthBundle>('/auth/login', {
      method: 'POST',
      body: input,
      skipAuth: true,
      skipRefresh: true,
    });
  },

  /**
   * Hits POST /auth/refresh. The refresh token is sent via the httpOnly cookie
   * the BE issued — we deliberately do NOT pass `refresh_token` in the body.
   * Sends an empty JSON body to keep ValidationPipe (whitelist) happy.
   */
  refresh(): Promise<RefreshResponse> {
    return request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: {},
      skipAuth: true,
      skipRefresh: true,
    });
  },

  logout(): Promise<void> {
    return request<void>('/auth/logout', {
      method: 'POST',
      // Even if the access token is already expired, we still want to clear the
      // refresh cookie server-side, so skip the refresh dance.
      skipRefresh: true,
    });
  },

  me(): Promise<AuthUser> {
    return request<AuthUser>('/users/me');
  },
};
