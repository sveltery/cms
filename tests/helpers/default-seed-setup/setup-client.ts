// Finite controlled framework transport: real Native algorithm receives the
// unchanged Original apiFetch function and exact Original endpoint strings.
import { apiFetch } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client';
import { createSetupClient } from '../../../src/lib/setup/client.ts';
export * from '../../../src/lib/setup/client.ts';
export const setupClient = createSetupClient(apiFetch, '/_emdash/api');
