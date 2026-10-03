import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {servicePrincipal} from '../src/lib/server/auth/composition.ts';
import {Role} from '../src/lib/server/auth/roles.ts';

test('taxonomy read capability projects from the current stored subscriber role',()=>{
 const actor=servicePrincipal({id:'subscriber',email:'s@example.test',name:'Subscriber',role:Role.SUBSCRIBER});
 assert.equal(actor?.permissions.includes('taxonomies:read' as any),true);
 assert.equal(actor?.permissions.includes('taxonomies:manage' as any),false);
});
test('taxonomy management capability projects from current stored editor role',()=>{
 const actor=servicePrincipal({id:'editor',email:'e@example.test',name:'Editor',role:Role.EDITOR});
 assert.equal(actor?.permissions.includes('taxonomies:read' as any),true);
 assert.equal(actor?.permissions.includes('taxonomies:manage' as any),true);
});
test('canonical startup owns all taxonomy registry and assignment tables',async()=>{
 const database=openSqlite(':memory:');try {await migrateCms(database);
  const rows=(await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('taxonomies','content_taxonomies','_cms_taxonomy_defs','_cms_taxonomy_def_groups') ORDER BY name`.execute(database.db)).rows;
  assert.deepEqual(rows.map(row=>row.name),['_cms_taxonomy_def_groups','_cms_taxonomy_defs','content_taxonomies','taxonomies']);
 }finally{await database.close();}
});
