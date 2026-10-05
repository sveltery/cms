import type { Permission, ServerPrincipal } from '../../../database/service.ts';
import { apiError } from './error.ts';
/** Consume only the single trusted principal owner's projected permissions. */
export function requirePerm(user:ServerPrincipal|null|undefined,permission:Permission):Response|null {
  if(!user)return apiError('UNAUTHORIZED','Authentication required',401);
  return user.permissions.includes(permission) ? null : apiError('FORBIDDEN','Insufficient permissions',403);
}
export function requireOwnerPerm(user:ServerPrincipal|null|undefined,ownerId:string|null,own:Permission,any:Permission):Response|null {
  if(!user)return apiError('UNAUTHORIZED','Authentication required',401);
  if(user.permissions.includes(any)||(typeof ownerId==='string'&&ownerId.length>0&&ownerId===user.id&&user.permissions.includes(own)))return null;
  return apiError('FORBIDDEN','Insufficient permissions',403);
}
export function canReadMediaUsageCount(user:ServerPrincipal|null|undefined,tokenScopes:string[]|undefined):boolean {
  return !!user?.permissions.includes('content:read_drafts')&&(!tokenScopes||tokenScopes.includes('admin'));
}
