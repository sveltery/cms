// Internal server-owned control metadata for CmsDatabase.atomicBatch only.
// Ordinary Kysely executeQuery is not a dynamic operation executor.
import type { CompiledQuery, QueryResult } from 'kysely';
import { CmsError } from './contract.ts';
type NextQueries = (rows:readonly unknown[])=>readonly CompiledQuery[];
const marker='/* sveltery:atomic-query-loop */';
interface Loop { sql:string; parameters:readonly unknown[]; next:NextQueries }
// Compiled-query wrappers may shallow-copy the envelope while retaining its
// immutable Kysely operation node. Serialized/recompiled nodes are refused.
const loops=new WeakMap<object,Loop>();

export function atomicQueryLoop(query:CompiledQuery,next:NextQueries):CompiledQuery {
  const operation=Object.freeze({...query,sql:query.sql+'\n'+marker});
  loops.set(operation.query,{sql:operation.sql,parameters:operation.parameters,next});
  return operation;
}
function loopFor(query:CompiledQuery):Loop|undefined {
  const loop=loops.get(query.query);
  if(!loop&&!query.sql.includes(marker))return undefined;
  if(!loop||query.sql!==loop.sql||query.parameters.length!==loop.parameters.length||
    query.parameters.some((value,index)=>value!==loop.parameters[index])) {
    throw new CmsError('MIGRATION_REQUIRED','Dynamic atomic query metadata was lost or modified');
  }
  return loop;
}
export function assertExecutableAtomicQueries(queries:readonly CompiledQuery[]) {
  for(const query of queries)loopFor(query);
}
/** Runs only inside the existing synchronous Node transaction and mutex. */
export function executeAtomicQueryLoop(query:CompiledQuery,execute:(query:CompiledQuery)=>QueryResult<unknown>):QueryResult<unknown> {
  const loop=loopFor(query);
  if(!loop)return execute(query);
  while(true) {
    const result=execute(query);
    if(!result.rows.length)return result;
    for(const statement of loop.next(result.rows))execute(statement);
  }
}
export function assertStaticAtomicQueries(queries:readonly CompiledQuery[]) {
  if(queries.some(query=>loopFor(query)))throw new CmsError('MIGRATION_REQUIRED',
    'This adapter cannot execute a dynamic query loop atomically');
}
