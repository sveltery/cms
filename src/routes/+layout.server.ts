import type {LayoutServerLoad} from './$types';
import {SchemaRegistry} from '$lib/server/database/registry.ts';
/** Navigation is presentation of the current server-resolved session. */
export const load:LayoutServerLoad=async({locals})=>{
 const context=locals.cms;
 if(!context?.principal)return{searchNavigation:null};
 const user=await context.database.db.selectFrom('_cms_auth_users').select('role').where('id','=',context.principal.id).executeTakeFirst();
 const collections=context.principal.permissions.includes('content:read')?await new SchemaRegistry(context.database).listCollections():[];
 return{searchNavigation:{role:user?.role??0,manifest:{collections:Object.fromEntries(collections.map(collection=>[collection.slug,{label:collection.label,labelSingular:collection.labelSingular??undefined,hidden:collection.hidden,icon:collection.icon}])),plugins:{}}}};
};
