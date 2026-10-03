// Source envelope adapter around the real trusted native lifecycle service.
// No REST/MCP implementation or whole EmDashRuntime credit.
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {taxonomyDatabase} from '../../src/lib/server/taxonomies/upstream/host.ts';
import type {Kysely} from 'kysely';
const principal={id:'taxonomy-source-admin',permissions:['schema:read','schema:manage','content:read','content:read_drafts','content:create','content:edit_any','content:publish_any','content:delete_any'] as any};
const service=(db:Kysely<any>)=>{const database=taxonomyDatabase(db);if(!database)throw new Error('Unregistered taxonomy fixture database');return lifecycleService(database,principal);};
async function result(operation:()=>Promise<any>){try{return{success:true,data:await operation()};}catch(error){return{success:false,error:{code:(error as any).code??'CONTENT_ERROR',message:(error as Error).message}};}}
export const handleContentCreate=(db:Kysely<any>,collection:string,input:any)=>result(async()=>({item:await service(db).createContent({type:collection,...input})}));
export const handleContentUpdate=(db:Kysely<any>,collection:string,id:string,input:any)=>result(()=>service(db).updateContent({type:collection,id,...input}));
export const handleContentGet=(db:Kysely<any>,collection:string,id:string,input:any={})=>result(async()=>({item:await service(db).getContent({type:collection,id,...input})}));
