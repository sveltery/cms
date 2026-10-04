// Test-only JSX/framework bridge. It mounts the actual Svelte wizard and adapts
// the original Source provider components, API mocks and navigation spy.
import * as React from 'react';
import { flushSync, mount, unmount } from 'svelte';
import { apiFetch, fetchManifest, parseApiResponse } from './source-client';
import { useAuthProviderList } from '../../../parity/emdash/setup-wizard-source/upstream/packages/admin/src/lib/auth-provider-context';
import { navigateTo } from '../../../parity/emdash/setup-wizard-source/upstream/packages/admin/src/lib/navigation.js';
import type { SetupClient, StartWith } from '../../../src/lib/setup/types';
import SourceWizardHost from './SourceWizardHost.svelte';

export function SetupWizard() {
  const target = React.useRef<HTMLDivElement>(null);
  const providers = useAuthProviderList();
  React.useLayoutEffect(() => {
    const post = <T,>(path: string, data: unknown, fallback: string) => apiFetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(response => parseApiResponse<T>(response, fallback));
    const client: SetupClient = {
      status: () => apiFetch('/_emdash/api/setup/status').then(response => parseApiResponse(response, 'Failed to fetch setup status')),
      site: data => post('/_emdash/api/setup', data, 'Setup failed'),
      prepareAdmin: data => post('/_emdash/api/setup/admin', data, 'Failed to create admin'),
      branding: fetchManifest,
      passkeys: {
        getOptions: async (email, name) => {
          const result = await post<{ options: Awaited<ReturnType<SetupClient['passkeys']['getOptions']>> }>('/_emdash/api/setup/admin', { email, name }, 'Failed to get registration options');
          if (!result.options) throw new Error('No registration options received');
          return result.options;
        },
        verify: (email, name, credential) => post('/_emdash/api/setup/admin/verify', { credential, email, name }, 'Failed to verify registration')
      }
    };
    const destination = (choice: StartWith) => choice === 'import' ? '/_emdash/admin/settings/transfer?start=import' : '/_emdash/admin';
    const instance = flushSync(() => mount(SourceWizardHost, { target: target.current!, props: { client, providers, navigate: navigateTo, destination } }));
    return () => { void unmount(instance); };
  }, [providers]);
  return React.createElement('div', { ref: target });
}
