import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { sql } from 'kysely';
import { persistedRemotes, sessions } from '../helpers/persisted-remotes.ts';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Supplemental native Kit transport requirements; no new upstream assertion credit.
const denial = (result: any, status: number, code: string) => {
  assert.deepEqual(result, { type: 'error', status, error: {
    message: code === 'INSUFFICIENT_PERMISSIONS' ? 'forbidden' : code.toLowerCase().replaceAll('_', '-'), code
  } });
};
const refreshes = (data: any, name: string) => Object.entries(data.q ?? {}).filter(([key]) => key.includes(`/${name}/`));

describe('registered trash queries and restore forms on persisted built Kit Server', () => {
  let h: Awaited<ReturnType<typeof persistedRemotes>>;
  beforeEach(async () => { h = await persistedRemotes(); });
  afterEach(async () => { await h.close(); });
  async function trashed(locale = 'en', session = 'author') {
    const create = await h.mutate('createContent', { collection: 'notes', locale, data: JSON.stringify({ headline: `Retained ${locale}`, detail: 'Private retained body' }) }, session);
    const receipt = create._.result;
    const output = await h.mutate('deleteContent', { collection: 'notes', locale, id: receipt.id, _rev: receipt._rev }, session);
    const item = await h.query('getTrashedContent', { collection: 'notes', id: receipt.id });
    return { item, output };
  }
  const input = (item: any) => ({ collection: item.type, id: item.id, locale: item.locale, _rev: item._rev });
  async function snapshot() { return (await sql`SELECT * FROM ec_notes ORDER BY id`.execute(h.database.db)).rows; }
  async function cacheKey(name: string, argument: unknown) {
    const envelope = await h.remote(name, 'author', undefined, argument);
    assert.equal(envelope.type, 'result');
    return Object.keys(parse(envelope.data).q)[0];
  }
  it('trash omission spans locales, exact locale filters, and active queries stay separate', async () => {
    const en = await trashed(); const fr = await trashed('fr'); const de = await trashed('de');
    const all = await h.query('listTrashedContent', { collection: 'notes' });
    assert.deepEqual(new Set(all.items.map((item: any) => item.id)), new Set([en.item.id, fr.item.id, de.item.id]));
    assert.deepEqual((await h.query('listTrashedContent', { collection: 'notes', locale: 'fr' })).items.map((item: any) => item.id), [fr.item.id]);
    assert.equal((await h.query('getTrashedContent', { collection: 'notes', id: de.item.id })).locale, 'de');
    denial(await h.remote('getTrashedContent', 'author', undefined, { collection: 'notes', id: fr.item.id, locale: 'en' }), 404, 'NOT_FOUND');
    assert.deepEqual((await h.query('listContent', { collection: 'notes' })).items, []);
    denial(await h.remote('getContent', 'author', undefined, { collection: 'notes', id: en.item.id }), 404, 'NOT_FOUND');
    assert.deepEqual((await h.query('listTrashedContent', { collection: 'page' })).items, []);
  });
  it('trash summaries preserve default50/cap100, deletion ordering and bounded data-free tokens', async () => {
    await h.registry.createCollection({ slug: 'long_trash', label: 'Trash' });
    await h.registry.createField('long_trash', { slug: 'title', label: 'Title', type: 'text' });
    for (let index = 0; index < 105; index++) {
      const item = await h.repository.create({ type: 'long_trash', data: { title: 'x'.repeat(1000) }, locale: index % 2 ? 'fr' : 'en' }, 'user_author');
      await h.repository.delete({ type: 'long_trash', id: item.id, locale: item.locale, expected: { version: item.version, updatedAt: item.updatedAt } });
    }
    const all = await h.query('listTrashedContent', { collection: 'long_trash', limit: 1000 });
    assert.equal(all.items.length, 100);
    assert.equal((await h.query('listTrashedContent', { collection: 'long_trash' })).items.length, 50);
    assert.equal(Object.hasOwn(all, 'nextCursor'), false);
    for (const item of all.items) {
      assert.equal(item.title.length, 200); assert.equal(Object.hasOwn(item, 'data'), false);
      assert.equal(Object.hasOwn(item, 'version'), false); assert.ok(item._rev.length <= 2048); assert.ok(item.deletedAt);
    }
    for (let index = 1; index < all.items.length; index++) {
      const previous = all.items[index - 1], current = all.items[index];
      assert.ok(previous.deletedAt > current.deletedAt || previous.deletedAt === current.deletedAt && previous.id > current.id);
    }
  });
  it('restore retains values, advances tokens, refreshes active/trash results and survives restart', async () => {
    const { item, output } = await trashed();
    assert.deepEqual(output._.result, { id: item.id, trashed: true });
    for (const [, value] of refreshes(output, 'getTrashedContent')) assert.deepEqual((value as any).v, item);
    const restored = await h.mutate('restoreContent', input(item));
    assert.deepEqual(Object.keys(restored._.result).sort(), ['_rev', 'id', 'locale', 'type']);
    assert.notEqual(restored._.result._rev, item._rev);
    const active = await h.query('getContent', { collection: 'notes', id: item.id });
    assert.deepEqual(active.data, item.data); assert.equal(active.authorId, item.authorId);
    assert.equal(active.createdAt, item.createdAt); assert.ok(active.updatedAt > item.updatedAt);
    assert.equal(Object.hasOwn(active, 'deletedAt'), false); assert.equal(active._rev, restored._.result._rev);
    for (const [, value] of refreshes(restored, 'getContent')) assert.deepEqual((value as any).v, active);
    for (const [, value] of refreshes(restored, 'listTrashedContent')) assert.deepEqual((value as any).v.items, []);
    for (const [, value] of refreshes(restored, 'getTrashedContent')) assert.deepEqual((value as any).e, [404, { message: 'not-found', code: 'NOT_FOUND' }]);
    await h.restart(); assert.deepEqual(await h.query('getContent', { collection: 'notes', id: item.id }), active);
    const deleted = await h.mutate('deleteContent', { ...input(item), _rev: active._rev });
    assert.equal(deleted._.result.trashed, true);
  });
  it('restore defaults to en while a foreign-locale trash token requires its returned locale', async () => {
    const en = (await trashed()).item, fr = (await trashed('fr')).item;
    denial(await h.remote('restoreContent', 'author', { collection: 'notes', id: fr.id, _rev: fr._rev }), 400, 'VALIDATION_ERROR');
    const restored = await h.mutate('restoreContent', { collection: 'notes', id: en.id, _rev: en._rev });
    assert.equal(restored._.result.locale, 'en');
    assert.equal((await h.mutate('restoreContent', input(fr)))._.result.locale, 'fr');
  });
  it('stale, concurrent and double restores conflict without extra writes', async () => {
    const item = (await trashed()).item;
    const oldToken = JSON.parse(Buffer.from(item._rev, 'base64url').toString()); oldToken.expected.version--;
    denial(await h.remote('restoreContent', 'author', { ...input(item), _rev: Buffer.from(JSON.stringify(oldToken)).toString('base64url') }), 409, 'CONFLICT');
    const results = await Promise.all([h.remote('restoreContent', 'author', input(item)), h.remote('restoreContent', 'author', input(item))]);
    assert.equal(results.filter(result => result.type === 'result').length, 1);
    denial(results.find(result => result.type === 'error'), 409, 'CONFLICT');
    const before = await snapshot();
    denial(await h.remote('restoreContent', 'author', input(item)), 409, 'CONFLICT');
    assert.deepEqual(await snapshot(), before);
  });
  it('malformed/context tokens, caller claims and unsupported trash options perform zero writes', async () => {
    const item = (await trashed()).item, other = (await trashed()).item;
    const before = await snapshot();
    for (const extra of [{ _rev: 'malformed' }, { id: other.id }, { collection: 'post' }, { locale: 'fr' }]) {
      denial(await h.remote('restoreContent', 'author', { ...input(item), ...extra }), 400, 'VALIDATION_ERROR');
    }
    for (const extra of [{ _rev: '' }, { _rev: '!' }, { _rev: 'x'.repeat(2049) }, { id: 'x'.repeat(129) }, { principal: 'admin' }, { authorId: 'user_author' }, { expected: '{}' }, { data: '{}' }] as Record<string, string>[]) {
      const result = await h.remote('restoreContent', 'author', { ...input(item), ...extra });
      assert.equal(result.type, 'result'); const data = parse(result.data);
      assert.ok(data._.issues.length); assert.equal(data._.result, undefined);
    }
    for (const extra of [{ limit: 0 }, { limit: 1.5 }, { limit: Number.MAX_SAFE_INTEGER + 1 }, { cursor: 'cursor' }, { count: true }, { orderBy: 'id' }, { locale: '' }]) {
      const result = await h.remote('listTrashedContent', 'author', undefined, { collection: 'notes', ...extra });
      assert.equal(result.type, 'error'); assert.equal(result.status, 400);
    }
    assert.deepEqual(await snapshot(), before);
  });
  it('service authorization precedes semantic token validation and persisted owner precedes CAS', async () => {
    const item = (await trashed()).item;
    sessions.deleteOnly = { id: 'user_author', permissions: ['content:read', 'content:read_drafts', 'content:delete_any'] };
    sessions.noDraftRead = { id: 'user_subscriber', permissions: ['content:read'] };
    try {
      for (const session of [null, 'reader', 'deleteOnly']) {
        denial(await h.remote('restoreContent', session, { ...input(item), _rev: 'malformed' }), session ? 403 : 401, session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED');
      }
      for (const name of ['getTrashedContent', 'listTrashedContent']) for (const session of [null, 'writer', 'noDraftRead']) {
        denial(await h.remote(name, session, undefined, name === 'getTrashedContent' ? { collection: 'notes', id: item.id } : { collection: 'notes' }), session ? 403 : 401, session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED');
      }
      denial(await h.remote('restoreContent', 'other', input(item)), 403, 'INSUFFICIENT_PERMISSIONS');
      await sql`UPDATE ec_notes SET author_id = NULL WHERE id = ${item.id}`.execute(h.database.db);
      denial(await h.remote('restoreContent', 'author', input(item)), 403, 'INSUFFICIENT_PERMISSIONS');
      await h.mutate('restoreContent', input(item), 'editor');
      denial(await h.remote('restoreContent', 'author', input(item)), 403, 'INSUFFICIENT_PERMISSIONS');
      denial(await h.remote('restoreContent', 'editor', input(item)), 409, 'CONFLICT');
      denial(await h.remote('restoreContent', 'editor', { ...input(item), id: 'missing', _rev: Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(item._rev, 'base64url').toString()), id: 'missing' })).toString('base64url') }), 404, 'NOT_FOUND');
    } finally { delete sessions.deleteOnly; delete sessions.noDraftRead; }
  });
  it('denied read/edit permissions avoid every storage query, including malformed semantic tokens', async () => {
    const item = (await trashed()).item;
    const database = h.database;
    const descriptor = Object.getOwnPropertyDescriptor(database, 'db')!;
    let reads = 0;
    Object.defineProperty(database, 'db', { configurable: true, get() { reads++; throw new Error('unexpected transport storage access'); } });
    try {
      for (const name of ['getTrashedContent', 'listTrashedContent']) {
        denial(await h.remote(name, 'writer', undefined, name === 'getTrashedContent' ? { collection: 'notes', id: item.id } : { collection: 'notes' }), 403, 'INSUFFICIENT_PERMISSIONS');
      }
      denial(await h.remote('restoreContent', 'reader', { ...input(item), _rev: 'malformed' }), 403, 'INSUFFICIENT_PERMISSIONS');
      assert.equal(reads, 0);
    } finally { Object.defineProperty(database, 'db', descriptor); }
  });
  it('default-locale active aliases and explicit original keys receive the restored token', async () => {
    const item = (await trashed()).item;
    const list = await cacheKey('listContent', { collection: 'notes', limit: 1 });
    const explicit = await cacheKey('listContent', { collection: 'notes', locale: 'en', limit: 2 });
    const omittedDetail = `${h.ids.get('getContent')}/${Buffer.from(stringify({ collection: 'notes', id: item.id })).toString('base64url')}`;
    const explicitDetail = `${h.ids.get('getContent')}/${Buffer.from(stringify({ collection: 'notes', id: item.id, locale: 'en' })).toString('base64url')}`;
    const restored = await h.mutateWithRefreshes('restoreContent', input(item), [list, explicit, omittedDetail, explicitDetail]);
    for (const key of [list, explicit]) assert.equal(restored.q[key].v.items[0]._rev, restored._.result._rev);
    for (const key of [omittedDetail, explicitDetail]) assert.equal(restored.q[key].v._rev, restored._.result._rev);
  });
  it('write-only restore receipts stay successful and all refreshed read errors remain separate', async () => {
    const item = (await trashed()).item;
    const restored = await h.mutate('restoreContent', input(item), 'writer');
    assert.deepEqual(Object.keys(restored._.result).sort(), ['_rev', 'id', 'locale', 'type']);
    assert.notEqual(restored._.result._rev, item._rev);
    for (const value of Object.values(restored.q) as any[]) {
      assert.deepEqual(value.e, [403, { message: 'forbidden', code: 'INSUFFICIENT_PERMISSIONS' }]); assert.equal(Object.hasOwn(value, 'v'), false);
    }
    assert.equal((await h.query('getContent', { collection: 'notes', id: item.id }))._rev, restored._.result._rev);
  });
  it('deletion/restoration refresh original default, paginated and all-locale native cache keys only in scope', async () => {
    const item = (await trashed('fr')).item;
    const all = await cacheKey('listTrashedContent', { collection: 'notes', limit: 2 });
    const french = await cacheKey('listTrashedContent', { collection: 'notes', locale: 'fr', limit: 2 });
    const english = await cacheKey('listTrashedContent', { collection: 'notes', locale: 'en', limit: 2 });
    const elsewhere = await cacheKey('listTrashedContent', { collection: 'page', limit: 2 });
    const omittedDetail = await cacheKey('getTrashedContent', { collection: 'notes', id: item.id });
    const frenchDetail = await cacheKey('getTrashedContent', { collection: 'notes', id: item.id, locale: 'fr' });
    const activeFrench = await cacheKey('listContent', { collection: 'notes', locale: 'fr', limit: 2 });
    const activeDefault = await cacheKey('listContent', { collection: 'notes', limit: 2 });
    const keys = [all, french, english, elsewhere, omittedDetail, frenchDetail, activeFrench, activeDefault];
    const restored = await h.mutateWithRefreshes('restoreContent', input(item), keys);
    for (const key of [all, french]) assert.deepEqual(restored.q[key].v.items, []);
    for (const key of [omittedDetail, frenchDetail]) assert.equal(restored.q[key].e[0], 404);
    assert.equal(restored.q[activeFrench].v.items[0].id, item.id);
    for (const key of [english, elsewhere, activeDefault]) assert.equal(Object.hasOwn(restored.q, key), false);
    const deleted = await h.mutateWithRefreshes('deleteContent', { ...input(item), _rev: restored._.result._rev }, keys);
    for (const key of [all, french]) assert.equal(deleted.q[key].v.items[0]._rev, deleted.q[omittedDetail].v._rev);
    assert.equal(deleted.q[frenchDetail].v.id, item.id); assert.deepEqual(deleted.q[activeFrench].v.items, []);
    for (const key of [english, elsewhere, activeDefault]) assert.equal(Object.hasOwn(deleted.q, key), false);
  });
  it('requested trash lists/details keep five-instance limits, invalid-query errors and exact original keys', async () => {
    const item = (await trashed()).item;
    const listKeys = await Promise.all(Array.from({ length: 7 }, (_, index) => cacheKey('listTrashedContent', { collection: 'notes', limit: index + 1 })));
    const invalid = `${h.ids.get('listTrashedContent')}/${Buffer.from(stringify({ collection: 'notes', cursor: 'unsupported' })).toString('base64url')}`;
    const bad = await h.mutateWithRefreshes('restoreContent', { ...input(item), _rev: item._rev }, [invalid]);
    assert.equal(bad.q[invalid].e[0], 400);
    assert.ok(bad._.result._rev);
    const again = (await h.mutate('deleteContent', { ...input(item), _rev: bad._.result._rev }))._.result;
    assert.equal(again.trashed, true);
    const retained = await h.query('getTrashedContent', { collection: 'notes', id: item.id });
    const output = await h.mutateWithRefreshes('restoreContent', input(retained), listKeys);
    for (const key of listKeys.slice(0, 5)) assert.deepEqual(output.q[key].v.items, []);
    for (const key of listKeys.slice(5)) assert.equal(output.q[key].e[0], 400);
    const second = (await trashed()).item;
    const detailArguments = [second, ...(await Promise.all(Array.from({ length: 6 }, () => trashed()))).map(value => value.item)];
    const distinctDetails = await Promise.all(detailArguments.map(value => cacheKey('getTrashedContent', { collection: 'notes', id: value.id })));
    const next = await h.mutateWithRefreshes('restoreContent', input(second), distinctDetails);
    assert.equal(next.q[distinctDetails[0]].e[0], 404);
    for (const key of distinctDetails.slice(1, 5)) assert.equal(Object.hasOwn(next.q, key), false);
    for (const key of distinctDetails.slice(5)) assert.equal(next.q[key].e[0], 400);
  });
  it('restore preserves production origin protection and default mutation-disable guard', async () => {
    const item = (await trashed()).item;
    const before = await snapshot();
    for (const origin of [undefined, 'null', 'https://attacker.invalid']) {
      const response = await h.request(`/_app/remote/${h.ids.get('restoreContent')}`, 'author', {
        method: 'POST', headers: origin ? { origin } : {}, body: new URLSearchParams(input(item))
      });
      assert.equal(response.status, 403);
    }
    assert.deepEqual(await snapshot(), before);
    await h.close(); h = await persistedRemotes({ persistedSessions: true });
    const stored = await h.repository.create({ type: 'notes', data: { headline: 'Gate' } }, 'user_author');
    await h.repository.delete({ type: 'notes', id: stored.id, expected: { version: stored.version, updatedAt: stored.updatedAt } });
    const retained = await h.query('getTrashedContent', { collection: 'notes', id: stored.id });
    const denied = await h.remote('restoreContent', 'author', input(retained));
    assert.equal(denied.type, 'error'); assert.equal(denied.status, 503); assert.equal(denied.error.code, 'MUTATIONS_DISABLED');
    assert.equal((await h.query('getTrashedContent', { collection: 'notes', id: stored.id }))._rev, retained._rev);
  });
});

it('registered built Kit trash and restore use actual local D1 storage with persisted sessions', { timeout: 60_000 }, async () => {
  const h = await schemaAdminRemotes('D1');
  try {
    await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
    await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
    const created = (await h.mutate('createContent', { collection: 'notes', locale: 'fr', data: '{"title":"D1 retained"}' }, 'author'))._.result;
    await h.mutate('deleteContent', { collection: 'notes', id: created.id, locale: 'fr', _rev: created._rev }, 'author');
    const retained = await h.query('getTrashedContent', { collection: 'notes', id: created.id }, 'author');
    assert.equal((await h.query('listTrashedContent', { collection: 'notes' }, 'author')).items[0].locale, 'fr');
    const input = { collection: 'notes', id: created.id, locale: 'fr', _rev: retained._rev };
    const restored = (await h.mutate('restoreContent', input, 'author'))._.result;
    assert.notEqual(restored._rev, retained._rev); denial(await h.remote('restoreContent', 'author', input), 409, 'CONFLICT');
    await h.restart();
    const active = await h.query('getContent', { collection: 'notes', id: created.id, locale: 'fr' }, 'author');
    assert.deepEqual(active.data, { title: 'D1 retained' }); assert.equal(active._rev, restored._rev);
  } finally { await h.close(); }
});
