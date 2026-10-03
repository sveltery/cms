import type { CmsDatabase } from './lib/server/database/contract';
import type { ServerPrincipal } from './lib/server/database/service';
import type { ContentValidationIssue } from './lib/server/schema/validate-content';

declare global {
  namespace App {
    interface Platform {
      env?: Record<string, unknown>;
      ctx?: { waitUntil(task: Promise<unknown>): void };
      context?: { waitUntil(task: Promise<unknown>): void };
    }
    interface Error { code?: string; details?: { issues: ContentValidationIssue[] } }
    interface Locals {
      cmsSearch?: { readonly ensureHealthy: () => Promise<void> };
      /** Optional trusted clock for source scheduled-content administration. */
      cmsDashboardNow?: Date;
      /** Seed configuration supplied only by trusted server composition, never request JSON. */
      cmsSetupSeed?: import('./lib/server/setup/upstream/types').SeedFile;
      // Explicit adapter injection, populated only by trusted server session composition.
      cms?: { database: CmsDatabase; principal: ServerPrincipal | null; mutationsEnabled?: boolean };
      cmsRuntime?: { readonly publicOrigin: string; readonly basePath: string; readonly rpName: string };
    }
  }
}

export {};
