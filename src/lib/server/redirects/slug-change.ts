// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Complete createSlugChangeRedirect/slugStillTaken authority from
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/handlers/content.ts.
// Native namespace/type narrowing and adapter-owned cache invalidation only.
import { sql, type Kysely } from 'kysely';
import { RawBindingD1Adapter } from '../database/d1.ts';
import { ContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import type { ContentItem } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { validateIdentifier } from '../database/lifecycle/upstream/database/validate.ts';
import { RedirectRepository } from './repository.ts';
import type { Database as RedirectDatabase } from './database-types.ts';
import { invalidateRedirectCache } from './cache.ts';
import { invalidateDatabaseRedirectCache } from './database-cache.ts';
import { publishRedirectChanges } from './artifacts.ts';
import { after } from './after.ts';

function redirectDatabase(db: Kysely<Database>) {
 return db.withTables<{[Name in keyof RedirectDatabase]:RedirectDatabase[Name]}>().$pickTables<keyof RedirectDatabase>();
}

export async function createSlugChangeRedirect(
	db: Kysely<Database>,
	collection: string,
	oldSlug: string,
	newSlug: string,
	contentId: string,
	oldPublishedAt: string | null,
	newPublishedAt: string | null,
): Promise<boolean> {
	// A URL pattern has no locale token, so every locale variant of an entry
	// generates the same URL, and slugs are unique per (slug, locale) — a
	// translation may still hold the old slug. Redirecting away from a URL
	// another row still answers on would take that page down: the redirect
	// middleware runs `order: "pre"`, so routing never gets a chance.
	// Any surviving row counts, published or not: a draft that publishes later
	// would otherwise be shadowed by the redirect.
	if (await slugStillTaken(db, collection, oldSlug, contentId)) return false;

	const collectionRow = await db
		.selectFrom("_cms_collections")
		.select("url_pattern")
		.where("slug", "=", collection)
		.executeTakeFirst();

	const redirectRepo = new RedirectRepository(redirectDatabase(db));
	const redirect = await redirectRepo.createAutoRedirect(
		collection,
		oldSlug,
		newSlug,
		contentId,
		collectionRow?.url_pattern ?? null,
		oldPublishedAt,
		newPublishedAt,
	);
	invalidateRedirectCache();
	invalidateDatabaseRedirectCache(db);
	return redirect !== null;
}

/** Whether a row other than `contentId` still holds `slug` in this collection. */
async function slugStillTaken(
	db: Kysely<Database>,
	collection: string,
	slug: string,
	contentId: string,
): Promise<boolean> {
	validateIdentifier(collection, "collection slug");
	const result = await sql<{ id: string }>`
		SELECT id FROM ${sql.ref(`ec_${collection}`)}
		WHERE slug = ${slug}
		AND id != ${contentId}
		AND deleted_at IS NULL
		LIMIT 1
	`.execute(db);
	return result.rows.length > 0;
}

/** Owned direct slug-update engine; public lifecycle/API composition is separate. */
export async function updateContentSlug(
 db: Kysely<Database>, collection: string, id: string, slug: string | null, defer: typeof after = after
): Promise<ContentItem> {
 if(db.getExecutor().adapter instanceof RawBindingD1Adapter) {
  throw new Error('D1 content and slug redirect atomic composition is not implemented');
 }
 let redirectCreated=false;
 const item=await db.transaction().execute(async trx=>{
  const repository=new ContentRepository(trx);
  const existing=await repository.findById(collection,id);
  const updated=await repository.update(collection,id,{slug});
  if(slug&&existing?.slug&&existing.slug!==slug) {
   redirectCreated=await createSlugChangeRedirect(trx,collection,existing.slug,slug,id,
    existing.publishedAt??null,updated.publishedAt??null);
  }
  return updated;
 });
 if(redirectCreated)defer(()=>publishRedirectChanges(redirectDatabase(db)));
 return item;
}
