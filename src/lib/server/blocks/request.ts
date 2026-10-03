import {json,type RequestEvent} from '@sveltejs/kit';
import {z} from 'zod';
import {blocksDatabase} from './host.ts';
import {mapErrorStatus} from './errors.ts';
import * as handlers from './handlers.ts';
import {BLOCK_FIELD_TYPES} from '../schema/block-types.ts';
const slug=z.string().min(1).max(63).regex(/^[a-z][a-z0-9_]*$/);
const label=z.string().min(1).max(200);
const repeater=z.object({slug,label,type:z.enum(['string','text','url','number','integer','boolean','datetime','select','image']),required:z.boolean().optional(),options:z.array(z.string()).optional()}).strict();
const validation=z.object({min:z.number().optional(),max:z.number().optional(),minLength:z.number().int().min(0).optional(),maxLength:z.number().int().min(0).optional(),pattern:z.string().optional(),options:z.array(z.string()).optional(),subFields:z.array(repeater).min(1).optional(),minItems:z.number().int().min(0).optional(),maxItems:z.number().int().min(1).optional(),allowedMimeTypes:z.array(z.string()).min(1).max(64).optional()}).strict();
const field=z.object({slug,label,type:z.enum(BLOCK_FIELD_TYPES),required:z.boolean().optional(),defaultValue:z.unknown().optional(),validation:validation.optional(),options:z.object({darkVariant:z.boolean().optional()}).strict().optional()}).strict();
export const createBlockBody=z.object({slug,label,description:z.string().optional(),icon:z.string().optional(),category:z.string().optional(),fields:z.array(field)}).strict();
export const updateBlockBody=z.object({expectedFingerprint:z.string().min(1),label:label.optional(),description:z.string().nullish(),icon:z.string().nullish(),category:z.string().nullish(),fields:z.array(field).optional(),breaking:z.boolean().optional()}).strict();
export const activateBlockBody=z.object({expectedFingerprint:z.string().min(1)}).strict();
const headers={'cache-control':'private, no-store'};
export function blockAuthority(event:RequestEvent,mutation=false){
 const context=event.locals.cms;
 if(!context?.principal)return {ok:false,response:json({success:false,error:{code:'UNAUTHENTICATED',message:'Authentication is required'}},{status:401,headers})} as const;
 if(!context.principal.permissions.includes(mutation?'schema:manage':'schema:read'))return {ok:false,response:json({success:false,error:{code:'FORBIDDEN',message:'Schema permission is required'}},{status:403,headers})} as const;
 if(mutation&&event.request.headers.get('origin')!==event.url.origin)return {ok:false,response:json({success:false,error:{code:'FORBIDDEN',message:'Origin is not allowed'}},{status:403,headers})} as const;
 if(!context.database||mutation&&context.mutationsEnabled!==true)return {ok:false,response:json({success:false,error:{code:'NOT_CONFIGURED',message:'Block administration is unavailable'}},{status:503,headers})} as const;
 return {ok:true,context,db:blocksDatabase(context.database)} as const;
}
export async function blockEndpoint(event:RequestEvent,operation:'list'|'get'|'create'|'update'|'activate'){
 const authority=blockAuthority(event,['create','update','activate'].includes(operation));if(!authority.ok)return authority.response;
 let result;
 if(operation==='list')result=await handlers.handleBlockTypeList(authority.db);
 else if(operation==='get')result=await handlers.handleBlockTypeGet(authority.db,event.params.slug!);
 else {
  let raw:unknown;try{raw=await event.request.json();}catch{return json({success:false,error:{code:'VALIDATION_ERROR',message:'Enter valid JSON'}},{status:400,headers});}
  const parsed=(operation==='create'?createBlockBody:operation==='update'?updateBlockBody:activateBlockBody).safeParse(raw);
  if(!parsed.success)return json({success:false,error:{code:'VALIDATION_ERROR',message:'Invalid block definition'}},{status:400,headers});
  if(operation==='create')result=await handlers.handleBlockTypeCreate(authority.db,parsed.data as z.infer<typeof createBlockBody>);
  else if(operation==='update')result=await handlers.handleBlockTypeUpdate(authority.db,event.params.slug!,parsed.data as z.infer<typeof updateBlockBody>);
  else{
   const version=Number(event.params.version);if(!Number.isSafeInteger(version)||version<1)return json({success:false,error:{code:'VALIDATION_ERROR',message:'Invalid version'}},{status:400,headers});
   result=await handlers.handleBlockTypeVersionActivate(authority.db,event.params.slug!,version,(parsed.data as z.infer<typeof activateBlockBody>).expectedFingerprint);
  }
 }
 return json(result,{status:result.success?operation==='create'?201:200:mapErrorStatus(result.error.code),headers});
}
