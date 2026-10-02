import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { collectionTrashFixture } from '../helpers/collection-trash.ts';

// Supplemental native interaction evidence, not complete EmDash content-actions.spec.ts:629 parity.
test('built trash forms bind identity/locale/token, isolate issues and restore through native HTTP', async () => {
  const fixture = await collectionTrashFixture(undefined, { mutationsEnabled: true, restoreEntries: true });
  try {
    const request = (path: string, session = 'author', body?: FormData) => fixture.respond(new Request(`http://cms.test${path}`, {
      method: body ? 'POST' : 'GET', headers: { cookie: `cms-session=${fixture.tokens[session]}`, ...(body ? { origin: 'http://cms.test', accept: 'text/html' } : {}) },
      ...(body ? { body } : {})
    }));
    const forms = (html: string) => [...html.matchAll(/<form\b[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)].map(match => {
      const fields: Record<string, string> = Object.fromEntries([...match[2].matchAll(/<input\b[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g)].map(field => [field[1], field[2]]));
      return { action: match[1], html: match[2], fields };
    });
    const html = await (await request('/trash/restore')).text();
    const bound = forms(html);
    assert.equal(bound.length, 4);
    assert.equal(new Set(bound.map(form => form.action)).size, 4);
    for (const form of bound) {
      assert.deepEqual(Object.keys(form.fields), ['collection', 'id', 'locale', '_rev']);
      const item = fixture.restoreItems.find(item => item?.id === form.fields.id)!;
      assert.equal(form.fields.collection, 'restore');
      assert.equal(form.fields.locale, item.locale);
      assert.equal(Boolean(form.html.match(/<button[^>]*disabled/)), item.authorId !== 'user_author');
    }
    const ids = new Map<string, string>();
    for (const [hash, load] of Object.entries(fixture.manifest._.remotes)) {
      const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    const query = async (name: string, input: unknown) => (await request(`/_app/remote/${ids.get(name)}?payload=${Buffer.from(stringify(input)).toString('base64url')}`)).json();
    const en = bound.find(form => form.fields.locale === 'en' && !/<button[^>]*disabled/.test(form.html))!;
    const fr = bound.find(form => form.fields.locale === 'fr')!;
    const submit = async (form: typeof en, overrides: Record<string, string> = {}, session = 'author') => {
      const body = new FormData();
      for (const [key, value] of Object.entries({ ...form.fields, ...overrides })) body.set(key, value);
      return request(`/trash/restore${form.action}`, session, body);
    };
    const invalid = await submit(en, { _rev: '' });
    assert.equal(invalid.status, 200);
    const invalidForms = forms(await invalid.text());
    assert.match(invalidForms.find(form => form.fields.id === en.fields.id)!.html, /Restore validation errors/);
    assert.doesNotMatch(invalidForms.find(form => form.fields.id === fr.fields.id)!.html, /Restore validation errors|Draft restored/);
    // Lexically valid but context-swapped tokens, IDs and locales cannot restore another row.
    const swapped: Record<string, string>[] = [{ _rev: fr.fields._rev }, { id: fr.fields.id }, { locale: 'fr' }];
    for (const overrides of swapped) {
      assert.equal((await submit(en, overrides)).status, 400);
    }
    assert.equal((await submit(fr, {}, 'contributor')).status, 403);
    const other = bound.find(form => /Other owner/.test(form.html))!;
    assert.equal((await submit(other)).status, 403);
    const before = await query('getTrashedContent', { collection: 'restore', id: fr.fields.id, locale: 'fr' });
    assert.equal(parse(before.data)._._rev, fr.fields._rev);
    const success = await submit(fr);
    assert.equal(success.status, 200);
    const refreshed = await success.text();
    assert.ok(!forms(refreshed).some(form => form.fields.id === fr.fields.id));
    assert.equal(forms(refreshed).length, 3);
    const active = await query('getContent', { collection: 'restore', id: fr.fields.id, locale: 'fr' });
    const restored = parse(active.data)._;
    assert.equal(restored.locale, 'fr');
    assert.notEqual(restored._rev, fr.fields._rev);
    assert.equal(parse((await query('listContent', { collection: 'restore', locale: 'fr' })).data)._.items[0].id, fr.fields.id);
    assert.equal((await submit(fr)).status, 409);
    assert.equal(parse((await query('getContent', { collection: 'restore', id: fr.fields.id, locale: 'fr' })).data)._._rev, restored._rev);
    await fixture.staleRestore(en.fields.id);
    assert.equal((await submit(en)).status, 409);
    const freshEn = forms(await (await request('/trash/restore')).text()).find(form => form.fields.id === en.fields.id)!;
    assert.notEqual(freshEn.fields._rev, en.fields._rev);
    const first = await submit(freshEn);
    assert.equal(first.status, 200);
    assert.match(await (await request('/content/restore')).text(), /Restore pair/);
    assert.equal((await submit(en)).status, 409);
    await fixture.restart();
    assert.equal(forms(await (await request('/trash/restore')).text()).length, 2);
    assert.match(await (await request('/content/restore')).text(), /Restore pair/);
    assert.equal(forms(await (await request('/trash/restore', 'editor')).text()).filter(form => /<button[^>]*disabled/.test(form.html)).length, 0);
  } finally { await fixture.close(); }
});
