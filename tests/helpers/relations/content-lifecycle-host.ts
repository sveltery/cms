// Framework transport only: original whole tests call the real canonical API
// and bounded content runtime on the existing controlled fixture principal.
import {sql,OperationNodeTransformer,ColumnNode,ValueListNode,ValueNode,type InsertQueryNode,type Kysely} from 'kysely';
import {setupForDialect as setupNative,teardownForDialect,describeEachDialect,SchemaRegistry} from './native-db.ts';
import {requireRelationDatabase,registerRelationDatabase} from '../../../src/lib/server/relations/storage.ts';
import {registerLifecycleDatabase} from '../../../src/lib/server/database/lifecycle/upstream/host.ts';
import {registerBylineDatabaseHandle} from '../../../src/lib/server/bylines/storage.ts';
import {canonicalSourceDatabase} from '../../../src/lib/server/canonical-storage/namespace.ts';
import {nativeContentApi} from '../../../src/lib/server/database/content-api.ts';
import {nativeContentRuntime} from '../../../src/lib/server/database/content-runtime.ts';
import {asInlineTransaction as sourceAsInlineTransaction} from '../../../parity/emdash/relations-source/executable/packages/core/tests/utils/inline-transaction.ts';
import {principal} from '../lifecycle-fixture.ts';
export {teardownForDialect,describeEachDialect,SchemaRegistry};
const fixturePrincipal={...principal,permissions:[...principal.permissions,'content:delete_permanent']} as typeof principal;
// Source field metadata has this exact existing SQL currentTimestamp DEFAULT;
// Native metadata requires the value. Only this fixture INSERT omission differs.
class SourceFieldDefault extends OperationNodeTransformer {
 protected override transformInsertQuery(node:InsertQueryNode):InsertQueryNode {
  const result=super.transformInsertQuery(node);
  if(result.into?.table.identifier.name!=='_cms_fields'||result.columns?.some(column=>column.column.name==='created_at')||result.values?.kind!=='ValuesNode')return result;
  return{...result,columns:[...(result.columns??[]),ColumnNode.create('created_at')],values:{...result.values,values:result.values.values.map(row=>ValueListNode.create([
   ...(row.kind==='PrimitiveValueListNode'?row.values.map(value=>ValueNode.create(value)):row.values),sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.toOperationNode()
  ]))}};
 }
}
const fieldDefault=new SourceFieldDefault();
function hostDerivedTransaction(db:Kysely<any>,actual:ReturnType<typeof requireRelationDatabase>):Kysely<any>{
 const hosted=new Proxy(db,{get(target,key){
  if(key==='transaction')return()=>{
   const builder=target.transaction();
   return new Proxy(builder,{get(transactionBuilder,method){
    if(method==='execute')return(callback:(trx:Kysely<any>)=>unknown)=>transactionBuilder.execute(async trx=>{
     const bound={...actual,db:trx};registerRelationDatabase(bound,trx);registerLifecycleDatabase(bound,{after:()=>{}});registerBylineDatabaseHandle(bound,trx);return callback(trx);
    });
    const value=Reflect.get(transactionBuilder,method);return typeof value==='function'?value.bind(transactionBuilder):value;
   }});
  };
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
 registerRelationDatabase(actual,hosted);registerLifecycleDatabase({...actual,db:hosted},{after:()=>{}});registerBylineDatabaseHandle(actual,hosted);return hosted;
}
export async function setupForDialect(dialect:'sqlite'|'postgres'){
 const ctx=await setupNative(dialect);const actual=requireRelationDatabase(ctx.db);
 const mapped=canonicalSourceDatabase({...actual,db:ctx.db}).withPlugin({transformQuery:({node})=>fieldDefault.transformNode(node),transformResult:async({result})=>result});
 registerRelationDatabase(actual,mapped);registerLifecycleDatabase({...actual,db:mapped},{after:()=>{}});registerBylineDatabaseHandle(actual,mapped as any);
 return{...ctx,db:hostDerivedTransaction(mapped,actual) as typeof ctx.db};
}
// Exact original Source helper body; association below only records its genuine
// derived proxy with the same canonical owner, without changing its behavior.
export function asInlineTransaction(db:Kysely<any>){const proxy=sourceAsInlineTransaction(db);const actual=requireRelationDatabase(db);registerRelationDatabase(actual,proxy);registerLifecycleDatabase({...actual,db:proxy},{after:()=>{}});registerBylineDatabaseHandle(actual,proxy);return proxy;}
function api(db:Kysely<any>){return nativeContentApi(requireRelationDatabase(db),fixturePrincipal,{after:()=>{}});}
export function createTestRuntime(db:Kysely<any>){return nativeContentRuntime(requireRelationDatabase(db),fixturePrincipal,{after:()=>{}});}
export function handleContentCreate(db:Kysely<any>,collection:string,body:any){return api(db).create(collection,body);}
export function handleContentGet(db:Kysely<any>,collection:string,id:string,locale?:string,options?:any){return api(db).get(collection,id,locale,options);}
export function handleContentUpdate(db:Kysely<any>,collection:string,id:string,body:any){return api(db).update(collection,id,body);}
export function handleContentPublish(db:Kysely<any>,collection:string,id:string,body?:any){return api(db).publish(collection,id,body);}
export function handleContentDuplicate(db:Kysely<any>,collection:string,id:string,authorId?:string){return api(db).duplicate(collection,id,authorId);}
export function handleContentDelete(db:Kysely<any>,collection:string,id:string,body?:any){return api(db).delete(collection,id,body);}
export function handleContentPermanentDelete(db:Kysely<any>,collection:string,id:string){return api(db).permanentDelete(collection,id);}
export function handleContentCompare(db:Kysely<any>,collection:string,id:string){return api(db).compare(collection,id);}
export function handleContentDiscardDraft(db:Kysely<any>,collection:string,id:string,body?:any){return api(db).discardDraft(collection,id,body);}
export function handleRevisionRestore(db:Kysely<any>,revisionId:string,authorId?:string){return api(db).restoreRevision(revisionId,authorId);}
