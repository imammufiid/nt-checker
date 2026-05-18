import type { AuthUser, HealthProfile } from '../types';
import { request } from './client';

export const usersApi = {
  getProfile(): Promise<HealthProfile> {
    return request<HealthProfile>('/users/me/profile');
  },

  putProfile(profile: HealthProfile): Promise<HealthProfile> {
    return request<HealthProfile>('/users/me/profile', {
      method: 'PUT',
      body: profile,
    });
  },

  patchUser(input: { name: string }): Promise<AuthUser> {
    return request<AuthUser>('/users/me', {
      method: 'PATCH',
      body: input,
    });
  },
};
