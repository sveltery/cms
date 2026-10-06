// Native transport of complete pinned SetupWizard site-mutation algorithm.
// EmDash 1.1.0 913cb1bb; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { API_BASE, apiFetch, parseApiResponse } from '../sections-widgets/client.ts';

export type StartWith = 'sample' | 'empty' | 'import';
export interface SeedProgress { done: number; total: number }
export interface SetupSiteInput { title: string; tagline?: string; includeContent: boolean }
export interface SetupSiteResult {
  success: boolean; setupComplete?: boolean; seedComplete?: boolean; seedProgress?: SeedProgress;
  result?: unknown;
}
export interface SetupWizardStatus {
  needsSetup: boolean; unavailable?: boolean;
  /** Actual account producer returns a string; Source wizard starts at Site. */
  step?: string;
  authMode?: string;
  seedInfo?: { name: string; description: string; collections: number; hasContent: boolean;
    title?: string; tagline?: string } | null;
}

export function createSetupClient(fetcher = apiFetch, apiBase = API_BASE) {
  return {
    async applySite(data: SetupSiteInput, onProgress: (value: SeedProgress) => void) {
      let lastDone = -1;
      for (;;) {
        const response = await fetcher(`${apiBase}/setup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const result = await parseApiResponse<SetupSiteResult>(response, 'Setup failed');
        if (result.seedComplete !== false) return result;
        if (!result.seedProgress || result.seedProgress.done <= lastDone) throw new Error('Setup failed');
        lastDone = result.seedProgress.done;
        onProgress(result.seedProgress);
      }
    },
  };
}
export const setupClient = createSetupClient();
