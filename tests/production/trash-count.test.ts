import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';

// Supplemental native Kit query/refresh requirements, not complete upstream declarations.
const argumentKey = (ids: Map<string, string>, argument: unknown) =>
  `${ids.get('countTrashedContent')}/${Buffer.from(stringify(argument)).toString('base64url')}`;

for (const target of ['Node', 'D1'] as const) describe(`registered trash count HTTP query on ${target}`, () => {
  let h: Awaited<ReturnType<typeof schemaAdminRemotes>>;
  beforeEach(async () => {
    h = await schemaAdminRemotes(target);
    for (const slug of ['notes', 'page']) {
      await h.registry.createCollection({ slug, label: slug });
      await h.registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
    }
  });
  afterEach(async () => { await h.close(); });
  async function create(locale = 'en') {
    return (await h.mutate('createContent', { collection: 'notes', locale, data: '{"title":"Counted draft"}' }, 'author'))._.result;
  }
  const input = (item: any) => ({ collection: 'notes', id: item.id, locale: item.locale, _rev: item._rev });
  async function trash(locale = 'en') {
    const receipt = await create(locale);
    await h.mutate('deleteContent', input(receipt), 'author');
    return h.query('getTrashedContent', { collection: 'notes', id: receipt.id }, 'author');
  }
  async function mutateWithRefreshes(name: string, value: Record<string, unknown>, keys: string[]) {
    const header = new TextEncoder().encode(stringify([value, { remote_refreshes: keys }]));
    const offsets = new TextEncoder().encode('[]');
    const prefix = new Uint8Array(7);
    new DataView(prefix.buffer).setUint32(1, header.length, true);
    new DataView(prefix.buffer).setUint16(5, offsets.length, true);
    const response = await h.request(`/_app/remote/${h.ids.get(name)}`, 'author', {
      method: 'POST', headers: { origin: h.origin, 'content-type': 'application/x-sveltekit-formdata' },
      body: new Blob([prefix, header, offsets])
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const envelope = await response.json(); assert.equal(envelope.type, 'result');
    const output = parse(envelope.data); assert.equal(output._.issues, undefined); assert.equal(output._.submission, true);
    return output;
  }
  it('returns zero when empty, scopes locales, excludes active rows and survives reopen', async () => {
    assert.equal(await h.query('countTrashedContent', { collection: 'notes' }, 'author'), 0);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes', locale: 'fr' }, 'author'), 0);
    await create(); await create('fr');
    await trash(); await trash('fr'); await trash('de');
    assert.equal(await h.query('countTrashedContent', { collection: 'notes', locale: 'en' }, 'author'), 1);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes' }, 'author'), 3);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes', locale: 'es' }, 'author'), 0);
    assert.equal(await h.query('countTrashedContent', { collection: 'page' }, 'author'), 0);
    await h.restart();
    assert.equal(await h.query('countTrashedContent', { collection: 'notes' }, 'author'), 3);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes', locale: 'fr' }, 'author'), 1);
  });
  it('counts beyond default and maximum trash pagination without accepting list controls', async () => {
    const { DraftRepository } = await import('../../src/lib/server/database/entries.ts');
    const repository = new DraftRepository(h.database);
    for (let index = 0; index < 105; index++) {
      const item = await repository.create({ type: 'notes', locale: index % 2 ? 'fr' : 'en', data: { title: `Draft ${index}` } }, 'schema_author');
      await repository.delete({ type: 'notes', id: item.id, locale: item.locale, expected: { version: item.version, updatedAt: item.updatedAt } });
    }
    assert.equal((await h.query('listTrashedContent', { collection: 'notes' })).items.length, 50);
    assert.equal((await h.query('listTrashedContent', { collection: 'notes', limit: 1000 })).items.length, 100);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes' }), 105);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes', locale: 'en' }), 53);
    for (const extra of [{ limit: 1 }, { cursor: 'ignored' }, { locale: '' }]) {
      const result = await h.remote('countTrashedContent', 'author', undefined, { collection: 'notes', ...extra });
      assert.equal(result.type, 'error'); assert.equal(result.status, 400);
    }
    const missing = await h.remote('countTrashedContent', 'author', undefined, { collection: 'missing' });
    assert.equal(missing.status, 404); assert.equal(missing.error.code, 'NOT_FOUND');
  });
  it('refreshes canonical and exact original requested keys after deletion and restoration only in scope', async () => {
    const receipt = await create('fr');
    const matching = [
      { collection: 'notes' },
      { collection: 'notes', locale: undefined },
      { collection: 'notes', locale: 'fr' },
      { locale: 'fr', collection: 'notes' }
    ].map(value => argumentKey(h.ids, value));
    const english = argumentKey(h.ids, { collection: 'notes', locale: 'en' });
    const keys = [...matching, english];
    const deleted = await mutateWithRefreshes('deleteContent', input(receipt), keys);
    assert.deepEqual(deleted._.result, { id: receipt.id, trashed: true });
    for (const key of matching) assert.equal(deleted.q[key].v, 1);
    assert.equal(Object.hasOwn(deleted.q, english), false);
    const retained = await h.query('getTrashedContent', { collection: 'notes', id: receipt.id });
    const restored = await mutateWithRefreshes('restoreContent', input(retained), keys);
    assert.notEqual(restored._.result._rev, retained._rev);
    for (const key of matching) assert.equal(restored.q[key].v, 0);
    assert.equal(Object.hasOwn(restored.q, english), false);
    assert.equal(await h.query('countTrashedContent', { collection: 'notes' }), 0);
    const elsewhere = argumentKey(h.ids, { collection: 'page' });
    const again = await mutateWithRefreshes('deleteContent', input({ ...receipt, _rev: restored._.result._rev }), [elsewhere]);
    assert.equal(Object.hasOwn(again.q, elsewhere), false);
  });
  it('bounds requested counts to five while retaining canonical count refreshes and query errors', async () => {
    const item = await trash();
    const args = [{ collection: 'notes' }, { collection: 'notes', locale: undefined },
      ...['en', 'fr', 'de', 'es', 'it'].map(locale => ({ collection: 'notes', locale }))];
    const keys = args.map(value => argumentKey(h.ids, value));
    const restored = await mutateWithRefreshes('restoreContent', input(item), keys);
    for (const key of keys.slice(0, 3)) assert.equal(restored.q[key].v, 0);
    for (const key of keys.slice(3, 5)) assert.equal(Object.hasOwn(restored.q, key), false);
    for (const key of keys.slice(5)) assert.equal(restored.q[key].e[0], 400);
    const invalid = argumentKey(h.ids, { collection: 'notes', limit: 1 });
    const deleted = await mutateWithRefreshes('deleteContent', input({ ...item, _rev: restored._.result._rev }), [invalid]);
    assert.equal(deleted._.result.trashed, true); assert.equal(deleted.q[invalid].e[0], 400);
    // Server-created canonical keys include Kit's object transport reducer.
    const canonical = Object.entries(deleted.q).filter(([key, value]) =>
      key.includes('/countTrashedContent/') && Object.hasOwn(value as object, 'v'));
    assert.equal(canonical.length, 2);
    for (const [key, value] of canonical) {
      const argument = parse(Buffer.from(key.split('/').at(-1)!, 'base64url').toString(), { __skrao: value => value });
      assert.equal(argument.collection, 'notes');
      assert.ok(argument.locale === undefined || argument.locale === 'en');
      assert.equal((value as any).v, 1);
    }
    assert.deepEqual(new Set(canonical.map(([key]) => {
      const argument = parse(Buffer.from(key.split('/').at(-1)!, 'base64url').toString(), { __skrao: value => value });
      return argument.locale;
    })), new Set([undefined, 'en']));
  });
  it('denies anonymous and non-draft readers and exposes authenticated unavailable storage distinctly', async () => {
    for (const session of [null, 'subscriber']) {
      const denied = await h.remote('countTrashedContent', session, undefined, { collection: 'notes' });
      assert.equal(denied.type, 'error'); assert.equal(denied.status, session ? 403 : 401);
      assert.equal(denied.error.code, session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED');
    }
    h.probeStorage('absent');
    const unavailable = await h.remote('countTrashedContent', 'author', undefined, { collection: 'notes' });
    assert.equal(unavailable.status, 503); assert.equal(unavailable.error.code, 'NOT_CONFIGURED');
    const anonymous = await h.remote('countTrashedContent', null, undefined, { collection: 'notes' });
    assert.equal(anonymous.status, 401);
  });
});

it('write-only delete/restore receipts stay successful while count refresh errors remain independent', async () => {
  const h = await persistedRemotes();
  try {
    const receipt = (await h.mutate('createContent', { collection: 'notes', data: '{"headline":"Private"}' }))._.result;
    const input = { collection: 'notes', locale: 'en', id: receipt.id, _rev: receipt._rev };
    const keys = [{ collection: 'notes' }, { locale: 'en', collection: 'notes' }].map(value => argumentKey(h.ids, value));
    const deleted = await h.mutateWithRefreshes('deleteContent', input, keys, 'writer');
    assert.deepEqual(deleted._.result, { id: receipt.id, trashed: true });
    const item = await h.query('getTrashedContent', { collection: 'notes', id: receipt.id });
    const restored = await h.mutateWithRefreshes('restoreContent', { ...input, _rev: item._rev }, keys, 'writer');
    assert.deepEqual(Object.keys(restored._.result).sort(), ['_rev', 'id', 'locale', 'type']);
    for (const output of [deleted, restored]) for (const key of keys) {
      assert.deepEqual(output.q[key].e, [403, { message: 'forbidden', code: 'INSUFFICIENT_PERMISSIONS' }]);
      assert.equal(Object.hasOwn(output.q[key], 'v'), false);
    }
    const descriptor = Object.getOwnPropertyDescriptor(h.database, 'db')!;
    let reads = 0;
    Object.defineProperty(h.database, 'db', { configurable: true, get() { reads++; throw new Error('unexpected count storage read'); } });
    try {
      const denied = await h.remote('countTrashedContent', 'writer', undefined, { collection: 'notes' });
      assert.equal(denied.status, 403); assert.equal(reads, 0);
    } finally { Object.defineProperty(h.database, 'db', descriptor); }
  } finally { await h.close(); }
});
