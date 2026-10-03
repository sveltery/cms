import {expect,it} from 'vitest';
import {Permissions,hasPermission} from '../../src/lib/server/auth/permissions.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';
import {mediaPermissionsForUser} from '../../src/lib/media/permissions.ts';
it('projects exactly the actual server media permissions for every persisted role',()=>{
 const mediaPermissions=Object.keys(Permissions).filter(permission=>permission.startsWith('media:')) as (keyof typeof Permissions)[];
 for(const role of Object.values(Role))expect(mediaPermissionsForUser({role})).toEqual(mediaPermissions.filter(permission=>hasPermission({role},permission)));
});
it('denies absent and malformed identity roles',()=>{
 for(const user of [null,undefined,{role:0},{role:49},{role:Infinity},{role:'50'},{role:undefined}])expect(mediaPermissionsForUser(user)).toEqual([]);
});
