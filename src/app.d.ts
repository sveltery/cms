import type { Storage } from './lib/server/general-media/upstream/storage/types';
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
    interface Error { code?: string; details?: { issues: ContentValidationIssue[] } | { userId: string; userName: string | null; acquiredAt: string; expiresAt: string } }
    interface Locals {
      // Explicit adapter injection, populated only by trusted server session composition.
      cms?: { storage?: Storage; database: CmsDatabase; principal: ServerPrincipal | null; mutationsEnabled?: boolean; keepAlive?: (task: Promise<void>) => void };
      cmsRuntime?: { readonly publicOrigin: string; readonly basePath: string; readonly rpName: string };
    }
  }
}

export {};
