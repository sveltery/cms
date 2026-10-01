import type { CmsDatabase } from './lib/server/database/contract';
import type { ServerPrincipal } from './lib/server/database/service';

declare global {
  namespace App {
    interface Error { code?: string }
    interface Locals {
      // Explicit adapter injection, populated only by trusted server session composition.
      cms?: { database: CmsDatabase; principal: ServerPrincipal | null };
    }
  }
}

export {};
