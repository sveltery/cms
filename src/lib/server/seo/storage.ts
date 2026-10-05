export const NATIVE_SEO_STORAGE = Object.freeze({
  seo: '_cms_seo',
  collections: '_cms_collections'
} as const);

/** Explicit Source physical reference hosting, separate from Native installation. */
export const SOURCE_SEO_STORAGE = Object.freeze({
  seo: '_emdash_seo',
  collections: '_emdash_collections'
} as const);

export type SeoStorage = typeof NATIVE_SEO_STORAGE | typeof SOURCE_SEO_STORAGE;

export function seoStorage(storage: SeoStorage): SeoStorage {
  if (storage !== NATIVE_SEO_STORAGE && storage !== SOURCE_SEO_STORAGE) {
    throw new TypeError('Unknown SEO storage descriptor');
  }
  return storage;
}
