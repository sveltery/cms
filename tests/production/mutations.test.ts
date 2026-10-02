import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { sql } from 'kysely';
import { persistedRemotes, fields } from '../helpers/persisted-remotes.ts';

describe('built remotes with persisted schema and server-derived sessions', () => {
  let harness: Awaited<ReturnType<typeof persistedRemotes>>;
  beforeEach(async () => { harness = await persistedRemotes(); });
  afterEach(async () => { await harness.close(); });
  const refreshed = (data: any, name: string) => Object.entries(data.q ?? {}).filter(([key]) => key.includes(`/${name}/`)).map(([, value]) => value as any);
  async function create(session = 'author') {
    const output = await harness.mutate('createContent', { collection: 'notes', ...fields({ headline: 'First note', detail: 'Keep this detail' }) }, session);
    const receipt = output._.result;
    const item = session === 'writer' ? receipt : await harness.query('getContent', { collection: 'notes', id: receipt.id }, session);
    return { output, item };
  }
  it('create/read/partial update/trash refresh real queries and survive storage/server restart', async () => {
    const { item, output } = await create();
    assert.deepEqual(item.data, { headline: 'First note', detail: 'Keep this detail' });
    assert.equal(item.authorId, 'user_author');
    assert.ok(item._rev);
    assert.equal(refreshed(output, 'listContent')[0].v.items[0].id, item.id);
    assert.equal(Object.hasOwn(refreshed(output, 'listContent')[0].v.items[0], 'data'), false);
    const read = await harness.query('getContent', { collection: 'notes', id: item.id });
    assert.deepEqual(read, item);
    const update = await harness.mutate('updateContent', { collection: 'notes', id: item.id, _rev: read._rev, ...fields({ headline: 'Edited note' }) });
    const updated = await harness.query('getContent', { collection: 'notes', id: item.id });
    assert.deepEqual(updated.data, { headline: 'Edited note', detail: 'Keep this detail' });
    assert.notEqual(update._.result._rev, read._rev);
    assert.equal(refreshed(update, 'getContent')[0].v.data.headline, 'Edited note');
    await harness.restart();
    assert.deepEqual(await harness.query('getContent', { collection: 'notes', id: item.id }), updated);
    const trash = await harness.mutate('deleteContent', { collection: 'notes', id: item.id, _rev: update._.result._rev });
    assert.deepEqual(trash._.result, { id: item.id, trashed: true });
    assert.deepEqual(refreshed(trash, 'listContent')[0].v.items, []);
    assert.deepEqual(refreshed(trash, 'getContent')[0].e, [404, { message: 'not-found', code: 'NOT_FOUND' }]);
    await harness.restart();
    const retained = (await sql<{ deleted_at: string; headline: string }>`SELECT deleted_at, headline FROM ec_notes WHERE id = ${item.id}`.execute(harness.database.db)).rows[0];
    assert.ok(retained.deleted_at);
    assert.equal(retained.headline, 'Edited note');
    assert.equal((await harness.remote('getContent', 'author', undefined, { collection: 'notes', id: item.id })).status, 404);
  });
  it('a stale revision rejects both update and trash without changing any persisted values', async () => {
    const { item } = await create();
    const updated = await harness.mutate('updateContent', { collection: 'notes', id: item.id, _rev: item._rev, ...fields({ headline: 'Winner' }) });
    const before = (await sql`SELECT * FROM ec_notes WHERE id = ${item.id}`.execute(harness.database.db)).rows;
    for (const name of ['updateContent', 'deleteContent']) {
      const result = await harness.remote(name, 'author', { collection: 'notes', id: item.id, _rev: item._rev });
      assert.deepEqual(result, { type: 'error', status: 409, error: { message: 'conflict', code: 'CONFLICT' } });
    }
    assert.deepEqual((await sql`SELECT * FROM ec_notes WHERE id = ${item.id}`.execute(harness.database.db)).rows, before);
    const read = await harness.query('getContent', { collection: 'notes', id: item.id });
    assert.equal(read.data.headline, 'Winner');
    assert.equal(read._rev, updated._.result._rev);
  });
  it('own/any mutation policy denies another owner and a read-only session without side effects', async () => {
    const { item } = await create();
    for (const session of ['other', 'reader', null]) for (const name of ['updateContent', 'deleteContent']) {
      const denied = await harness.remote(name, session, { collection: 'notes', id: item.id, _rev: item._rev });
      assert.equal(denied.type, 'error');
      assert.equal(denied.status, session ? 403 : 401);
    }
    assert.deepEqual(await harness.query('getContent', { collection: 'notes', id: item.id }), item);
    const updated = await harness.mutate('updateContent', { collection: 'notes', id: item.id, _rev: item._rev, ...fields({ headline: 'Editor override' }) }, 'editor');
    assert.equal((await harness.query('getContent', { collection: 'notes', id: item.id })).data.headline, 'Editor override');
    await harness.mutate('deleteContent', { collection: 'notes', id: item.id, _rev: updated._.result._rev }, 'editor');
  });
  it('write-only mutations remain successful while refreshed queries deny reads and expose no data', async () => {
    const { item } = await create();
    const { output } = await create('writer');
    const update = await harness.mutate('updateContent', { collection: 'notes', id: item.id, _rev: item._rev, ...fields({ headline: 'Writer edit' }) }, 'writer');
    const trash = await harness.mutate('deleteContent', { collection: 'notes', id: item.id, _rev: update._.result._rev }, 'writer');
    for (const data of [output, update]) assert.equal(Object.hasOwn(data._.result, 'data'), false);
    for (const data of [output, update, trash]) for (const value of Object.values(data.q) as any[]) {
      assert.deepEqual(value.e, [403, { message: 'forbidden', code: 'INSUFFICIENT_PERMISSIONS' }]);
      assert.equal(Object.hasOwn(value, 'v'), false);
    }
    assert.ok((await sql<{ deleted_at: string }>`SELECT deleted_at FROM ec_notes WHERE id = ${item.id}`.execute(harness.database.db)).rows[0].deleted_at);
  });
  it('database-defined validation and caller-claim rejection leave storage unchanged', async () => {
    for (const input of [
      { collection: 'notes' },
      { collection: 'notes', ...fields({ headline: '' }) },
      { collection: 'notes', ...fields({ headline: 'x'.repeat(101) }) },
      { collection: 'notes', ...fields({ headline: 'Valid', unknown: 'bad' }) }
    ]) {
      const result = await harness.remote('createContent', 'author', input);
      assert.equal(result.type, 'error'); assert.equal(result.status, 400); assert.equal(result.error.code, 'VALIDATION_ERROR');
      const issues = result.error.details.issues;
      assert.ok(issues.length > 0);
      assert.equal(result.error.message, issues.map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`).join('; '));
    }
    for (const claim of ['principal', 'permissions', 'authorId', 'createdAt', 'publishedAt', 'status', 'expected']) {
      const result = await harness.remote('createContent', 'author', { collection: 'notes', ...fields({ headline: 'Valid' }), [claim]: 'admin' });
      assert.equal(result.type, 'result');
      assert.ok(parse(result.data)._.issues.length);
      assert.equal(parse(result.data)._.result, undefined);
    }
    assert.equal((await harness.repository.list('notes')).items.length, 0);
  });
  it('revision tokens reject malformed and cross-collection, cross-entry or cross-locale reuse', async () => {
    const { item } = await create();
    const { item: other } = await create();
    for (const extra of [{ id: other.id }, { collection: 'post' }, { locale: 'fr' }, { _rev: 'malformed' }] as Record<string, string>[]) {
      const result = await harness.remote('updateContent', 'author', { collection: 'notes', id: item.id, _rev: item._rev, ...extra });
      assert.equal(result.status, 400);
      assert.equal(result.error.code, 'VALIDATION_ERROR');
    }
    assert.deepEqual(await harness.query('getContent', { collection: 'notes', id: item.id }), item);
  });
  it('qualified summaries are capped, body-free, ordered and collection/locale scoped', async () => {
    await harness.registry.createCollection({ slug: 'long_titles', label: 'Long titles' });
    await harness.registry.createField('long_titles', { slug: 'title', label: 'Title', type: 'text' });
    for (let index = 0; index < 105; index++) await harness.repository.create({ type: 'long_titles', data: { title: 'x'.repeat(1000) } }, 'user_author');
    const list = await harness.query('listContent', { collection: 'long_titles', limit: 1000 });
    assert.equal(list.items.length, 100);
    assert.ok(list.nextCursor);
    assert.ok(list.items.every((item: any) => item.title.length === 200 && !Object.hasOwn(item, 'data') && item._rev));
    for (let index = 1; index < list.items.length; index++) assert.ok(list.items[index - 1].createdAt >= list.items[index].createdAt);
    const next = await harness.query('listContent', { collection: 'long_titles', cursor: list.nextCursor });
    assert.equal(next.items.length, 5);
    assert.equal(next.nextCursor, undefined);
    assert.ok(next.items.every((item: any) => !list.items.some((previous: any) => item.id === previous.id)));
    assert.deepEqual((await harness.query('listContent', { collection: 'page' })).items, []);
    assert.deepEqual((await harness.query('listContent', { collection: 'long_titles', locale: 'fr' })).items, []);
  });
  it('requested paginated/detail refreshes retain native client cache keys and enforce a bound', async () => {
    const { item } = await create();
    const args = [{ collection: 'notes', limit: 1 }, { collection: 'notes', locale: 'en', limit: 2 }];
    const listKeys: string[] = [];
    for (const argument of args) {
      const envelope = await harness.remote('listContent', 'author', undefined, argument);
      listKeys.push(Object.keys(parse(envelope.data).q)[0]);
    }
    const detailEnvelope = await harness.remote('getContent', 'author', undefined, { collection: 'notes', id: item.id });
    const detailKey = Object.keys(parse(detailEnvelope.data).q)[0];
    const output = await harness.mutateWithRefreshes('updateContent', {
      collection: 'notes', id: item.id, _rev: item._rev, data: { headline: 'Refreshed note' }
    }, [...listKeys, detailKey]);
    assert.equal(output._.issues, undefined);
    for (const key of listKeys) {
      assert.equal(output.q[key].e, undefined);
      assert.equal(output.q[key].v.items[0].id, item.id);
    }
    assert.equal(output.q[detailKey].v.data.headline, 'Refreshed note');
    const boundedKeys: string[] = [];
    for (let limit = 1; limit <= 7; limit++) {
      const envelope = await harness.remote('listContent', 'author', undefined, { collection: 'notes', limit });
      boundedKeys.push(Object.keys(parse(envelope.data).q)[0]);
    }
    const next = await harness.mutateWithRefreshes('updateContent', {
      collection: 'notes', id: item.id, _rev: output._.result._rev, data: { headline: 'Bounded refresh' }
    }, boundedKeys);
    for (const key of boundedKeys.slice(0, 5)) assert.equal(next.q[key].v.items[0].id, item.id);
    for (const key of boundedKeys.slice(5)) assert.equal(next.q[key].e[0], 400);
  });
  it('requested refreshes exclude other collections, locales and entry identities', async () => {
    const { item } = await create();
    const { item: other } = await create();
    const page = await harness.repository.create({ type: 'page', data: { title: 'Other collection' } }, 'user_author');
    const french = await harness.repository.create({ type: 'notes', locale: 'fr', data: { headline: 'Other locale' } }, 'user_author');
    const requested: { name: string; argument: unknown; included: boolean }[] = [
      { name: 'listContent', argument: { collection: 'notes', limit: 3 }, included: true },
      { name: 'listContent', argument: { collection: 'page', limit: 3 }, included: false },
      { name: 'listContent', argument: { collection: 'notes', locale: 'fr', limit: 3 }, included: false },
      { name: 'getContent', argument: { collection: 'notes', id: item.id }, included: true },
      { name: 'getContent', argument: { collection: 'notes', id: other.id }, included: false },
      { name: 'getContent', argument: { collection: 'page', id: page.id }, included: false },
      { name: 'getContent', argument: { collection: 'notes', locale: 'fr', id: french.id }, included: false }
    ];
    const keys: string[] = [];
    for (const { name, argument } of requested) {
      const envelope = await harness.remote(name, 'author', undefined, argument);
      keys.push(Object.keys(parse(envelope.data).q)[0]);
    }
    const output = await harness.mutateWithRefreshes('updateContent', {
      collection: 'notes', id: item.id, _rev: item._rev, data: { headline: 'Scoped refresh' }
    }, keys);
    assert.equal(output._.issues, undefined);
    assert.ok(output._.result._rev);
    for (const [index, { included }] of requested.entries()) assert.equal(Object.hasOwn(output.q, keys[index]), included);
    const refreshedSummary = output.q[keys[0]].v.items.find((entry: any) => entry.id === item.id);
    assert.equal(refreshedSummary._rev, output._.result._rev);
    assert.notEqual(refreshedSummary._rev, item._rev);
    assert.equal(output.q[keys[3]].v.data.headline, 'Scoped refresh');
    assert.equal((await harness.query('getContent', { collection: 'notes', id: other.id })).data.headline, 'First note');
  });
  it('duplicate slugs conflict while scalar unique remains unenforced metadata', async () => {
    await harness.registry.createCollection({ slug: 'unique_notes', label: 'Unique notes' });
    await harness.registry.createField('unique_notes', { slug: 'code', label: 'Code', type: 'string', unique: true });
    await harness.mutate('createContent', { collection: 'unique_notes', slug: 'taken', 'data.code': 'unique' });
    const conflict = await harness.remote('createContent', 'author', { collection: 'unique_notes', slug: 'taken', 'data.code': 'other' });
    assert.equal(conflict.status, 409); assert.equal(conflict.error.code, 'CONFLICT');
    const duplicate = await harness.mutate('createContent', { collection: 'unique_notes', slug: 'other', 'data.code': 'unique' });
    const stored = await harness.query('getContent', { collection: 'unique_notes', id: duplicate._.result.id }, 'editor');
    assert.equal(stored.data.code, 'unique');
    assert.equal((await harness.registry.getField('unique_notes', 'code'))!.unique, true);
    assert.equal((await harness.repository.list('unique_notes')).items.length, 2);
  });
  it('JSON form data preserves schema fields that collide with nested form guards and nullable values', async () => {
    await harness.registry.createCollection({ slug: 'special_fields', label: 'Special fields' });
    for (const slug of ['constructor', 'prototype']) await harness.registry.createField('special_fields', { slug, label: slug, type: 'string', required: true });
    await harness.registry.createField('special_fields', { slug: 'optional', label: 'Optional', type: 'text' });
    const created = await harness.mutate('createContent', { collection: 'special_fields', data: JSON.stringify({ constructor: 'Constructor value', prototype: 'Prototype value', optional: null }) });
    const item = await harness.query('getContent', { collection: 'special_fields', id: created._.result.id });
    assert.deepEqual(item.data, { constructor: 'Constructor value', prototype: 'Prototype value', optional: null });
    // Preserve the immutable source validator's partial constructor omission behavior (issue #35).
    const updated = await harness.mutate('updateContent', { collection: 'special_fields', id: item.id, _rev: item._rev, data: JSON.stringify({ constructor: 'Constructor value', prototype: 'New value' }) });
    const read = await harness.query('getContent', { collection: 'special_fields', id: updated._.result.id });
    assert.deepEqual(read.data, { constructor: 'Constructor value', prototype: 'New value', optional: null });
  });
  it('dynamic routes render persisted fields and retain disabled writes with authenticated reads', async () => {
    const { item } = await create();
    harness.setMutationsEnabled(false);
    const index = await harness.request('/', 'author');
    const links = (html: string, path: string) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
      .map(([, href]) => new URL(href.replaceAll('&amp;', '&'), `http://cms.test${path}`).pathname);
    assert.ok(links(await index.text(), '/').includes('/content/notes'));
    for (const path of ['/content/notes', `/content/notes/${item.id}`]) {
      const response = await harness.request(path, 'author');
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Headline/);
      assert.match(html, /data-field="headline"/);
      assert.match(html, /data-field="detail"/);
      assert.match(html, /<fieldset disabled(?:[\s=>])/);
      assert.doesNotMatch(html, /name="(?:title|body)"/);
      const destinations = links(html, path);
      assert.ok(destinations.includes('/'), 'workspace link resolves to collections');
      if (path === '/content/notes') {
        assert.ok(destinations.includes(`/content/notes/${item.id}`), 'draft link resolves to its qualified detail route');
      } else {
        assert.ok(destinations.includes('/content/notes'), 'detail link resolves to its collection route');
      }
    }
  });
  it('detail previews preserve persisted nulls instead of substituting schema defaults', async () => {
    await harness.registry.createCollection({ slug: 'default_fields', label: 'Default fields' });
    for (const type of ['string', 'text'] as const) {
      await harness.registry.createField('default_fields', { slug: type, label: type, type, defaultValue: 'Schema default' });
    }
    const created = await harness.mutate('createContent', {
      collection: 'default_fields', data: JSON.stringify({ string: null, text: null })
    }, 'editor');
    const item = await harness.query('getContent', { collection: 'default_fields', id: created._.result.id }, 'editor');
    assert.deepEqual(item.data, { string: null, text: null });
    harness.setMutationsEnabled(false);
    const response = await harness.request(`/content/default_fields/${item.id}`, 'editor');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<input\b[^>]*data-field="string"[^>]*value=""/);
    assert.match(html, /<textarea\b[^>]*data-field="text"[^>]*><\/textarea>/);
    assert.match(html, /<fieldset disabled(?:[\s=>])/);
    await harness.restart();
    assert.deepEqual((await harness.query('getContent', { collection: 'default_fields', id: item.id }, 'editor')).data, item.data);
  });
});
