import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

// Complete actual normal PUBLIC37d5 installation capture, never NEW-provider
// installation. Preserve all historical DDL/order and the actual five markers.
const bytes = readFileSync(new URL('../../fixtures/canonical-public-v5.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'd3426a2a6f17811c4d345423ec9b690ef7fe465af08e1a39c76d65463caae883');
const fixture = JSON.parse(bytes.toString()) as {
  publicCommit:string; objects:{name:string;type:string;tbl_name:string;sql:string}[];
  markers:{version:number}[];
};
assert.equal(fixture.publicCommit,'37d5ed93a553c6ddef86c50a0eb596acbc9da63b');
assert.deepEqual(fixture.markers,[{version:1},{version:2},{version:3},{version:4},{version:5}]);

export async function installCanonicalPublicVersion5(database:CmsDatabase) {
  await database.atomicBatch([
    ...fixture.objects.map(object => sql.raw(object.sql).compile(database.db)),
    ...fixture.markers.map(marker => sql`INSERT INTO _cms_migrations(version) VALUES (${marker.version})`.compile(database.db))
  ]);
  assert.deepEqual((await database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute())
    .map(row=>row.version),[1,2,3,4,5]);
}
