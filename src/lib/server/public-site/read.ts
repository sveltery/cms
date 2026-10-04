import { error } from '@sveltejs/kit';
import type { CmsDatabase, Collection, Field } from '../database/contract.ts';
import { SchemaRegistry } from '../database/registry.ts';
import { ContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import type { ContentItem } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { getSeoMeta } from '$lib/seo/meta.ts';
import type { PublicPageContext } from '$lib/seo/types.ts';

export interface PublicEntry {
  id: string; slug: string | null; locale: string | null; title: string;
  data: Record<string, unknown>; createdAt: string; updatedAt: string; publishedAt: string | null;
}
type Definition = Collection & { fields: Field[] };
function project(item: ContentItem, definition: Definition): PublicEntry {
  const data: Record<string, unknown> = {};
  for (const field of definition.fields) {
    const value = item.data[field.slug] ?? null;
    data[field.slug] = field.type === 'boolean' && value !== null ? Boolean(value) : value;
  }
  const title = data[definition.titleField ?? 'title'];
  return { id: item.id, slug: item.slug, locale: item.locale, title: typeof title === 'string' ? title : definition.labelSingular ?? definition.label,
    data, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.publishedAt };
}
export function publicDatabase(locals: App.Locals): CmsDatabase {
  const database = locals.cms?.database;
  if (!database) error(503, { message: 'Content storage is not configured', code: 'NOT_CONFIGURED' });
  return database;
}
export async function publicCollection(database: CmsDatabase, type: 'posts' | 'pages') {
  return new SchemaRegistry(database).getCollectionWithFields(type);
}
export async function publishedEntry(database: CmsDatabase, definition: Definition, identifier: string, locale?: string): Promise<PublicEntry | null> {
  // Exact pinned repository ID/slug resolution; IDs are globally unique, while
  // slug lookups honor the requested locale. No revision/draft hydration occurs.
  const item = await new ContentRepository(database.db as never).findByIdOrSlug(definition.slug, identifier, locale);
  return item?.status === 'published' ? project(item, definition) : null;
}
export async function publishedCollection(database: CmsDatabase, definition: Definition, locale?: string, limit = 20): Promise<PublicEntry[]> {
  const result = await new ContentRepository(database.db as never).findMany(definition.slug, { where: { status: 'published', ...(locale ? { locale } : {}) }, orderBy: { field: 'publishedAt', direction: 'desc' }, limit });
  return result.items.map(item => project(item, definition));
}
export function pageContext(entry: PublicEntry, collection: string, url: URL, origin: string): PublicPageContext {
  const seo = getSeoMeta({ data: entry.data }, { siteUrl: origin, path: url.pathname, defaultTitle: entry.title });
  return { url: origin + url.pathname, path: url.pathname, locale: entry.locale, kind: 'content', pageType: collection === 'posts' ? 'article' : 'website',
    title: seo.title, pageTitle: seo.ogTitle, description: seo.description, canonical: seo.canonical, image: seo.ogImage,
    content: { collection, id: entry.id, slug: entry.slug }, seo,
    articleMeta: collection === 'posts' ? { publishedTime: entry.publishedAt, modifiedTime: entry.updatedAt } : undefined };
}
