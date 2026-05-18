import type { Scan } from '../types';
import { request } from './client';

export const scansApi = {
  upload(file: File): Promise<Scan> {
    const form = new FormData();
    form.append('image', file);
    return request<Scan>('/scans', {
      method: 'POST',
      body: form,
    });
  },

  list(): Promise<Scan[]> {
    return request<Scan[]>('/scans');
  },

  get(id: string): Promise<Scan> {
    return request<Scan>(`/scans/${id}`);
  },

  remove(id: string): Promise<void> {
    return request<void>(`/scans/${id}`, { method: 'DELETE' });
  },
};
