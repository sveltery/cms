// Literal Source witness only. Native parity and Source body causal credit are zero.
import { writeFileSync } from 'node:fs';
import { asyncD1StorageFor } from '../async-d1-storage.ts';
const fixture=await asyncD1StorageFor('media-usage-maintenance-literal-source');
// This is the real Miniflare binding, including its genuine withSession method.
// The existing raw HTTP subset is deliberately not substituted for this binding.
const actual=await fixture.runtime.getD1Database('DB');
const receipts:unknown[]=[];
const statements=new WeakMap<object,{sql:string;parameters:readonly unknown[]}>();
const actualStatements=new WeakMap<object,object>();
let sequence=0;
function statement(target:any,query:{sql:string;parameters:readonly unknown[]},mode:string):any {
  const observed=new Proxy(target,{get(current,key){
    if(key==='bind')return(...parameters:unknown[])=>statement(current.bind(...parameters),{sql:query.sql,parameters},mode);
    if(['all','first','run','raw'].includes(String(key)))return async(...args:unknown[])=>{
      const result=await current[key](...args);
      receipts.push({sequence:sequence++,mode,operation:String(key),queries:[query],result});
      return result;
    };
    const member=Reflect.get(current,key,current);return typeof member==='function'?member.bind(current):member;
  }});
  statements.set(observed,query);actualStatements.set(observed,target);return observed;
}
function binding(target:any,mode:string):any {
  return new Proxy(target,{get(current,key){
    if(key==='prepare')return(sql:string)=>statement(current.prepare(sql),{sql,parameters:[]},mode);
    if(key==='batch')return async(input:object[])=>{
      const queries=input.map(value=>statements.get(value));
      if(queries.some(value=>value===undefined))throw new Error('Reference batch must retain its actual observed statements');
      const result=await current.batch(input.map(value=>actualStatements.get(value)!));
      receipts.push({sequence:sequence++,mode,operation:'batch',queries,result});return result;
    };
    if(key==='withSession')return(...args:unknown[])=>binding(current.withSession(...args),'session');
    const member=Reflect.get(current,key,current);return typeof member==='function'?member.bind(current):member;
  }});
}
// BOTH cloudflare:test and cloudflare:workers resolve this exact object.
export const env={DB:binding(actual,'raw')};
export async function closeReferenceWorkerdFixture() {
  writeFileSync('/tmp/media-usage-maintenance-literal-source-workerd-receipts.json',JSON.stringify({
    referenceOnly:true,nativeParityCredit:0,actualMiniflareBinding:true,actualSessions:true,
    sharedCloudflareEnvObject:true,sqlOrResultRewrites:false,receipts},null,2)+'\n');
  await fixture.runtime.dispose();
}
