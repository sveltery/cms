import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Original registered Kit transport requirements, not upstream source assertions.
const remoteName = 'updateSchemaFieldOptions';
const input = (extra: Record<string, string> = {}, field = 'title') => ({ collection: 'notes', field, ...extra });
const denial = (result: any, status: number, code: string) => {
  assert.equal(result.type, 'error'); assert.equal(result.status, status); assert.equal(result.error.code, code);
};
const refreshed = (data: any, name: string) => Object.entries(data.q ?? {})
  .filter(([key]) => key.includes(`/${name}/`)).map(([, value]) => value as any);
async function seed(h: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
  await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', required: true,
    defaultValue: 'Original', validation: { minLength: 1, maxLength: 80 } });
  await h.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text' });
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: options refresh metadata and validation, preserve content tokens and SQL, and reopen`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const c = await h.query('getSchemaCollection', 'notes');
      const created = await h.mutate('createContent', { collection: 'notes', 'data.title': 'Old readable title', 'data.body': 'Stored body' }, 'author');
      const identity = { collection: 'notes', id: created._.result.id };
      const content = await h.query('getContent', identity, 'author');
      const before = await h.snapshot();
      const label = `  ${'L'.repeat(240)}  `;
      const edited = await h.mutate(remoteName, input({ id: 'notes/title', labelMode: 'set', label,
        sortOrderMode: 'set', sortOrder: '7', defaultValueMode: 'set', defaultValue: 'Long metadata default',
        validationMode: 'set', minLength: '3', maxLength: '5' }));
      assert.deepEqual(edited._.result, { collection: 'notes', field: 'title' });
      const current = await h.query('getSchemaCollection', 'notes');
      const title = current.fields.find((field: any) => field.slug === 'title');
      assert.deepEqual(title, { ...c.fields[0], label, sortOrder: 7, defaultValue: 'Long metadata default', validation: { minLength: 3, maxLength: 5 } });
      assert.equal(current.version, c.version); assert.equal(current.updatedAt, c.updatedAt);
      const after = await h.snapshot();
      assert.deepEqual(after.collections, before.collections); assert.deepEqual(after.ddl, before.ddl); assert.deepEqual(after.guards, before.guards);
      assert.deepEqual(after.fields.find(field => field.slug === 'body'), before.fields.find(field => field.slug === 'body'));
      assert.deepEqual(await h.query('getContent', identity, 'author'), content);
      assert.equal(refreshed(edited, 'getSchemaCollection')[0].v.fields.find((field: any) => field.slug === 'title').label, label);
      const manifest = refreshed(edited, 'getEditorManifest')[0].v.collections.notes.fields.title;
      assert.equal(manifest.label, label); assert.deepEqual(manifest.validation, { minLength: 3, maxLength: 5 });
      assert.equal(Object.hasOwn(manifest, 'defaultValue'), false, 'existing projected default omission remains');
      denial(await h.remote('createContent', 'author', { collection: 'notes', 'data.title': 'Too long for changed validation' }), 400, 'VALIDATION_ERROR');
      await h.mutate('createContent', { collection: 'notes', 'data.title': 'Valid' }, 'author');
      const persisted = await h.query('getSchemaCollection', 'notes');
      await h.restart();
      assert.deepEqual(await h.query('getSchemaCollection', 'notes'), persisted);
      assert.deepEqual(await h.query('getContent', identity, 'author'), content);
      assert.deepEqual((await h.snapshot()).ddl, before.ddl);
    } finally { await h.close(); }
  });

  test(`${target}: registered keep/set/clear preserves omitted keys and concurrent independent same-field edits`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const before = await h.snapshot();
      await h.mutate(remoteName, input({ labelMode: 'keep', label: '', sortOrderMode: 'keep', sortOrder: 'invalid',
        defaultValueMode: 'keep', defaultValue: 'Ignored', validationMode: 'keep', minLength: '9', maxLength: '1' }));
      assert.deepEqual(await h.snapshot(), before);
      await Promise.all([
        h.mutate(remoteName, input({ labelMode: 'set', label: 'Concurrent label' })),
        h.mutate(remoteName, input({ defaultValueMode: 'set', defaultValue: '' }))
      ]);
      let current = await h.query('getSchemaCollection', 'notes');
      assert.equal(current.fields[0].label, 'Concurrent label'); assert.equal(current.fields[0].defaultValue, '');
      assert.deepEqual(current.fields[0].validation, { minLength: 1, maxLength: 80 });
      await h.mutate(remoteName, input({ validationMode: 'set', maxLength: '2' }));
      current = await h.query('getSchemaCollection', 'notes'); assert.deepEqual(current.fields[0].validation, { maxLength: 2 });
      await h.mutate(remoteName, input({ validationMode: 'set', minLength: '', maxLength: '' }));
      assert.deepEqual((await h.query('getSchemaCollection', 'notes')).fields[0].validation, {});
      assert.equal((await h.snapshot()).fields.find(field => field.slug === 'title')?.validation, '{}');
      await h.mutate(remoteName, input({ validationMode: 'clear', minLength: '9', maxLength: '1' }));
      assert.equal((await h.query('getSchemaCollection', 'notes')).fields[0].validation, null);
      assert.equal((await h.snapshot()).fields.find(field => field.slug === 'title')?.validation, null);
    } finally { await h.close(); }
  });

  test(`${target}: native options instances submit consecutive modes, isolate issues and enforce origin`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await seed(h);
      const html = await (await h.request('/schema/notes')).text();
      const forms = [...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)]
        .filter(form => form[1].includes(h.ids.get(remoteName)!));
      assert.equal(forms.length, 2);
      const actions = forms.map(form => new URL(form[1].replaceAll('&amp;', '&'), `${h.origin}/schema/notes`));
      for (const [index, field] of ['title', 'body'].entries()) {
        assert.equal(actions[index].searchParams.get('/remote'), `${h.ids.get(remoteName)}/${JSON.stringify(`notes/${field}`)}`);
        assert.match(forms[index][2], /name="collection"[^>]*value="notes"/);
        assert.match(forms[index][2], new RegExp(`name="field"[^>]*value="${field}"`));
        for (const mode of ['labelMode', 'sortOrderMode', 'defaultValueMode', 'validationMode']) assert.match(forms[index][2], new RegExp(`name="${mode}"`));
      }
      const post = (index: number, value: Record<string, string>) => h.request(`${actions[index].pathname}${actions[index].search}`, 'admin', {
        method: 'POST', headers: { origin: h.origin, accept: 'text/html' }, body: new URLSearchParams(value)
      });
      const before = await h.snapshot();
      const invalid = await post(0, input({ validationMode: 'set', minLength: '6', maxLength: '3' }));
      assert.equal(invalid.status, 200); const invalidHtml = await invalid.text();
      assert.match(invalidHtml, /aria-label="title options validation errors"/);
      assert.doesNotMatch(invalidHtml, /aria-label="body options validation errors"/);
      assert.deepEqual(await h.snapshot(), before);
      const consecutive: Record<string, string>[] = [{ defaultValueMode: 'set', defaultValue: '' }, { validationMode: 'set', minLength: '', maxLength: '' }, { validationMode: 'clear' }];
      for (const value of consecutive) {
        const response = await post(1, input(value, 'body')); assert.equal(response.status, 200);
        assert.equal(((await response.text()).match(/Field options saved\./g) ?? []).length, 1);
      }
      const body = (await h.query('getSchemaCollection', 'notes')).fields[1];
      assert.equal(body.defaultValue, ''); assert.equal(body.validation, null);
      const after = await h.snapshot();
      for (const path of [`/_app/remote/${h.ids.get(remoteName)}`, `${actions[0].pathname}${actions[0].search}`]) {
        for (const origin of [undefined, 'null', 'https://attacker.invalid']) {
          const response = await h.request(path, 'admin', { method: 'POST', headers: { accept: 'text/html', ...(origin ? { origin } : {}) }, body: new URLSearchParams(input()) });
          assert.equal(response.status, 403);
        }
      }
      assert.deepEqual(await h.snapshot(), after);
    } finally { await h.close(); }
  });

  test(`${target}: options validation and trusted request gate deny writes before storage`, { timeout: 60_000 }, async () => {
    for (const enabled of [false, true]) {
      const h = await schemaAdminRemotes(target, enabled);
      try {
        await seed(h); const before = await h.snapshot();
        const invalid: Record<string, string>[] = [{ labelMode: 'set', label: '' }, { id: 'notes/body' }, { defaultValueMode: 'clear' },
          { sortOrderMode: 'set', sortOrder: '-1' }, { validationMode: 'set', minLength: '2', maxLength: '1' },
          { widget: 'textarea' }, { type: 'text' }, { 'b:required': 'on' }, { _rev: 'opaque' }];
        if (enabled) for (const extra of invalid) {
          const result = await h.remote(remoteName, 'admin', input(extra));
          if (result.type === 'result') { assert.ok(parse(result.data)._.issues?.length); }
          else denial(result, 400, 'VALIDATION_ERROR');
          assert.deepEqual(await h.snapshot(), before);
        }
        h.probeStorage();
        for (const session of [null, 'author', 'editor', 'subscriber'] as const) {
          denial(await h.remote(remoteName, session, input()), session ? 403 : 401, session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED');
        }
        if (!enabled) denial(await h.remote(remoteName, 'admin', input()), 503, 'MUTATIONS_DISABLED');
        assert.equal(h.storageReads, 0);
        if (enabled) { h.probeStorage('absent'); denial(await h.remote(remoteName, 'admin', input()), 503, 'NOT_CONFIGURED'); assert.equal(h.storageReads, 1); }
        assert.deepEqual(await h.snapshot(), before);
      } finally { await h.close(); }
    }
  });
}
