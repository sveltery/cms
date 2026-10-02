import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';

// Supplemental actual service contracts; source issue assertions are separately
// ported at the registered HTTP boundary by the content transport developer.
const principal:ServerPrincipal = { id: 'owner', permissions: ['content:create','content:read','content:read_drafts','content:edit_any'] };
async function fixture() {
  const database = openSqlite(':memory:'); await migrateCms(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({slug:'posts',label:'Posts'});
  await registry.createField('posts',{slug:'category',label:'Category',type:'select',validation:{options:['news','guide']}});
  await registry.createField('posts',{slug:'reading_minutes',label:'Reading time',type:'number',validation:{min:1,max:60}});
  await registry.createField('posts',{slug:'tags',label:'Tags',type:'multiSelect',validation:{options:['a','b']}});
  await registry.createField('posts',{slug:'image',label:'Image',type:'image'});
  await registry.createField('posts',{slug:'active',label:'Active',type:'boolean'});
  return {database,service:cmsService(database,principal)};
}
test('actual content service preserves arrays/media/numeric/boolean values through create/read/update',async () => {
  const {database,service}=await fixture();
  try {
    let entry: Awaited<ReturnType<typeof service.createDraft>> | undefined;
    await assert.doesNotReject(async () => {
      entry=await service.createDraft({type:'posts',data:{category:'news',reading_minutes:3,tags:['a'],image:{id:'media'},active:true}});
    });
    assert.ok(entry);
    const reread=await service.getDraft({type:'posts',id:entry.id});
    assert.deepEqual(reread.data,{category:'news',reading_minutes:3,tags:['a'],image:{id:'media'},active:1});
    const updated=await service.updateDraft({type:'posts',id:entry.id,expected:{version:reread.version,updatedAt:reread.updatedAt},data:{tags:['b'],active:0}});
    assert.deepEqual(updated.data.tags,['b']); assert.equal(updated.data.active,0);
  } finally {await database.close();}
});
test('actual content service reports every enum and numeric validation issue',async () => {
  const {database,service}=await fixture();
  try {
    await assert.rejects(() => service.createDraft({type:'posts',data:{category:'other',reading_minutes:99}}),cause => {
      const error=cause as {code?:string;details?:{issues:{path:string;code:string;maximum?:number}[]}};
      assert.equal(error.code,'VALIDATION_ERROR');
      assert.deepEqual(error.details?.issues.map(issue=>({path:issue.path,code:issue.code,maximum:issue.maximum})),[
        {path:'category',code:'invalid_value',maximum:undefined},
        {path:'reading_minutes',code:'too_big',maximum:60}
      ]); return true;
    });
  } finally {await database.close();}
});
test('pinned constructor omission bug is preserved at the actual content service',async()=>{
  const {database,service}=await fixture();
  try {
    await new SchemaRegistry(database).createField('posts',{slug:'constructor',label:'Constructor',type:'string'});
    await assert.rejects(()=>service.createDraft({type:'posts',data:{}}),cause=>{
      const error=cause as {details?:{issues:{path:string;code:string;message:string}[]}};
      assert.deepEqual(error.details?.issues,[{path:'constructor',code:'invalid_type',message:'Invalid input: expected string, received function'}]);return true;
    });
    assert.equal((await service.createDraft({type:'posts',data:{constructor:null}})).data.constructor,null);
    assert.equal((await service.createDraft({type:'posts',data:{constructor:'own key'}})).data.constructor,'own key');
  } finally {await database.close();}
});
