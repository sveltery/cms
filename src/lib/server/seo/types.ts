import type { Generated } from 'kysely';
import type { CmsTables, CollectionRow } from '../database/contract.ts';

// Pinned Source database/types.ts SeoTable; actual Native physical table name.
export interface SeoTable {
  collection: string;
  content_id: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
  seo_canonical: string | null;
  seo_no_index: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}
export interface Database extends CmsTables {
  _cms_collections: CollectionRow & { has_seo: number; routable: number; url_pattern: string | null };
  _cms_seo: SeoTable;
}
