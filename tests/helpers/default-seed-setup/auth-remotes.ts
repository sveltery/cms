// Test-only framework bindings for the actual current setup page. Query values
// come from the unchanged Original API mock; no enrollment action is supplied.
import type { QueryClient } from '@tanstack/react-query';
import { apiFetch, parseApiResponse } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client';
let queryClient: QueryClient;
export function setControlledQueryClient(value: QueryClient) { queryClient = value; }
export function getSetupStatus() {
  return queryClient.fetchQuery({ queryKey: ['setup', 'status'], retry: false,
    queryFn: async () => parseApiResponse(await apiFetch('/_emdash/api/setup/status'), 'Failed to fetch setup status') });
}
const field = (name: string) => ({ as(type: string, value?: string) { return { name, type, value }; } });
const unavailable = () => { throw new Error('Account enrollment is outside this controlled wizard baseline'); };
export const beginSetup = {
  fields: { email: field('email'), name: field('name'), allIssues: () => [] }, pending: 0, result: undefined as unknown,
  enhance: (callback: (value: { submit: () => Promise<void> }) => Promise<void>) => ({
    async onsubmit(event: SubmitEvent) {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      await callback({ submit: async () => {
        const response = await apiFetch('/_emdash/api/setup/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.get('email'), name: data.get('name') || undefined }) });
        beginSetup.result = await parseApiResponse(response, 'Failed to create admin');
      } });
    }
  }), submit: unavailable
};
export const completeSetup = {
  fields: { credential: field('credential') }, pending: 0, result: undefined, submit: unavailable
};
