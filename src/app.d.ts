import type { CmsDatabase } from './lib/server/database/contract';
import type { ServerPrincipal } from './lib/server/database/service';

declare global {
  namespace App {
    interface Platform {
      env?: Record<string, unknown>;
      ctx?: { waitUntil(task: Promise<unknown>): void };
      context?: { waitUntil(task: Promise<unknown>): void };
    }
    interface Error { code?: string }
    interface Locals {
      // Explicit adapter injection, populated only by trusted server session composition.
      cms?: { database: CmsDatabase; principal: ServerPrincipal | null; mutationsEnabled?: boolean };
      cmsRuntime?: { readonly publicOrigin: string; readonly basePath: string; readonly rpName: string };
    }
  }
}

export {};
