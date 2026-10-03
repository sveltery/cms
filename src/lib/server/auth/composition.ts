import type { Handle, RequestEvent } from '@sveltejs/kit';
import { hasPermission } from './permissions.ts';
import { isRoleLevel, type SessionPrincipal } from './roles.ts';
import { resolvePrincipal } from './session.ts';
import { SESSION_COOKIE_NAME } from './request.ts';
import { createKyselySessionStore } from './store.ts';
import type { Permission, ServerPrincipal } from '../database/service.ts';
import type { CmsDatabase } from '../database/contract.ts';

const servicePermissions: readonly Permission[] = Object.freeze([
  'taxonomies:read', 'taxonomies:manage', 'settings:read', 'settings:manage', 'schema:read', 'schema:manage', 'content:read', 'content:read_drafts', 'content:create',
  'content:edit_own', 'content:edit_any', 'content:delete_own', 'content:delete_any',
  'content:publish_own', 'content:publish_any'
]);

/** Accept only a server-resolved principal; request claims never enter this bridge. */
export function servicePrincipal(principal: SessionPrincipal | null): ServerPrincipal | null {
  if (!principal || !isRoleLevel(principal.role) || typeof principal.id !== 'string' || !principal.id.length || principal.id.length > 128) return null;
  return Object.freeze({ id: principal.id, permissions: Object.freeze(servicePermissions.filter(permission => hasPermission(principal, permission))) });
}

export interface CmsRequestConfiguration {
  /** An already-migrated adapter from trusted server configuration, scoped to this request. */
  database: CmsDatabase;
  /** Explicit server-only opt-in; absence and any value other than true keep HTTP writes disabled. */
  mutationsEnabled?: boolean;
  /** Supply this request's workerd waitUntil when the hosting adapter supports it. */
  keepAlive?: (task: Promise<void>) => void;
}

/** No database opening, migrations, credential issuance or process-global principal caching. */
export function createCmsHandle(factory: (event: RequestEvent) => CmsRequestConfiguration | undefined | Promise<CmsRequestConfiguration | undefined>): Handle {
  return async ({ event, resolve }) => {
    delete event.locals.cms;
    const configuration = await factory(event);
    if (configuration) {
      const principal = await resolvePrincipal(event.cookies.get(SESSION_COOKIE_NAME), createKyselySessionStore(configuration.database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()), { keepAlive: configuration.keepAlive });
      event.locals.cms = Object.freeze({ database: configuration.database, principal: servicePrincipal(principal), mutationsEnabled: configuration.mutationsEnabled === true });
    }
    return resolve(event);
  };
}
