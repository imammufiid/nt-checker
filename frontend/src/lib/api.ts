import type { Scan } from './types';

const API_BASE = '/api';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  upload(file: File): Promise<Scan> {
    const form = new FormData();
    form.append('image', file);
    return fetch(`${API_BASE}/scans`, { method: 'POST', body: form }).then(
      handle<Scan>,
    );
  },

  list(): Promise<Scan[]> {
    return fetch(`${API_BASE}/scans`).then(handle<Scan[]>);
  },

  get(id: string): Promise<Scan> {
    return fetch(`${API_BASE}/scans/${id}`).then(handle<Scan>);
  },

  remove(id: string): Promise<void> {
    return fetch(`${API_BASE}/scans/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok) throw new Error('Delete failed');
    });
  },
};
