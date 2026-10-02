import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { createRequiredScalarFieldsServer } from '../helpers/required-scalar-fields-server.mjs';

// Test-only production build uses unmodified registered product remotes and direct Kit descriptors.
test('built direct scalar descriptors reject native empty-string full/partial writes', { timeout: 90_000 }, async () => {
  const fixture = await createRequiredScalarFieldsServer();
  const headers = { cookie: 'scalar-fields-session=author; scalar-fields-write-gate=enabled' };
  const snapshot = async () => {
    const database = openSqlite(fixture.databasePath);
    try {
      return {
        ddl: (await sql`SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`.execute(database.db)).rows,
        fields: (await sql`SELECT * FROM _cms_fields ORDER BY id`.execute(database.db)).rows,
        collections: (await sql`SELECT * FROM _cms_collections ORDER BY id`.execute(database.db)).rows,
        guards: (await sql`SELECT * FROM _cms_guards`.execute(database.db)).rows,
        scalars: (await sql`SELECT * FROM ec_scalars ORDER BY id`.execute(database.db)).rows,
        legacy: (await sql`SELECT * FROM ec_legacy ORDER BY id`.execute(database.db)).rows
      };
    } finally { await database.close(); }
  };
  try {
    const before = await snapshot();
    for (const update of [false, true]) for (const empty of ['string', 'text']) {
      const pageURL = new URL(`?empty=${empty}${update ? '&update' : ''}`, fixture.baseURL);
      const page = await fetch(pageURL, { headers, signal: AbortSignal.timeout(10_000) });
      assert.equal(page.status, 200);
      const html = await page.text();
      const form = html.match(/<form\b[^>]*>/)![0];
      assert.match(form, /method="POST"/);
      const action = new URL(form.match(/action="([^"]+)"/)![1].replaceAll('&amp;', '&'), fixture.baseURL);
      assert.equal(action.searchParams.get('/remote'), fixture.ids.get(update ? 'updateContent' : 'createContent'));
      const controls = html.match(/<input\b[^>]*>/g)!;
      const field = (name: string) => {
        const control = controls.find(control => control.includes(`name="${name}"`));
        assert.ok(control, `generated descriptor ${name}`); assert.match(control, /type="hidden"/);
        return control.match(/value="([^"]*)"/)![1].replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
      };
      const input: Record<string, string> = { collection: field('collection'), data: field('data') };
      assert.equal(JSON.parse(input.data)[empty], '');
      if (update) { input.id = field('id'); input._rev = field('_rev'); assert.equal(input._rev, fixture.inputs.legacy._rev); }
      const rejected = await fetch(action, { method: 'POST', headers: { ...headers, origin: new URL(fixture.baseURL).origin, accept: 'text/html' },
        body: new URLSearchParams(input), signal: AbortSignal.timeout(10_000) });
      assert.equal(rejected.status, 400); assert.match(await rejected.text(), /validation-error/);
      assert.deepEqual(await snapshot(), before);
    }
  } finally { await fixture.close(); }
});
