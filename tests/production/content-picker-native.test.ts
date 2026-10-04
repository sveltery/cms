import assert from 'node:assert/strict';
import { test } from 'node:test';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';

// Original ordinary built-server HTTP requirements. One existing authorized
// principal is used throughout; this adds no authentication/session probes.
test('registered picker HTTP lists all collections and real full content across locales', async () => {
  const fixture = await persistedRemotes();
  try {
    await fixture.registry.createCollection({ slug: 'people', label: 'People', routable: false });
    await fixture.registry.createField('people', { slug: 'full_name', label: 'Full name', type: 'string' });
    const definition = (await fixture.registry.getCollection('people'))!;
    await fixture.registry.updateCollection('people', { titleField: 'full_name' }, { version: definition.version, updatedAt: definition.updatedAt });
    for (const locale of ['en', 'fr']) await fixture.mutate('createContent', { collection: 'people', locale, slug: `person-${locale}`, 'data.full_name': `${locale} Person` });
    const collections = await fixture.request('/api/content-picker/collections', 'author');
    assert.equal(collections.status, 200); assert.equal(collections.headers.get('cache-control'), 'private, no-store');
    assert.ok((await collections.json()).data.items.some((item: any) => item.slug === 'people'));
    const manifest = await fixture.request('/api/content-picker/manifest', 'author'); assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).data.collections.people.titleField, 'full_name');
    const list = await fixture.request('/api/content-picker/content/people?limit=50', 'author'); assert.equal(list.status, 200);
    const data = (await list.json()).data;
    assert.deepEqual(data.items.map((item: any) => item.locale).sort(), ['en', 'fr']);
    assert.deepEqual(data.items.map((item: any) => item.data.full_name).sort(), ['en Person', 'fr Person']);
  } finally { await fixture.close(); }
});
test('registered picker HTTP searches deeper content and preserves cursor accumulation', async () => {
  const fixture = await persistedRemotes();
  try {
    for (let index = 0; index < 55; index++) await fixture.mutate('createContent', { collection: 'post', slug: `ordinary-${index}`, 'data.title': `Ordinary ${index}` });
    await fixture.mutate('createContent', { collection: 'post', slug: 'needle', 'data.title': '50% Needle' });
    const first = await fixture.request('/api/content-picker/content/post?limit=50', 'author'); assert.equal(first.status, 200);
    const page = (await first.json()).data; assert.equal(page.items.length, 50); assert.equal(typeof page.nextCursor, 'string');
    const second = await fixture.request(`/api/content-picker/content/post?limit=50&cursor=${encodeURIComponent(page.nextCursor)}`, 'author'); assert.equal(second.status, 200);
    const rest = (await second.json()).data; assert.equal(rest.items.length, 6);
    assert.equal(new Set([...page.items, ...rest.items].map((item: any) => item.id)).size, 56);
    const searched = await fixture.request('/api/content-picker/content/post?limit=50&q=50%25', 'author'); assert.equal(searched.status, 200);
    const matches = (await searched.json()).data; assert.equal(matches.total, 1); assert.equal(matches.items[0].data.title, '50% Needle');
  } finally { await fixture.close(); }
});
