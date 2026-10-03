import {error} from '@sveltejs/kit';
import {BlockTypeRegistry} from '$lib/server/blocks/registry';
import {blocksDatabase} from '$lib/server/blocks/host';
import {SchemaRegistry} from '$lib/server/database/registry';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async({locals})=>{
 const context=locals.cms;if(!context?.principal)error(401,'Authentication is required');
 if(!context.principal.permissions.includes('schema:read'))error(403,'Schema permission is required');
 const types=await new BlockTypeRegistry(blocksDatabase(context.database)).listBlockTypes();
 return {blockTypes:types,collections:await new SchemaRegistry(context.database).listCollections(),canManage:context.mutationsEnabled&&context.principal.permissions.includes('schema:manage')};
};
