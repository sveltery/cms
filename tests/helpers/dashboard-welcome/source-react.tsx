// Test-only React transport forwards the complete original fixtures to the
// actual native Svelte components; it neither creates product data nor runs auth.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync, mount, unmount } from 'svelte';
import NativeDashboard from '../../../src/lib/dashboard/Dashboard.svelte';
import NativeWelcome from '../../../src/lib/dashboard/WelcomeModal.svelte';
import { apiFetch, throwResponseError } from './source-client';
import { fetchDashboardStats, dismissScheduledPolicyRejection } from './source-dashboard';
import { fetchTransferCapabilities } from './source-transfer';
import { useCurrentUser } from './source-current-user';
import type { DashboardManifest, DashboardStats } from '../../../src/lib/dashboard/types';

export function Dashboard({ manifest }: { manifest: DashboardManifest }) {
  const target = React.useRef<HTMLDivElement>(null);
  const { data: user } = useCurrentUser() as unknown as { data?: { role: number } };
  React.useLayoutEffect(() => {
    const client = {
      fetchDashboardStats: () => fetchDashboardStats() as Promise<DashboardStats>,
      dismissScheduledPolicyRejection,
      fetchTransferCapabilities: () => fetchTransferCapabilities() as Promise<{ portableDomain: { empty: boolean } }>
    };
    const instance = flushSync(() => mount(NativeDashboard, { target: target.current!, props: { manifest, user, client } }));
    return () => { void unmount(instance); };
  }, [manifest, user]);
  return React.createElement('div', { ref: target });
}

export function WelcomeModal(props: { open: boolean; onClose: () => void; userName?: string; userRole: number }) {
  const target = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  React.useLayoutEffect(() => {
    async function dismissWelcome() {
      const response = await apiFetch('/_emdash/api/auth/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dismissWelcome' }) });
      if (!response.ok) await throwResponseError(response, 'Failed to dismiss welcome');
    }
    function onDismissed() {
      queryClient.setQueryData(['currentUser'], (old: unknown) => old && typeof old === 'object' ? { ...old, isFirstLogin: false } : old);
    }
    const instance = flushSync(() => mount(NativeWelcome, { target: target.current!, props: { ...props, siteName: 'EmDash', dismissWelcome, onDismissed } }));
    return () => { void unmount(instance); };
  }, [props, queryClient]);
  return React.createElement('div', { ref: target });
}
