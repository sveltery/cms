// TEST ONLY: distinct genuine Source physical tables; no Native installation credit.
import { SeoRepository as NativeSeoRepository } from '../../../src/lib/server/seo/repository.ts';
import { handleSitemapData as nativeSitemap } from '../../../src/lib/server/seo/sitemap.ts';
import { getHreflangAlternatesWithDb as nativeHreflang } from '../../../src/lib/server/seo/hreflang.ts';
import { SOURCE_SEO_STORAGE } from '../../../src/lib/server/seo/storage.ts';
export class SeoRepository extends NativeSeoRepository {
  constructor(db) { super(db, SOURCE_SEO_STORAGE); }
}
export const handleSitemapData = (db, collection) => nativeSitemap(db, collection, SOURCE_SEO_STORAGE);
export const getHreflangAlternatesWithDb = (db, collection, entryId, options) => nativeHreflang(db, collection, entryId, options, SOURCE_SEO_STORAGE);
