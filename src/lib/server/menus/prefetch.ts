import { getDb } from './loader.ts';
import { getMenu } from './index.ts';
import { resolveLocale } from './i18n-resolve.ts';
import { cachedQuery, CacheNamespace } from './object-cache.ts';
import { requestCached } from './request-cache.ts';

/** Menu-only prefetch; other layout families are outside this function. */
export async function prefetchMenus(): Promise<void> {
  const locale = resolveLocale();
  const names = await requestCached(`menu-names:${locale ?? '*'}`, () => cachedQuery({
    namespace: CacheNamespace.MENUS,
    key: `names:${locale ?? '*'}`,
    async load() {
      const db = await getDb();
      let query = db.selectFrom('_emdash_menus').select('name').distinct();
      if (locale !== undefined) query = query.where('locale', '=', locale);
      return (await query.execute()).map(row => row.name);
    }
  }));
  await Promise.all(names.map(name => getMenu(name)));
}
export const prefetchLayoutData = prefetchMenus;
