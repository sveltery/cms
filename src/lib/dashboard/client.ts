// Native paths for the pinned admin dashboard/current-user request contracts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type { CurrentUser, DashboardClient } from './types';
import { parseApiResponse, throwResponseError } from './response';

export function createDashboardClient(basePath = '') {
  async function request(path: string, fallback: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set('X-EmDash-Request', '1');
    const response = await fetch(`${basePath}/api/${path}`, { ...init, headers });
    if (!response.ok) await throwResponseError(response, fallback);
    return response;
  }
  async function read<T>(path: string, fallback: string): Promise<T> { return parseApiResponse<T>(await request(path, fallback), fallback); }
  const client: DashboardClient & { currentUser(): Promise<CurrentUser>; dismissWelcome(): Promise<void> } = {
    fetchDashboardStats: () => read('dashboard', 'Failed to fetch dashboard stats'),
    fetchTransferCapabilities: () => read('admin/transfer/capabilities', 'Failed to load transfer capabilities'),
    async dismissScheduledPolicyRejection(collection, id, revision) {
      await request(`admin/scheduled-policy-rejections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?rev=${encodeURIComponent(revision)}`, 'Failed to dismiss scheduled publication rejection', { method: 'DELETE' });
    },
    currentUser: () => read('auth/me', 'Failed to fetch user'),
    async dismissWelcome() {
      await request('auth/me', 'Failed to dismiss welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dismissWelcome' }) });
    }
  };
  return client;
}
