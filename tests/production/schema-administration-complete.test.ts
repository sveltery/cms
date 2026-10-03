import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';

// Native Kit integration requirements, separate from unchanged source assertions.
const expected = (collection: any) => ({collection:collection.slug,version:String(collection.version),updatedAt:collection.updatedAt});

for (const target of ['Node','D1'] as const) {
  test(`${target}: native title selector and handler reject a raw unsupported field without changing its fallback projection`,{timeout:60_000},async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection',{slug:'posts',label:'Posts'});
      let c=await h.query('getSchemaCollection','posts');
      await h.mutate('addSchemaField',{collection:'posts',expectedSchemaVersion:String(c.version),slug:'future',label:'Future',type:'string'});
      await h.database.db.updateTable('_cms_fields').set({type:'future_field_type'}).where('slug','=','future').execute();
      c=await h.query('getSchemaCollection','posts');
      assert.equal(c.fields[0].type,'string'); assert.equal(c.fields[0].unsupportedType.type,'future_field_type');
      const html=await (await h.request('/schema/posts')).text();
      const selector=html.match(/<select[^>]*name="titleField"[^>]*>([\s\S]*?)<\/select>/)?.[1];
      assert.ok(selector,'registered native title field selector');
      assert.doesNotMatch(selector,/<option[^>]*value="future"/, 'unsupported raw type is not an eligible title alias');
      const before=await h.snapshot();
      const result=await h.remote('updateSchemaCollection','admin',{...expected(c),titleField:'future'});
      assert.equal(result.type,'error'); assert.equal(result.error.code,'INVALID_TITLE_FIELD');
      assert.deepEqual(await h.snapshot(),before);
    }finally{await h.close();}
  });
  test(`${target}: native field reorder preserves pinned partial duplicate and unknown-list behavior without metadata advancement`,{timeout:60_000},async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection',{slug:'posts',label:'Posts'});
      let c=await h.query('getSchemaCollection','posts');
      for(const slug of ['one','two']) {
        await h.mutate('addSchemaField',{collection:'posts',expectedSchemaVersion:String(c.version),slug,label:slug,type:'string'});
        c=await h.query('getSchemaCollection','posts');
      }
      const {fields:_fields,...before}=c;
      for(const [order,sorts] of [[['two'],[0,0]],[['one','one'],[1,0]],[['missing'],[1,0]]] as const) {
        await h.mutate('reorderSchemaFields',{...expected(c),id:'posts',fields:JSON.stringify(order)});
        const {fields,...metadata}=await h.query('getSchemaCollection','posts');
        assert.deepEqual(metadata,before,'field order does not consume collection metadata revisions');
        assert.deepEqual(['one','two'].map(slug=>fields.find((field:any)=>field.slug===slug).sortOrder),sorts);
      }
    }finally{await h.close();}
  });
  test(`${target}: complete native settings persist and collection deletion returns to the list`,{timeout:60_000},async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      const listHtml=await (await h.request('/schema')).text();
      for (const name of ['icon','group','routable','hasSeo','hidden','editLocking','commentsEnabled','listColumns','quickCreate']) {
        assert.match(listHtml,new RegExp(`name="${name}"`),`collection creation exposes ${name}`);
      }
      assert.equal(listHtml.match(/<textarea[^>]*name="listColumns"[^>]*>([\s\S]*?)<\/textarea>/)?.[1],'[]','native list-column textarea contains the default JSON');
      await h.mutate('createSchemaCollection',{slug:'complete',label:'Complete',icon:'book',group:'Editorial',routable:'false',hasSeo:'true',hidden:'true',editLocking:'false',commentsEnabled:'true',listColumns:'[]',quickCreate:'false'});
      let c=await h.query('getSchemaCollection','complete');
      await h.mutate('addSchemaField',{collection:c.slug,expectedSchemaVersion:String(c.version),slug:'priority',label:'Priority',type:'integer',defaultValueJson:'2',validationJson:'{"min":0,"max":10}',optionsJson:'{"helpText":"Rank"}',widget:'number',translatable:'false'});
      c=await h.query('getSchemaCollection','complete');
      assert.equal(c.fields[0].translatable,false);
      await h.mutate('updateSchemaFieldMetadata',{collection:c.slug,field:'priority',defaultValueJson:'3',validationJson:'{"min":1,"max":20}',optionsJson:'{"helpText":"Updated rank"}',widget:'slider',indexed:'true',searchable:'false'});
      await h.mutate('updateSchemaCollection',{...expected(c),commentsModeration:'first_time',commentsClosedAfterDays:'10',commentsAutoApproveUsers:'false'});
      c=await h.query('getSchemaCollection','complete');
      assert.equal(c.fields[0].defaultValue,3); assert.deepEqual(c.fields[0].validation,{min:1,max:20});
      assert.deepEqual(c.fields[0].options,{helpText:'Updated rank'}); assert.equal(c.fields[0].widget,'slider');
      assert.equal(c.fields[0].indexed,true); assert.equal(c.commentsModeration,'first_time');
      assert.equal(c.commentsClosedAfterDays,10); assert.equal(c.commentsAutoApproveUsers,false);
      const before=await h.snapshot(); await h.restart(); assert.deepEqual(await h.snapshot(),before);
      assert.deepEqual(await h.query('getSchemaCollection','complete'),c);
      const html=await (await h.request('/schema/complete')).text();
      for (const name of ['typeMode','widgetMode','defaultValueMode','validationMode','optionsMode','indexedMode','searchableMode','translatableMode']) {
        assert.match(html,new RegExp(`name="${name}"`),`settings expose native ${name}`);
      }
      assert.equal(html.match(/<textarea[^>]*name="defaultValueJson"[^>]*>([\s\S]*?)<\/textarea>/)?.[1],'3','native default textarea contains its stored value');
      const form=[...html.matchAll(/<form[^>]*action="([^"]+)"/g)].find(match=>match[1].includes(h.ids.get('deleteSchemaCollection')!));
      assert.ok(form,'registered native deletion form');
      const action=new URL(form[1].replaceAll('&amp;','&'),h.origin+'/schema/complete');
      const deleted=await h.request(action.pathname+action.search,'admin',{method:'POST',redirect:'manual',headers:{origin:h.origin,accept:'text/html'},body:new URLSearchParams({...expected(c),id:'complete'})});
      assert.equal(deleted.status,303);
      assert.equal(new URL(deleted.headers.get('location')!,h.origin+'/schema/complete').pathname,'/schema');
      assert.equal((await h.query('listSchemaCollections')).length,0);
      assert.equal((await h.request('/schema')).status,200);
    } finally {await h.close();}
  });
  test(`${target}: field and collection ordering retain native preconditions and deny claims`,{timeout:60_000},async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      for (const slug of ['first','second']) await h.mutate('createSchemaCollection',{slug,label:slug});
      let c=await h.query('getSchemaCollection','first');
      for (const slug of ['a','b']) {
        await h.mutate('addSchemaField',{collection:c.slug,expectedSchemaVersion:String(c.version),slug,label:slug,type:'string'});
        c=await h.query('getSchemaCollection','first');
      }
      await h.mutate('reorderSchemaFields',{...expected(c),fields:'["b","a"]',id:'first'});
      assert.deepEqual((await h.query('getSchemaCollection','first')).fields.map((field:any)=>field.slug),['b','a']);
      const snapshots=(await h.query('listSchemaCollections')).map(({slug,version,updatedAt}:any)=>({slug,version,updatedAt}));
      await h.mutate('reorderSchemaCollections',{slugs:'["second","first"]',expected:JSON.stringify(snapshots)});
      assert.deepEqual((await h.query('listSchemaCollections')).map((collection:any)=>collection.slug),['second','first']);
      const stale=await h.remote('deleteSchemaField','admin',{...expected(c),field:'a',id:'first/a'});
      assert.equal(stale.type,'error'); assert.equal(stale.status,409); assert.equal(stale.error.code,'CONFLICT');
      c=await h.query('getSchemaCollection','first');
      const before=await h.snapshot();
      const invalid=await h.remote('deleteSchemaField','admin',{...expected(c),field:'a',id:'first/b'});
      assert.equal(invalid.type,'result'); assert.ok(Array.isArray(parse(invalid.data)._.issues),'mismatched form produces native validation issues');
      const denied=await h.remote('deleteSchemaField','author',{...expected(c),field:'a'});
      assert.equal(denied.status,403); assert.equal(denied.error.code,'INSUFFICIENT_PERMISSIONS');
      assert.deepEqual(await h.snapshot(),before);
      await h.mutate('deleteSchemaField',{...expected(c),field:'a',id:'first/a'});
      assert.deepEqual((await h.query('getSchemaCollection','first')).fields.map((field:any)=>field.slug),['b']);
    } finally {await h.close();}
  });
}
