import type { Handle } from '@sveltejs/kit';
import type { SessionPrincipal } from './roles.ts';
import type { ServerPrincipal } from '../database/service.ts';
import type { CmsDatabase } from '../database/contract.ts';
export function servicePrincipal(_principal: SessionPrincipal | null): ServerPrincipal | null { return null; }
export function createCmsHandle(_factory: (event: Parameters<Handle>[0]['event']) => { database: CmsDatabase; mutationsEnabled?: boolean } | undefined | Promise<{ database: CmsDatabase; mutationsEnabled?: boolean } | undefined>): Handle {
  return ({ event, resolve }) => resolve(event);
}
