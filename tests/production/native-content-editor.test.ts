// Supplemental native editor composition regressions; zero copied-source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';

test('native scalar creation form redirects with authoritative title slug and locale', async () => {
  const h = await persistedRemotes({ persistedSessions: true, mutationsEnabled: true });
  try {
    const response = await h.request('/content/post/new?locale=fr', 'author');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="field-title"/);
    const action = html.match(/<form\b[^>]*action="([^"]+)"/)?.[1];
    assert.ok(action, 'actual registered editor form');
    const url = new URL(action.replaceAll('&amp;', '&'), 'http://cms.test/content/post/new?locale=fr');
    const saved = await h.request(`${url.pathname}${url.search}`, 'author', {
      method: 'POST', headers: { origin: 'http://cms.test', accept: 'text/html' },
      body: new URLSearchParams({ collection: 'post', locale: 'fr', slug: '', 'data.title': 'Native title' })
    });
    assert.equal(saved.status, 303);
    const location = saved.headers.get('location');
    assert.ok(location); assert.match(location, /\/content\/post\/[A-Z0-9]+\?locale=fr$/);
    const id = new URL(location, 'http://cms.test').pathname.split('/').at(-1)!;
    const item = await h.query('getLifecycleContent', { collection: 'post', id, locale: 'fr' });
    assert.equal(item.data.title, 'Native title'); assert.equal(item.slug, 'native-title');
    assert.equal(item.locale, 'fr');
  } finally { await h.close(); }
});

test('editor saves stage the same lifecycle revision later published by the workflow', async () => {
  const h = await persistedRemotes({ persistedSessions: true, mutationsEnabled: true });
  try {
    assert.ok(h.ids.has('saveEditorContent'), 'registered editor lifecycle save');
    const created = (await h.mutate('createLifecycleContent', { collection: 'post', data: JSON.stringify({ title: 'First' }) }))._.result;
    const saved = (await h.mutate('saveEditorContent', { collection: 'post', id: created.id, _rev: created._rev, 'data.title': 'Edited' }))._.result;
    assert.notEqual(saved._rev, created._rev);
    const key = { collection: 'post', id: created.id, locale: 'en' };
    const staged = await h.query('getLifecycleContent', key);
    assert.equal(staged.data.title, 'Edited'); assert.ok(staged.draftRevisionId);
    await h.mutate('publishContent', { ...key, _rev: saved._rev });
    const service = lifecycleService(h.database, { id: 'user_author', permissions: ['content:read', 'content:read_drafts'] });
    const live = await service.readPublished({ type: 'post', id: created.id });
    assert.equal(live?.data.title, 'Edited'); assert.equal(live?.draftRevisionId, null);
    const stale = await h.remote('saveEditorContent', 'author', { ...key, _rev: created._rev, 'data.title': 'Stale' });
    assert.equal(stale.type, 'error'); assert.equal(stale.status, 409); assert.equal(stale.error.code, 'CONFLICT');
    assert.equal((await service.readPublished({ type: 'post', id: created.id }))?.data.title, 'Edited');
  } finally { await h.close(); }
});
