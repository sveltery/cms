import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {withRevision,precondition} from '../../src/lib/server/content/schema.ts';
import {sourceBlocksContext} from './blocks-source-database.ts';
const principal={id:'blocks-source-admin',permissions:['schema:read','schema:manage','content:read','content:read_drafts','content:create','content:edit_any','content:publish_any','content:delete_any'] as any};
// Source envelope/input adapter; actual storage, validation and mutation work
// through the native product lifecycle. No complete EmDashRuntime claim.
export function createTestRuntime(db:any){
 const mediaProviders=new Map<string,unknown>();
 const service=lifecycleService(sourceBlocksContext(db).database,principal);
 async function result(operation:()=>Promise<any>){try{const item=await operation();return {success:true,data:{item,_rev:withRevision(item)._rev}};}catch(error){return {success:false,error:{code:(error as any).code??'CONTENT_ERROR',message:(error as Error).message,details:(error as any).details}};}}
 function revision(collection:string,id:string,input:any){if(!input?._rev)return {};return {expected:precondition({collection,id,locale:input.locale??'en',_rev:input._rev})};}
 return {
  mediaProviders,
  handleContentCreate:(collection:string,input:any)=>result(()=>service.createContent({type:collection,...input})),
  handleContentGet:(collection:string,id:string)=>result(()=>service.getContent({type:collection,id})),
  handleContentUpdate:(collection:string,id:string,input:any)=>result(async()=>(await service.updateContent({type:collection,id,...input,...revision(collection,id,input)})).item),
  handleContentPublish:(collection:string,id:string)=>result(()=>service.publish({type:collection,id})),
  handleRevisionRestore:(revisionId:string,_authorId:string)=>result(()=>service.restoreRevision({revisionId})),
  handleContentDuplicate:(collection:string,id:string)=>result(()=>service.duplicateContent({type:collection,id}))
 };
}
