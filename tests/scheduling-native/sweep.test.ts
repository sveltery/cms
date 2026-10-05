import { afterEach, expect, it, vi } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { OptionsRepository } from '../../src/lib/server/options/repository.ts';
import { canonicalSourceDatabase } from '../../src/lib/server/canonical-storage/namespace.ts';
import { RevisionRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';

// Supplemental actual storage contracts; no credentials, HTTP, principal,
// session, concurrency gate, media facade or newly authored race probe.
interface PublishedRef { collection: string; id: string }
interface PublishOptions {
  publishedAt?: string;
  requireScheduledDue?: boolean;
  expectedScheduledAt?: string;
  currentTime?: Date;
}
interface SweepModule {
  publishDueContent(db: Kysely<any>, options?: {
    limit?: number;
    currentTime?: Date;
    publish?: (collection: string, id: string, options: PublishOptions) => Promise<{success: boolean; error?: {code?: string}}>;
    onPublished?: (refs: PublishedRef[]) => Promise<void>;
  }): Promise<PublishedRef[]>;
}
const opened: CmsDatabase[] = [];
const before = new Date('2029-01-01T00:00:00.000Z');
const now = new Date('2030-03-03T09:00:00.000Z');
afterEach(async () => {
  vi.restoreAllMocks();
  for (const database of opened.splice(0)) await database.close();
});
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database);
  await migrateCms(database); registerLifecycleDatabase(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({slug: 'post', label: 'Posts'});
  await registry.createField('post', {slug: 'title', label: 'Title', type: 'string'});
  return { database, repo: new ContentRepository(database.db as any) };
}
async function scheduled(repo: ContentRepository, slug: string, at: string) {
  const item = await repo.create({type: 'post', slug, data: {title: slug}});
  await repo.schedule('post', item.id, at, before);
  return item;
}
async function sweepModule(): Promise<SweepModule> {
  const specifier = '../../src/lib/server/scheduling/' + 'scheduled-publish.ts';
  let module: SweepModule | undefined;
  await expect((async () => { module = await import(specifier); })()).resolves.toBeUndefined();
  return module!;
}

it('publishes a bounded real due backlog at its intended time and drains it on later sweeps', async () => {
  const {database, repo} = await fixture();
  const first = await scheduled(repo, 'first', '2030-03-01T09:00:00.000Z');
  const second = await scheduled(repo, 'second', '2030-03-02T09:00:00.000Z');
  const future = await scheduled(repo, 'future', '2030-03-05T09:00:00.000Z');
  const {publishDueContent} = await sweepModule();
  expect(await publishDueContent(database.db, {limit: 1, currentTime: now})).toEqual([{collection: 'post', id: first.id}]);
  expect((await repo.findById('post', first.id))?.publishedAt).toBe('2030-03-01T09:00:00.000Z');
  expect((await repo.findById('post', first.id))?.scheduledAt).toBeNull();
  expect((await repo.findById('post', second.id))?.status).toBe('scheduled');
  expect(await publishDueContent(database.db, {limit: 1, currentTime: now})).toEqual([{collection: 'post', id: second.id}]);
  expect(await publishDueContent(database.db, {limit: 1, currentTime: now})).toEqual([]);
  expect((await repo.findById('post', future.id))?.status).toBe('scheduled');
});

it('persists the attempted cursor so a failed bounded window does not starve the next due item', async () => {
  const {database, repo} = await fixture();
  const first = await scheduled(repo, 'first', '2030-03-01T09:00:00.000Z');
  const second = await scheduled(repo, 'second', '2030-03-02T09:00:00.000Z');
  const {publishDueContent} = await sweepModule();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const attempted: string[] = [];
  const publish = async (_collection: string, id: string) => {
    attempted.push(id); return {success: false, error: {code: 'CONTENT_PUBLISH_ERROR'}};
  };
  expect(await publishDueContent(database.db, {limit: 1, currentTime: now, publish})).toEqual([]);
  expect(await publishDueContent(database.db, {limit: 1, currentTime: now, publish})).toEqual([]);
  expect(attempted).toEqual([first.id, second.id]);
  expect(await new OptionsRepository(canonicalSourceDatabase(database)).get('emdash:scheduled-publish-cursor:post'))
    .toEqual({scheduledAt: '2030-03-02T09:00:00.000Z', id: second.id});
  expect((await repo.findById('post', first.id))?.status).toBe('scheduled');
});

it('awaits each successful cache callback and keeps a committed publication when that callback rejects', async () => {
  const {database, repo} = await fixture();
  const item = await scheduled(repo, 'due', '2030-03-02T09:00:00.000Z');
  const {publishDueContent} = await sweepModule();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const batches: PublishedRef[][] = [];
  expect(await publishDueContent(database.db, {currentTime: now, onPublished: async refs => {
    batches.push(refs); throw new Error('cache transport unavailable');
  }})).toEqual([{collection: 'post', id: item.id}]);
  expect(batches).toEqual([[{collection: 'post', id: item.id}]]);
  expect((await repo.findById('post', item.id))?.status).toBe('published');
  expect(await publishDueContent(database.db, {currentTime: now})).toEqual([]);
});

it('never calls a publisher for future or soft-deleted scheduled storage', async () => {
  const {database, repo} = await fixture();
  await scheduled(repo, 'future', '2030-03-05T09:00:00.000Z');
  const trashed = await scheduled(repo, 'trashed', '2030-03-01T09:00:00.000Z');
  await repo.delete('post', trashed.id);
  const {publishDueContent} = await sweepModule();
  const publish = vi.fn(async () => ({success: true}));
  expect(await publishDueContent(database.db, {currentTime: now, publish})).toEqual([]);
  expect(publish).not.toHaveBeenCalled();
});

it('reports the pinned staged-slug conflict without publishing or losing the pending schedule', async () => {
  const {database, repo} = await fixture();
  await new SchemaRegistry(database).updateCollection('post', {supports: ['revisions']});
  await repo.create({type: 'post', slug: 'taken', data: {title: 'Other'}});
  const live = await repo.create({type: 'post', slug: 'live', data: {title: 'Live'},
    status: 'published', publishedAt: '2030-03-01T08:00:00.000Z'});
  const revision = await new RevisionRepository(database.db as any).create({
    collection: 'post', entryId: live.id, data: {title: 'Pending', _slug: 'taken'}
  });
  await repo.setDraftRevision('post', live.id, revision.id);
  await repo.schedule('post', live.id, '2030-03-02T09:00:00.000Z', before);
  const stored = await repo.findById('post', live.id);
  const specifier = '../../src/lib/server/scheduling/' + 'publisher.ts';
  let publisher: any;
  await expect((async () => { publisher = await import(specifier); })()).resolves.toBeUndefined();
  expect(await publisher.handleContentPublish(database.db, 'post', live.id, {
    requireScheduledDue: true, expectedScheduledAt: '2030-03-02T09:00:00.000Z', currentTime: now
  })).toMatchObject({success: false, error: {code: 'SLUG_CONFLICT'}});
  expect(await repo.findById('post', live.id)).toEqual(stored);
  expect((await new RevisionRepository(database.db as any).findById(revision.id))?.data)
    .toEqual({title: 'Pending', _slug: 'taken'});
});

// Controlled exceptions from the existing trusted publication dependency.
// These are error-envelope checks, not concurrent publication/race probes.
async function controlledPublicationFailure(errorFactory: (database: CmsDatabase, id: string) => Promise<unknown>) {
  const {database, repo} = await fixture();
  const item = await scheduled(repo, 'live', '2030-03-02T09:00:00.000Z');
  const stored = await repo.findById('post', item.id);
  const error = await errorFactory(database, item.id);
  const publication = vi.spyOn(ContentRepository.prototype, 'publish').mockRejectedValueOnce(error);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const specifier = '../../src/lib/server/scheduling/' + 'publisher.ts';
  const publisher = await import(specifier);
  const result = await publisher.handleContentPublish(database.db, 'post', item.id, {
    requireScheduledDue: true, expectedScheduledAt: '2030-03-02T09:00:00.000Z', currentTime: now
  });
  expect(publication).toHaveBeenCalledOnce();
  expect(await repo.findById('post', item.id)).toEqual(stored);
  return result;
}

it('maps a genuine SQLite slug uniqueness exception to the pinned publication conflict envelope', async () => {
  const result = await controlledPublicationFailure(async (database, id) => {
    const repo = new ContentRepository(database.db as any);
    await repo.create({type: 'post', slug: 'taken', data: {title: 'Other'}});
    let failure: unknown;
    try { await sql`UPDATE ec_post SET slug = 'taken' WHERE id = ${id}`.execute(database.db); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/unique constraint failed.*slug/i);
    return failure;
  });
  expect(result).toEqual({success: false, error: {code: 'SLUG_CONFLICT',
    message: "The staged slug is already used by another entry in collection 'post'"}});
});

it('maps a controlled PostgreSQL duplicate-key slug fingerprint without claiming PostgreSQL storage execution', async () => {
  const result = await controlledPublicationFailure(async () =>
    new Error('Duplicate key value violates unique constraint "ec_post_slug_locale_key"'));
  expect(result).toEqual({success: false, error: {code: 'SLUG_CONFLICT',
    message: "The staged slug is already used by another entry in collection 'post'"}});
});

it('keeps an unrelated uniqueness exception as the generic publication error', async () => {
  const result = await controlledPublicationFailure(async () =>
    new Error('UNIQUE constraint failed: ec_post.id'));
  expect(result).toEqual({success: false, error: {code: 'CONTENT_PUBLISH_ERROR', message: 'Failed to publish content'}});
});

it('keeps a slug exception without a uniqueness fingerprint as the generic publication error', async () => {
  const result = await controlledPublicationFailure(async () => new Error('slug storage unavailable'));
  expect(result).toEqual({success: false, error: {code: 'CONTENT_PUBLISH_ERROR', message: 'Failed to publish content'}});
});

it('does not treat a non-Error message property as a database slug exception', async () => {
  const result = await controlledPublicationFailure(async () => ({message: 'UNIQUE constraint failed: ec_post.slug'}));
  expect(result).toEqual({success: false, error: {code: 'CONTENT_PUBLISH_ERROR', message: 'Failed to publish content'}});
});
