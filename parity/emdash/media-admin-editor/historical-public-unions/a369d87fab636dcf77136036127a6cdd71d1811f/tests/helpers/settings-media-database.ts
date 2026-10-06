// Complete pinned setupTestDatabaseWithCollections function; native imports only.
// EmDash1.1.0 MIT2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import type{Kysely}from'kysely';
import type{Database as DatabaseSchema}from'../../src/lib/server/media/source/database/types.ts';
import{SchemaRegistry}from'./media-source-registry.ts';
import{setupTestDatabase}from'./settings-media-fixture.ts';

export async function setupTestDatabaseWithCollections(): Promise<Kysely<DatabaseSchema>> {
	const db = await setupTestDatabase();
	const registry = new SchemaRegistry(db);

	// Create post collection
	await registry.createCollection({
		slug: "post",
		label: "Posts",
		labelSingular: "Post",
	});
	await registry.createField("post", {
		slug: "title",
		label: "Title",
		type: "string",
	});
	await registry.createField("post", {
		slug: "content",
		label: "Content",
		type: "portableText",
	});

	// Create page collection
	await registry.createCollection({
		slug: "page",
		label: "Pages",
		labelSingular: "Page",
	});
	await registry.createField("page", {
		slug: "title",
		label: "Title",
		type: "string",
	});
	await registry.createField("page", {
		slug: "content",
		label: "Content",
		type: "portableText",
	});

	return db;
}
