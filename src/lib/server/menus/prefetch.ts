import { getDb } from './loader.ts';
import { getTaxonomyDefs, getTaxonomyTerms } from '../taxonomies/index.ts';
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
      let query = db.selectFrom('_cms_menus').select('name').distinct();
      if (locale !== undefined) query = query.where('locale', '=', locale);
      return (await query.execute()).map(row => row.name);
    }
  }));
  await Promise.all(names.map(name => getMenu(name)));
}
// Whole pinned Source taxonomy prefetch: warm actual per-name lists without counts.
async function prefetchTaxonomyTerms(): Promise<void> {
 const defs=await getTaxonomyDefs();
 await Promise.allSettled(defs.map(def=>getTaxonomyTerms(def.name,{includeCounts:false})));
}
export async function prefetchLayoutData():Promise<void> {
 await Promise.allSettled([prefetchMenus(),prefetchTaxonomyTerms()]);
}
