import type { CmsDatabase } from './lib/server/database/contract';
import type { ServerPrincipal } from './lib/server/database/service';
import type { ContentValidationIssue } from './lib/server/schema/validate-content';

declare global {
  namespace App {
    interface Error { code?: string; details?: { issues: ContentValidationIssue[] } }
    interface Locals {
      // Explicit adapter injection, populated only by trusted server session composition.
      cms?: { database: CmsDatabase; principal: ServerPrincipal | null; mutationsEnabled?: boolean };
      cmsRuntime?: { readonly publicOrigin: string; readonly basePath: string; readonly rpName: string };
    }
  }
}

export {};
