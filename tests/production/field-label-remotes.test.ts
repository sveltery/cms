import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Supplemental native Kit transport contracts; no complete upstream declaration credit.
const remoteName = 'updateSchemaFieldLabel';
const expected = (c: any) => ({ collection: c.slug, version: String(c.version), updatedAt: c.updatedAt });
const input = (field = 'title', label = 'Edited title') => ({ collection: 'notes', field, label });
const denial = (result: any, status: number, code: string) => {
  assert.equal(result.type, 'error'); assert.equal(result.status, status); assert.equal(result.error.code, code);
};
const refreshes = (data: any, name: string) => Object.entries(data.q ?? {})
  .filter(([key]) => key.includes(`/${name}/`)).map(([, value]) => value as any);
async function seed(h: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  await h.registry.createCollection({ slug: 'notes', label: 'Notes', description: 'Preserved' });
  await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', required: true,
    unique: true, defaultValue: 'Original', validation: { minLength: 1, maxLength: 80 } });
  await h.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text', defaultValue: '' });
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: registered label form changes only its target and refreshes schema/manifest without changing content tokens`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const c = await h.query('getSchemaCollection', 'notes');
      const created = await h.mutate('createContent', { collection: 'notes', 'data.title': 'Stored title', 'data.body': 'Stored body' }, 'author');
      const contentInput = { collection: 'notes', id: created._.result.id };
      const content = await h.query('getContent', contentInput, 'author');
      const before = await h.snapshot();
      const label = `  ${'L'.repeat(240)}  `;
      const edited = await h.mutate(remoteName, { ...input('title', label), id: 'notes/title' });
      assert.deepEqual(edited._.result, { collection: 'notes', field: 'title' });
      const current = await h.query('getSchemaCollection', 'notes');
      assert.deepEqual(current, { ...c, fields: c.fields.map((field: any) => field.slug === 'title' ? { ...field, label } : field) });
      const after = await h.snapshot();
      assert.deepEqual(after, { ...before, fields: before.fields.map(field => field.slug === 'title'
        ? Object.assign(Object.create(Object.getPrototypeOf(field)), field, { label }) : field) });
      assert.equal(refreshes(edited, 'getSchemaCollection')[0].v.fields.find((field: any) => field.slug === 'title').label, label);
      assert.equal(refreshes(edited, 'getEditorManifest')[0].v.collections.notes.fields.title.label, label);
      assert.equal((await h.query('getEditorManifest', undefined, 'author')).collections.notes.fields.title.label, label);
      assert.deepEqual(await h.query('getContent', contentInput, 'author'), content);
      await h.mutate(remoteName, input('body', '   '));
      assert.equal((await h.query('getSchemaCollection', 'notes')).fields[1].label, '   ', 'no label trimming');
      const final = await h.query('getSchemaCollection', 'notes');
      const snapshot = await h.snapshot();
      await h.restart();
      assert.deepEqual(await h.query('getSchemaCollection', 'notes'), final);
      assert.deepEqual(await h.snapshot(), snapshot);
      assert.deepEqual(await h.query('getContent', contentInput, 'author'), content);
    } finally { await h.close(); }
  });

  test(`${target}: labels coexist with independent fields, unchanged metadata tokens and additive schema writes`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const original = await h.query('getSchemaCollection', 'notes');
      const simultaneous = await Promise.all([h.mutate(remoteName, input('title', 'Concurrent title')), h.mutate(remoteName, input('body', 'Concurrent body'))]);
      assert.equal(simultaneous.length, 2);
      const labeled = await h.query('getSchemaCollection', 'notes');
      assert.equal(labeled.fields[0].label, 'Concurrent title'); assert.equal(labeled.fields[1].label, 'Concurrent body');
      assert.equal(labeled.version, original.version); assert.equal(labeled.updatedAt, original.updatedAt);
      await Promise.all([
        h.mutate('updateSchemaCollection', { ...expected(original), label: 'Metadata alongside labels' }),
        h.mutate(remoteName, input('title', 'Concurrent title'))
      ]);
      const metadata = await h.query('getSchemaCollection', 'notes');
      assert.equal(metadata.label, 'Metadata alongside labels');
      assert.deepEqual(metadata.fields, labeled.fields, 'metadata cannot overwrite field labels');
      await Promise.all([
        h.mutate(remoteName, input('title', 'Alongside addition')),
        h.mutate('addSchemaField', { collection: 'notes', expectedSchemaVersion: String(metadata.version), slug: 'extra', label: 'Extra', type: 'text' })
      ]);
      let current = await h.query('getSchemaCollection', 'notes');
      assert.equal(current.version, metadata.version + 1); assert.equal(current.fields[0].label, 'Alongside addition');
      assert.equal(current.fields[2].slug, 'extra');
      await h.mutate(remoteName, input('title', 'First writer'));
      await Promise.all([h.mutate(remoteName, input('title', 'Last writer')), h.mutate(remoteName, input('title', 'Last writer'))]);
      await h.mutate(remoteName, input('title', 'Last writer'));
      current = await h.query('getSchemaCollection', 'notes');
      assert.equal(current.fields[0].label, 'Last writer', 'same field is last-writer-wins without CAS');
    } finally { await h.close(); }
  });

  test(`${target}: label validation rejects injected identity and broader edits with zero writes`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const before = await h.snapshot();
      const invalidExtras: Record<string, string>[] = [{ label: '' }, { id: 'notes/body' }, { id: 'other/title' }, { slug: 'renamed' },
        { type: 'text' }, { 'b:required': 'on' }, { 'b:unique': 'on' }, { defaultValue: 'New' },
        { minLength: '2' }, { validation: '{}' }, { sortOrder: '1' }, { widget: 'textarea' },
        { version: '3' }, { updatedAt: '2026-01-01T00:00:00.000Z' }, { principal: 'admin' }];
      for (const extra of invalidExtras) {
        const result = await h.remote(remoteName, 'admin', { ...input(), ...extra });
        if (result.type === 'result') {
          const data = parse(result.data); assert.ok(data._.issues?.length); assert.equal(data._.result, undefined);
        } else denial(result, 400, 'VALIDATION_ERROR');
        assert.deepEqual(await h.snapshot(), before, `invalid ${JSON.stringify(extra)} writes nothing`);
      }
      denial(await h.remote(remoteName, 'admin', { collection: 'notes', field: 'missing', label: 'Missing' }), 404, 'NOT_FOUND');
      denial(await h.remote(remoteName, 'admin', { collection: 'missing', field: 'title', label: 'Missing' }), 404, 'NOT_FOUND');
      assert.deepEqual(await h.snapshot(), before);
    } finally { await h.close(); }
  });

  test(`${target}: trusted manage permission and mutation gate precede label storage access`, { timeout: 60_000 }, async () => {
    for (const enabled of [false, true]) {
      const h = await schemaAdminRemotes(target, enabled);
      try {
        await seed(h);
        const before = await h.snapshot();
        const html = await (await h.request('/schema/notes')).text();
        assert.match(html, /Edit title label/);
        if (!enabled) assert.match(html, /<fieldset disabled(?:[\s=>])/);
        h.probeStorage();
        for (const session of [null, 'author', 'editor', 'subscriber'] as const) {
          denial(await h.remote(remoteName, session, input()), session ? 403 : 401, session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED');
        }
        if (!enabled) denial(await h.remote(remoteName, 'admin', input()), 503, 'MUTATIONS_DISABLED');
        assert.equal(h.storageReads, 0);
        if (enabled) {
          h.probeStorage('absent');
          denial(await h.remote(remoteName, 'admin', input()), 503, 'NOT_CONFIGURED');
          assert.equal(h.storageReads, 1);
        }
        assert.deepEqual(await h.snapshot(), before);
      } finally { await h.close(); }
    }
  });

  test(`${target}: native keyed label forms isolate instances and reject foreign origins`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const html = await (await h.request('/schema/notes')).text();
      const forms = [...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)];
      const labelForms = forms.filter(form => form[1].includes(h.ids.get(remoteName)!));
      assert.equal(labelForms.length, 2);
      const actions = labelForms.map(form => new URL(form[1].replaceAll('&amp;', '&'), `${h.origin}/schema/notes`));
      for (const [index, field] of ['title', 'body'].entries()) {
        assert.equal(actions[index].searchParams.get('/remote'), `${h.ids.get(remoteName)}/${JSON.stringify(`notes/${field}`)}`);
        assert.match(labelForms[index][2], /name="collection"[^>]*value="notes"/);
        assert.match(labelForms[index][2], new RegExp(`name="field"[^>]*value="${field}"`));
      }
      const invalid = await h.request(`${actions[0].pathname}${actions[0].search}`, 'admin', {
        method: 'POST', headers: { origin: h.origin, accept: 'text/html' }, body: new URLSearchParams(input('title', ''))
      });
      assert.equal(invalid.status, 200);
      const invalidHtml = await invalid.text();
      assert.match(invalidHtml, /aria-label="title label validation errors"/);
      assert.doesNotMatch(invalidHtml, /aria-label="body label validation errors"/);
      const native = await h.request(`${actions[1].pathname}${actions[1].search}`, 'admin', {
        method: 'POST', headers: { origin: h.origin, accept: 'text/html' }, body: new URLSearchParams(input('body', 'Native body'))
      });
      assert.equal(native.status, 200);
      const successHtml = await native.text();
      assert.equal((successHtml.match(/Field label saved\./g) ?? []).length, 1);
      const current = await h.query('getSchemaCollection', 'notes');
      assert.equal(current.fields[0].label, 'Title'); assert.equal(current.fields[1].label, 'Native body');
      const before = await h.snapshot();
      for (const path of [`/_app/remote/${h.ids.get(remoteName)}`, `${actions[0].pathname}${actions[0].search}`]) {
        for (const origin of [undefined, 'null', 'https://attacker.invalid']) {
          const response = await h.request(path, 'admin', { method: 'POST', headers: { accept: 'text/html', ...(origin ? { origin } : {}) }, body: new URLSearchParams(input()) });
          assert.equal(response.status, 403);
        }
      }
      assert.deepEqual(await h.snapshot(), before);
    } finally { await h.close(); }
  });
}
