import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { schemaAdminRemotes } from '../schema-admin-remotes.ts';

// Original real Node SSR host. The complete product/storage interaction and
// assertions survive outside the jsdom host's browser export conditions.
const target = process.argv[2];
assert.ok(target === 'Node' || target === 'D1');
const fixture = await schemaAdminRemotes(target, true, { output: resolve(process.cwd(), '.svelte-kit/output') });
try {
  await fixture.registry.createCollection({ slug: 'stories', label: 'Stories', supports: ['drafts', 'revisions'] });
  await fixture.registry.createField('stories', { slug: 'title', label: 'Title', type: 'string' });
  const english = await fixture.mutate('createContent', { collection: 'stories', locale: 'en', data: JSON.stringify({ title: 'English link' }) }, 'author');
  const french = await fixture.mutate('createContent', { collection: 'stories', locale: 'fr', data: JSON.stringify({ title: 'French link' }) }, 'author');
  const links = async (locale: string) => {
    const response = await fixture.request(`/content/stories?locale=${locale}`, 'author');
    assert.equal(response.status, 200);
    const html = await response.text();
    const list = /<ul\b[^>]*aria-label="Content drafts"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
    assert.ok(list, 'actual collection draft list is rendered');
    // Kit may emit relative hrefs; compare the URL a real browser navigates to.
    return [...list[1].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => {
      const url = new URL(match[1], response.url); return `${url.pathname}${url.search}`;
    });
  };
  assert.deepEqual(await links('en'), [`/content/stories/${english._.result.id}`]);
  assert.deepEqual(await links('fr'), [`/content/stories/${french._.result.id}?locale=fr`]);
  await fixture.restart();
  assert.deepEqual(await links('en'), [`/content/stories/${english._.result.id}`]);
  assert.deepEqual(await links('fr'), [`/content/stories/${french._.result.id}?locale=fr`]);
  console.log(JSON.stringify({ target, checks: 4 }));
} finally { await fixture.close(); }
