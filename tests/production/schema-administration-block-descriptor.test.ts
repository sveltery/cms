import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Early descriptor restrictions from complete immutable normalizeBlocksFieldValidation.
// No block type registry, active version, content migration or builder credit.
const cases: {name:string;create:Record<string,string>;update:Record<string,string>}[] = [
  {name:'required',create:{'b:required':'on'},update:{required:'true'}},
  {name:'unique',create:{'b:unique':'on'},update:{unique:'true'}},
  {name:'indexed',create:{'b:indexed':'on'},update:{indexed:'true',indexedMode:'set'}},
  {name:'searchable',create:{'b:searchable':'on'},update:{searchable:'true',searchableMode:'set'}},
  {name:'widget',create:{widget:''},update:{widget:'',widgetMode:'set'}},
  {name:'options',create:{optionsJson:'{}'},update:{optionsJson:'{}',optionsMode:'set'}},
  ...['2','null','[{}]','{}'].map(value=>({name:'default '+value,create:{defaultValueJson:value},update:{defaultValueJson:value,defaultValueMode:'set'}}))
];
for(const target of ['Node','D1'] as const) for(const kind of ['create','update'] as const) for(const entry of cases) {
  test(`${target}: registered blocks ${kind} rejects ${entry.name} before writes`,async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({slug:'posts',label:'Posts'});
      await h.registry.createField('posts',{slug:'body',label:'Body',type:'blocks',defaultValue:[]});
      const c=(await h.registry.getCollection('posts'))!;const before=await h.snapshot();
      const result=kind==='create'
        ? await h.remote('addSchemaField','admin',{collection:'posts',expectedSchemaVersion:String(c.version),slug:'extra',label:'Extra',type:'blocks',...entry.create})
        : await h.remote('updateSchemaFieldMetadata','admin',{collection:'posts',field:'body',...entry.update});
      assert.equal(result.error?.code,entry.name==='indexed'?'FIELD_NOT_INDEXABLE':'VALIDATION_ERROR');
      assert.equal(result.type,'error');assert.equal(result.status,entry.name==='indexed'?409:400);
      assert.deepEqual(await h.snapshot(),before,'rejection preserves registry, content DDL and guards');
    }finally{await h.close();}
  });
}
for(const target of ['Node','D1'] as const) test(`${target}: empty blocks defaults and absent or false flags remain accepted`,async()=>{
  const h=await schemaAdminRemotes(target);
  try {
    await h.registry.createCollection({slug:'posts',label:'Posts'});
    const c=(await h.registry.getCollection('posts'))!;
    await h.mutate('addSchemaField',{collection:'posts',expectedSchemaVersion:String(c.version),slug:'body',label:'Body',type:'blocks',defaultValueJson:'[]'});
    await h.mutate('updateSchemaFieldMetadata',{collection:'posts',field:'body',required:'false',unique:'false',indexed:'false',indexedMode:'set',searchable:'false',searchableMode:'set',defaultValueMode:'set',defaultValueJson:'[]'});
    const field=(await h.registry.getField('posts','body'))!;
    assert.deepEqual(field.defaultValue,[]);for(const key of ['required','unique','indexed','searchable'] as const) assert.equal(field[key],false);
    const current=(await h.registry.getCollection('posts'))!;
    await h.mutate('addSchemaField',{collection:'posts',expectedSchemaVersion:String(current.version),slug:'generic',label:'Generic',type:'json',defaultValueJson:'{"custom":true}',optionsJson:'{"custom":true}',widget:''});
    assert.deepEqual((await h.registry.getField('posts','generic'))!.defaultValue,{custom:true});
    assert.deepEqual((await h.registry.getField('posts','generic'))!.options,{custom:true});
  }finally{await h.close();}
});
for(const target of ['Node','D1'] as const) test(`${target}: actual native blocks creation omits inactive widgets and renders protected settings`,async()=>{
  const h=await schemaAdminRemotes(target);
  try {
    await h.registry.createCollection({slug:'posts',label:'Posts'});
    const html=await(await h.request('/schema/posts')).text();
    assert.match(html,/<select[^>]*name="widgetMode"/);
    const action=[...html.matchAll(/<form[^>]*action="([^"]+)"/g)].find(m=>m[1].includes(h.ids.get('addSchemaField')!))![1];
    const url=new URL(action.replaceAll('&amp;','&'),h.origin+'/schema/posts');
    const c=(await h.registry.getCollection('posts'))!;
    const response=await h.request(url.pathname+url.search,'admin',{method:'POST',headers:{origin:h.origin,accept:'text/html'},body:new URLSearchParams({
      collection:'posts',expectedSchemaVersion:String(c.version),slug:'body',label:'Body',type:'blocks',defaultValueFormat:'json',defaultValueJson:'[]',
      widgetMode:'keep',widget:'unselected custom widget',optionsMode:'keep',optionsJson:'{}'})});
    assert.equal(response.status,200);const field=await h.registry.getField('posts','body');assert.ok(field);
    assert.equal(field.widget,undefined);assert.equal(field.options,undefined);assert.deepEqual(field.defaultValue,[]);
    const after=await(await h.request('/schema/posts')).text();
    const settings=[...after.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find(m=>m[1].includes('>Settings for Body</legend>'))![1];
    for(const name of ['widgetMode','widget','indexedMode','indexed','searchableMode','searchable','optionsMode','optionsJson']) {
      const tag=settings.match(new RegExp(`<(?:input|select|textarea)[^>]*name="${name}"[^>]*>`))?.[0];
      assert.ok(tag && /\bdisabled\b/.test(tag),`${name} is disabled for blocks`);
    }
  }finally{await h.close();}
});
