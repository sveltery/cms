import type { Kysely } from 'kysely';
import type { Database } from '../database/types.ts';
import type { EmDashConfig } from '../astro/integration/runtime.ts';
/** Trusted native presentation configuration; never infer an origin from request headers. */
export async function getSiteBaseUrl(_db: Kysely<Database>, _request: Request, config: EmDashConfig): Promise<string> {
 if (!config.nativeAdminBaseUrl) throw new Error('Comment notification site URL is unavailable');
 return config.nativeAdminBaseUrl;
}
