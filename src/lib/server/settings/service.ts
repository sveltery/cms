import type {CmsDatabase} from '../database/contract.ts';
import {CmsError} from '../database/contract.ts';
import type {ServerPrincipal} from '../database/service.ts';
import {settingsUpdateBody} from './schemas.ts';
import {getSiteSettingsWithDb,setSiteSettings,settingsDb} from './index.ts';
export function settingsService(database:CmsDatabase,principal:ServerPrincipal|null){
 const authorize=(permission:'settings:read'|'settings:manage')=>{
  if(!principal)throw new CmsError('UNAUTHENTICATED');
  if(!principal.permissions.includes(permission))throw new CmsError('FORBIDDEN');
 };
 return{
  async get(){authorize('settings:read');return getSiteSettingsWithDb(settingsDb(database));},
  async update(input:unknown){authorize('settings:manage');const parsed=settingsUpdateBody.safeParse(input);if(!parsed.success)throw new CmsError('VALIDATION_ERROR');const db=settingsDb(database);await setSiteSettings(parsed.data,db);return getSiteSettingsWithDb(db);}
 };
}
