import { describe, it, expect } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { servicePrincipal } from '../../src/lib/server/auth/composition.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { registerBylineDatabase } from '../../src/lib/server/bylines/storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

const availableModules = import.meta.glob('../../src/lib/server/bylines/*.ts');
async function ownedModule(name: string) {
  const load = availableModules[`../../src/lib/server/bylines/${name}.ts`];
  return load ? await load() as Record<string, any> : null;
}
describe('Original byline producer on ordinary canonical installation', () => {
  it('provides a working profile repository without installing Source tables', async () => {
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const tables = await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table'`.execute(database.db);
      expect(tables.rows.some(row => row.name === '_cms_bylines')).toBe(true);
      expect(tables.rows.some(row => row.name.startsWith('_emdash_'))).toBe(false);
      const module = await ownedModule('repository');
      expect(module, 'installed byline repository').not.toBeNull();
      const repository = new module!.BylineRepository(database);
      const profile = await repository.create({ slug: 'native-author', displayName: 'Native Author', isGuest: true });
      expect((await repository.findById(profile.id))?.displayName).toBe('Native Author');
      const persisted = await sql<{display_name:string}>`SELECT display_name FROM _cms_bylines WHERE id=${profile.id}`.execute(database.db);
      expect(persisted.rows[0]?.display_name).toBe('Native Author');
    } finally { await database.close(); }
  });
  it('provides working custom-field registration on the canonical options counter', async () => {
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const module = await ownedModule('schema');
      expect(module, 'installed byline field registry').not.toBeNull();
      const registry = new module!.BylineSchemaRegistry(database);
      const field = await registry.createField({slug:'job_title',label:'Job title',type:'string'});
      expect((await registry.getField('job_title'))?.id).toBe(field.id);
      const persisted = await sql<{value:string}>`SELECT value FROM _cms_options WHERE name='byline_fields_version'`.execute(database.db);
      expect(Number(persisted.rows[0]?.value)).toBe(2);
    } finally { await database.close(); }
  });
  it('exposes real custom-field routes backed by the actual canonical registry', async () => {
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const module = await ownedModule('routes-fields');
      expect(module, 'installed byline field routes').not.toBeNull();
      const request = new Request('http://localhost/api/admin/byline-fields', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'job_title',label:'Job title',type:'string'})});
      const context = {request,url:new URL(request.url),params:{},locals:{emdash:{db:registerBylineDatabase(database)},user:servicePrincipal({id:'original-controlled-admin',role:Role.ADMIN})}};
      const response = await module!.POST(context);
      expect(response.status).toBe(201);
      expect((await sql<{slug:string}>`SELECT slug FROM _cms_byline_fields`.execute(database.db)).rows.map(row=>row.slug)).toEqual(['job_title']);
    } finally { await database.close(); }
  });

});
