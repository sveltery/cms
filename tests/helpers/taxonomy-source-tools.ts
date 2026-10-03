// Native in-process registrar fixture for unchanged source MCP-domain callbacks.
// It executes complete pinned registration bodies and real handlers/SQL.
// No SDK, network MCP, plugin runtime or bearer-token product credit.
import {registerTaxonomyHandlers,respondHandlerError} from './taxonomy-tool-source.ts';
import {SchemaRegistry} from '../../src/lib/server/taxonomies/upstream/schema/registry.ts';
import type {Kysely} from 'kysely';
import type {z} from 'zod';
interface Tool {options:{inputSchema:z.ZodType};callback:(args:any,extra:any)=>Promise<any>}
export interface McpHarness {client:{callTool(input:{name:string;arguments?:Record<string,unknown>}):Promise<any>;listTools():Promise<{tools:{name:string}[]}>};cleanup():Promise<void>}
export async function connectMcpHarness(input:{db:Kysely<any>;userId:string;userRole:number;tokenScopes?:string[]}):Promise<McpHarness>{
 const tools=new Map<string,Tool>();registerTaxonomyHandlers({registerTool(name:string,options:Tool['options'],callback:Tool['callback']){tools.set(name,{options,callback});}});
 const extra={authInfo:{extra:{emdash:{db:input.db},userId:input.userId,userRole:input.userRole,tokenScopes:input.tokenScopes}}};
 return{client:{
  async listTools(){return{tools:[...tools.keys()].map(name=>({name}))};},
  async callTool(request){
   if(request.name==='schema_list_collections')return{content:[{type:'text',text:JSON.stringify({items:await new SchemaRegistry(input.db).listCollections()})}]};
   const tool=tools.get(request.name);if(!tool)throw new Error(`Unknown native fixture registration: ${request.name}`);
   const args=tool.options.inputSchema.safeParse(request.arguments??{});if(!args.success)return{isError:true,content:[{type:'text',text:args.error.message}]};
   try{return await tool.callback(args.data,extra);}catch(cause){return respondHandlerError(cause);}
  }
 },async cleanup(){}};
}
export function extractText(result:{content:{type:string;text?:string}[]}):string{return result.content.filter(item=>item.type==='text').map(item=>item.text??'').join('\n');}
export function extractJson<T>(result:{content:{type:string;text?:string}[]}):T{return JSON.parse(extractText(result));}
