import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';

// Native Kit integration requirements, separate from unchanged source assertions.
const expected = (collection: any) => ({collection:collection.slug,version:String(collection.version),updatedAt:collection.updatedAt});

for (const target of ['Node','D1'] as const) {
  test(`${target}: complete native settings persist and collection deletion returns to the list`,{timeout:60_000},async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      const listHtml=await (await h.request('/schema')).text();
      for (const name of ['icon','group','routable','hasSeo','hidden','editLocking','commentsEnabled','listColumns','quickCreate']) {
        assert.match(listHtml,new RegExp(`name="${name}"`),`collection creation exposes ${name}`);
      }
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
      const action=`/schema/complete?/remote=${h.ids.get('deleteSchemaCollection')}/complete`;
      const deleted=await h.request(action,'admin',{method:'POST',redirect:'manual',headers:{origin:h.origin,accept:'text/html'},body:new URLSearchParams({...expected(c),id:'complete'})});
      assert.equal(deleted.status,303); assert.equal(deleted.headers.get('location'),'/schema');
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
      assert.equal(invalid.type,'result'); assert.ok(parse(invalid.data)._.issues.length);
      const denied=await h.remote('deleteSchemaField','author',{...expected(c),field:'a'});
      assert.equal(denied.status,403); assert.equal(denied.error.code,'INSUFFICIENT_PERMISSIONS');
      assert.deepEqual(await h.snapshot(),before);
      await h.mutate('deleteSchemaField',{...expected(c),field:'a',id:'first/a'});
      assert.deepEqual((await h.query('getSchemaCollection','first')).fields.map((field:any)=>field.slug),['b']);
    } finally {await h.close();}
  });
}
