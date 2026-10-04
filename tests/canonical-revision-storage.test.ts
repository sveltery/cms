// Original ordinary trigger-storage coverage. First execution has zero causal
// Source credit. No conditional-write, concurrent, session or replay probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { canonicalStorage, storageTargets } from './helpers/canonical-installation/storage.ts';

for (const target of storageTargets) {
  test(`${target}: normal option and plugin storage revision triggers retain actual Source values`, {timeout:30_000}, async () => {
    const h = await canonicalStorage(target);
    try {
      await migrateCms(h.database);
      await sql`INSERT INTO _cms_options(name,value) VALUES ('ordinary-option','{"value":"one"}')`.execute(h.database.db);
      const option = async () => (await sql<{value:string;revision:string}>`SELECT value,revision FROM _cms_options WHERE name='ordinary-option'`.execute(h.database.db)).rows[0];
      const first = await option();
      assert.match(first.revision,/^[a-f0-9]{32}$/);
      assert.equal(first.value,'{"value":"one"}');
      await sql`UPDATE _cms_options SET value='{"value":"two"}' WHERE name='ordinary-option'`.execute(h.database.db);
      const second = await option();
      assert.match(second.revision,/^[a-f0-9]{32}$/);
      assert.notEqual(second.revision,first.revision);
      assert.equal(second.value,'{"value":"two"}');
      await sql`INSERT INTO _cms_plugin_storage(plugin_id,collection,id,data)
        VALUES ('ordinary-plugin','settings','theme','{"color":"blue"}')`.execute(h.database.db);
      const plugin = async () => (await sql<{data:string;revision:string;created_at:string|null;updated_at:string|null}>`SELECT data,revision,created_at,updated_at
        FROM _cms_plugin_storage WHERE plugin_id='ordinary-plugin' AND collection='settings' AND id='theme'`.execute(h.database.db)).rows[0];
      const initial = await plugin();
      assert.match(initial.revision,/^[a-f0-9]{32}$/);
      assert.equal(initial.data,'{"color":"blue"}');
      assert.match(initial.created_at!,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      await sql`UPDATE _cms_plugin_storage SET data='{"color":"green"}'
        WHERE plugin_id='ordinary-plugin' AND collection='settings' AND id='theme'`.execute(h.database.db);
      const changed = await plugin();
      assert.match(changed.revision,/^[a-f0-9]{32}$/);
      assert.notEqual(changed.revision,initial.revision);
      assert.equal(changed.data,'{"color":"green"}');
      await h.reopen();
      await migrateCms(h.database);
      assert.deepEqual(await plugin(),changed);
      assert.deepEqual(await option(),second);
    } finally { await h.close(); }
  });
}
