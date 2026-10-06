import type {ServerPrincipal,Permission} from '../database/service.ts';
import {apiError} from '../sections-widgets/api/error.ts';
/** Actual trusted Native principal permission names; no role or identity is invented. */
export function requireOwnerPerm(user:ServerPrincipal|null,authorId:string,own:Permission,any:Permission):Response|null{
 if(!user)return apiError('UNAUTHENTICATED','Authentication required',401);
 if(user.permissions.includes(any)||user.id===authorId&&user.permissions.includes(own))return null;
 return apiError('INSUFFICIENT_PERMISSIONS','Insufficient permissions',403);
}
