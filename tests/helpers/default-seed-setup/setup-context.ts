// Test-only Astro APIContext → actual setup policy transport. Whole Original
// bodies keep their Request/data/clocks/query plugin; no principal or auth probe.
import { registeredSeedDatabaseOwner } from '../../../src/lib/server/seed/namespace.ts';
import { getConfiguredOrigin } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/core/src/api/public-url.ts';
export async function POST(context: { request: Request; url: URL; locals: { emdash?: { db: any; config?: {siteUrl?: string}; storage?: any } } }) {
  const { applySetupSite } = await import('../../../src/lib/server/setup/site.ts');
  const emdash = context.locals.emdash;
  return applySetupSite({ request: context.request, url: context.url,
    database: emdash?.db ? registeredSeedDatabaseOwner(emdash.db) : undefined,
    seedDb: emdash?.db, storage: emdash?.storage,
    configuredOrigin: getConfiguredOrigin(emdash?.config), development: import.meta.env.DEV,
    workers: typeof navigator !== 'undefined' && navigator.userAgent.includes('Cloudflare-Workers') });
}
