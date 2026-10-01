import type { Principal, ContentRepository } from './lib/server/content/service';

declare global {
  namespace App {
    interface Locals {
      // Populate only from trusted server authentication and adapter composition.
      cms?: { principal: Principal | null; repository: ContentRepository };
    }
  }
}

export {};
