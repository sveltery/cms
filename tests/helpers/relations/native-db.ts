import { describe } from 'vitest';
import { OperationNodeTransformer, type TableNode, type ColumnNode, type KyselyPlugin, type Kysely } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeSchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { registerRelationDatabase, requireRelationDatabase } from '../../../src/lib/server/relations/storage.ts';
import type { Database } from '../../../parity/emdash/relations-source/executable/packages/core/src/database/types.ts';

const names = new Map([['_emdash_relations','_cms_relations'],['_emdash_content_references','_cms_content_references'],['_emdash_collections','_cms_collections'],['_emdash_fields','_cms_fields'],['_emdash_revisions','_cms_revisions']]);
class NativeRelationNames extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const result = super.transformTable(node), target = !result.table.schema && names.get(result.table.identifier.name);
    return target ? {...result,table:{...result.table,identifier:{...result.table.identifier,name:target}}}:result;
  }
  protected override transformColumn(node: ColumnNode): ColumnNode {
    const result = super.transformColumn(node), target = names.get(result.column.name);
    return target ? {...result,column:{...result.column,name:target}}:result;
  }
}
const transformer = new NativeRelationNames();
const namespace: KyselyPlugin = { transformQuery({node}){return transformer.transformNode(node);}, async transformResult({result}){return result;} };
export interface DialectTestContext {db:Kysely<Database>;dialect:'sqlite'|'postgres'}
export const hasPgTestDatabase = (process.env.EMDASH_TEST_PG ?? '').length > 0;
export function describeEachDialect(name:string,fn:(dialect:'sqlite'|'postgres')=>void){
  const dialects:('sqlite'|'postgres')[]=['sqlite']; if(hasPgTestDatabase)dialects.push('postgres');
  for(const dialect of dialects)describe(`${name} [${dialect}]`,()=>fn(dialect));
}
export async function setupForDialect(dialect:'sqlite'|'postgres'):Promise<DialectTestContext>{
  if(dialect!=='sqlite')throw new Error('Original PostgreSQL fixture is unconfigured');
  const database=openSqlite(':memory:');await migrateCms(database);
  const db=database.db.withPlugin(namespace) as unknown as Kysely<Database>;
  registerRelationDatabase(database,db);return {db,dialect};
}
export async function setupForDialectWithCollections(dialect:'sqlite'|'postgres'):Promise<DialectTestContext>{
  const ctx=await setupForDialect(dialect),registry=new NativeSchemaRegistry(requireRelationDatabase(ctx.db));
  for(const slug of ['post','page']){
    await registry.createCollection({slug,label:slug==='post'?'Posts':'Pages',labelSingular:slug==='post'?'Post':'Page',supports:['revisions','drafts','preview']});
    await registry.createField(slug,{slug:'title',label:'Title',type:'string',required:true});
    await registry.createField(slug,{slug:'content',label:'Content',type:slug==='post'?'text':'portableText'});
  }
  return ctx;
}
export async function teardownForDialect(ctx:DialectTestContext|undefined){if(ctx)await requireRelationDatabase(ctx.db).close();}

/** Source constructor shape delegates every result to actual published Registry. */
export class SchemaRegistry {
  readonly registry: NativeSchemaRegistry;
  constructor(db:object){this.registry=new NativeSchemaRegistry(requireRelationDatabase(db as Kysely<any>));}
  createCollection(input:unknown){return this.registry.createCollection(input);}
  createField(collection:unknown,input:unknown){return this.registry.createField(collection,input);}
  getField(collection:unknown,field:unknown){return this.registry.getField(collection,field);}
  getCollection(collection:unknown){return this.registry.getCollection(collection);}
  getCollectionWithFields(collection:unknown){return this.registry.getCollectionWithFields(collection);}
  updateCollection(collection:unknown,input:unknown){return this.registry.updateCollection(collection,input);}
  deleteField(collection:unknown,field:unknown){return this.registry.deleteField(collection,field);}
}
