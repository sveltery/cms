import type {Permission,ServerPrincipal} from '../database/service.ts';
import {apiError} from './http-errors.ts';
/** Consume permissions derived by the single trusted principal owner. */
export function requirePerm(principal:ServerPrincipal|null|undefined,permission:Permission):Response|null {
 if(!principal)return apiError('UNAUTHORIZED','Authentication required',401);
 if(!principal.permissions.includes(permission))return apiError('FORBIDDEN','Insufficient permissions',403);
 return null;
}
