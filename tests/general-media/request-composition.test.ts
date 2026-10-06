import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsHandle, servicePrincipal } from '../../src/lib/server/auth/composition.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { LocalStorage } from '../../src/lib/server/general-media/index.ts';
describe('Original trusted native media request composition', () => {
  it.each([
    [Role.SUBSCRIBER,['media:read']],
    [Role.CONTRIBUTOR,['media:read','media:upload']],
    [Role.AUTHOR,['media:read','media:upload','media:edit_own','media:delete_own']],
    [Role.EDITOR,['media:read','media:upload','media:edit_own','media:edit_any','media:delete_own','media:delete_any']],
    [Role.ADMIN,['media:read','media:upload','media:edit_own','media:edit_any','media:delete_own','media:delete_any']]
  ] as const)('projects the pinned media thresholds for role %s', (role,expected) => {
    expect(servicePrincipal({id:'native-media-controlled-role',role})?.permissions.filter(permission=>permission.startsWith('media:'))).toEqual(expected);
  });
  it('preserves supplied storage identity alongside the actual database and default-disabled mutations', async () => {
    const directory=await mkdtemp(join(tmpdir(),'media-request-storage-'));
    const database=openSqlite(':memory:');
    try {
      await migrateCms(database);
      const storage=new LocalStorage({directory,baseUrl:'/media'});
      const event={locals:{},cookies:{get:()=>undefined},request:new Request('http://localhost/'),url:new URL('http://localhost/')} as unknown as RequestEvent;
      const factory=()=>({database,storage});
      const handle=createCmsHandle(factory);
      await handle({event,resolve:async current=>{
        expect((current.locals.cms as unknown as {storage:LocalStorage}).storage).toBe(storage);
        expect(current.locals.cms?.database).toBe(database);
        expect(current.locals.cms?.principal).toBeNull();
        expect(current.locals.cms?.mutationsEnabled).toBe(false);
        return new Response('ordinary native composition');
      }});
    } finally {await database.close();await rm(directory,{recursive:true,force:true});}
  });
});
