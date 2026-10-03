import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
import {SchemaRegistry} from '$lib/server/database/registry.ts';
import {FTSManager} from '$lib/server/search/fts-manager.ts';
import type {Database} from '$lib/server/database/lifecycle/upstream/database/types.ts';
import type {Kysely} from 'kysely';
export const load:PageServerLoad=async({locals})=>{
 const context=locals.cms;if(!context?.principal)error(401,'Authentication required');
 if(!context.principal.permissions.includes('search:manage'))error(403,'Search management requires an administrator');
 const registry=new SchemaRegistry(context.database),manager=new FTSManager(context.database.db as unknown as Kysely<Database>);
 return{collections:await Promise.all((await registry.listCollectionsWithFields()).map(async collection=>({...collection,searchConfig:await manager.getSearchConfig(collection.slug),stats:await manager.getIndexStats(collection.slug)}))),mutationsEnabled:context.mutationsEnabled===true};
};
