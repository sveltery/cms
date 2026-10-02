import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

const names = ['listSchemaCollections','getSchemaCollection','createSchemaCollection','updateSchemaCollection','addSchemaField'];
const denial = (result: any, status: number, code: string) => {
  assert.equal(result.type,'error'); assert.equal(result.status,status); assert.equal(result.error.code,code);
};
const expected = (c: any) => ({ collection:c.slug,version:String(c.version),updatedAt:c.updatedAt });
const refreshes = (data: any, name: string) => Object.entries(data.q ?? {}).filter(([key])=>key.includes(`/${name}/`)).map(([,value])=>value as any);

for (const target of ['Node','D1'] as const) {
  test(`${target}: registered schema forms create/edit/add, refresh consumers and survive storage/server restart`,{ timeout:60_000 },async()=>{
    const h = await schemaAdminRemotes(target);
    try {
      for (const name of names) assert.ok(h.ids.has(name),`registered ${name}`);
      const create = await h.mutate('createSchemaCollection',{ slug:'notes',label:'Notes',labelSingular:'Note',description:'Original' });
      assert.deepEqual(Object.keys(create._.result).sort(),['slug','updatedAt','version']);
      let c = await h.query('getSchemaCollection','notes'); assert.deepEqual(c.supports,['drafts','revisions']);
      assert.equal(refreshes(create,'listSchemaCollections')[0].v[0].label,'Notes');
      assert.equal(refreshes(create,'getEditorManifest')[0].v.collections.notes.label,'Notes');
      const edited = await h.mutate('updateSchemaCollection',{ ...expected(c),label:'Notebook',supports:'[]' });
      c = await h.query('getSchemaCollection','notes');
      assert.equal(c.label,'Notebook'); assert.equal(c.labelSingular,'Note'); assert.equal(c.description,'Original'); assert.deepEqual(c.supports,[]);
      assert.equal(edited._.result.version,1); assert.notEqual(edited._.result.updatedAt,create._.result.updatedAt);
      const partial = await h.mutate('updateSchemaCollection',{ ...expected(c),description:'' });
      c = await h.query('getSchemaCollection','notes'); assert.deepEqual(c.supports,[]); assert.equal(c.description,'');
      assert.equal(refreshes(partial,'listCollections')[0].v[0].label,'Notebook');
      const first = await h.mutate('addSchemaField',{ collection:'notes',expectedSchemaVersion:String(c.version),slug:'headline',label:'Headline',type:'string','b:required':'on',defaultValue:'Untitled',minLength:'1',maxLength:'100' });
      assert.deepEqual(first._.result,{ collection:'notes',slug:'headline' });
      c = await h.query('getSchemaCollection','notes'); assert.equal(c.version,2);
      assert.deepEqual(c.fields[0].validation,{ minLength:1,maxLength:100 }); assert.equal(c.fields[0].required,true); assert.equal(c.fields[0].defaultValue,'Untitled');
      await h.mutate('addSchemaField',{ collection:'notes',expectedSchemaVersion:String(c.version),slug:'detail',label:'Detail',type:'text',defaultValue:'' });
      const final = await h.query('getSchemaCollection','notes'); assert.equal(final.version,3); assert.equal(final.fields[1].defaultValue,'');
      const manifest = await h.query('getEditorManifest',undefined,'author');
      assert.equal(manifest.collections.notes.label,'Notebook'); assert.equal(manifest.collections.notes.fields.detail.kind,'richText');
      assert.equal((await h.query('listCollections'))[0].label,'Notebook');
      const content = await h.mutate('createContent',{ collection:'notes','data.headline':'Round trip','data.detail':'Persisted' },'author');
      const item = await h.query('getContent',{ collection:'notes',id:content._.result.id },'author');
      const snapshot = await h.snapshot(); await h.restart();
      assert.deepEqual(await h.query('getSchemaCollection','notes'),final); assert.deepEqual(await h.snapshot(),snapshot);
      assert.deepEqual(await h.query('getContent',{ collection:'notes',id:item.id },'author'),item);
      assert.deepEqual(await h.query('getEditorManifest',undefined,'author'),manifest);
    } finally { await h.close(); }
  });
  test(`${target}: schema validation, metadata/field conflicts and claims perform zero writes`,{ timeout:60_000 },async()=>{
    const h = await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection',{ slug:'notes',label:'Notes',supports:'[]' });
      const c = await h.query('getSchemaCollection','notes');
      const initial = await h.snapshot();
      for (const [name,input] of [
        ['createSchemaCollection',{ slug:'bad-slug',label:'Bad' }],
        ['createSchemaCollection',{ slug:'other',label:'Other',supports:'["preview"]' }],
        ['createSchemaCollection',{ slug:'other',label:'Other',principal:'admin' }],
        ['updateSchemaCollection',{ ...expected(c),version:'1e0',label:'Bad' }],
        ['updateSchemaCollection',{ ...expected(c),labelSingular:'' }],
        ['updateSchemaCollection',{ ...expected(c),id:'other',label:'Mismatch' }],
        ['updateSchemaCollection',{ ...expected(c),_rev:'opaque',label:'Content token' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',slug:'count',label:'Count',type:'integer' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',slug:'title',label:'Title',type:'string',minLength:'2',maxLength:'1' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',slug:'title',label:'Title',type:'string',_rev:'opaque' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',id:'other',slug:'title',label:'Title',type:'string' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',slug:'title',label:'Title',type:'string',minLength:'201' }],
        ['addSchemaField',{ collection:'notes',expectedSchemaVersion:'1',slug:'title',label:'Title',type:'string',defaultValue:'x'.repeat(201) }]
      ] as const) {
        const result = await h.remote(name,'admin',input);
        if (result.type === 'result') { const data = parse(result.data); assert.ok(data._.issues.length); assert.equal(data._.result,undefined); }
        else denial(result,400,'VALIDATION_ERROR');
        assert.deepEqual(await h.snapshot(),initial,`${name}: zero writes`);
      }
      await h.mutate('updateSchemaCollection',{ ...expected(c),label:'Winner' });
      const winner = await h.snapshot();
      denial(await h.remote('updateSchemaCollection','admin',{ ...expected(c),label:'Loser' }),409,'CONFLICT');
      assert.deepEqual(await h.snapshot(),winner);
      const current = await h.query('getSchemaCollection','notes');
      await h.mutate('addSchemaField',{ collection:'notes',expectedSchemaVersion:String(current.version),slug:'title',label:'Title',type:'string' });
      const fieldWinner = await h.snapshot();
      denial(await h.remote('addSchemaField','admin',{ collection:'notes',expectedSchemaVersion:String(current.version),slug:'other',label:'Other',type:'text' }),409,'CONFLICT');
      denial(await h.remote('updateSchemaCollection','admin',{ ...expected(current),label:'After stale schema' }),409,'CONFLICT');
      assert.deepEqual(await h.snapshot(),fieldWinner);
    } finally { await h.close(); }
  });
  test(`${target}: persisted role permission and explicit mutation gate precede schema access`,{ timeout:60_000 },async()=>{
    for (const enabled of [false,true]) {
      const h = await schemaAdminRemotes(target,enabled);
      try {
        await h.registry.createCollection({ slug:'notes',label:'Notes' });
        for (const path of ['/schema','/schema/notes']) {
          const response = await h.request(path,'admin'); assert.equal(response.status,200); const html = await response.text();
          if (enabled) assert.doesNotMatch(html,/<fieldset disabled(?:[\s=>])/); else assert.match(html,/<fieldset disabled(?:[\s=>])/);
        }
        const initial = await h.snapshot();
        h.probeStorage(); // Trusted auth still reads its session store; schema access throws.
        for (const session of [null,'author','editor'] as const) {
          const status = session ? 403 : 401; const code = session ? 'INSUFFICIENT_PERMISSIONS' : 'UNAUTHENTICATED';
          denial(await h.remote('createSchemaCollection',session,{ slug:'notes',label:'Notes' }),status,code);
          denial(await h.remote('updateSchemaCollection',session,{ collection:'missing',version:'1',updatedAt:'2026-01-01T00:00:00.000Z',label:'Notes' }),status,code);
          denial(await h.remote('addSchemaField',session,{ collection:'missing',expectedSchemaVersion:'1',slug:'title',label:'Title',type:'string' }),status,code);
        }
        denial(await h.remote('getSchemaCollection','author',undefined,'missing'),403,'INSUFFICIENT_PERMISSIONS');
        if (!enabled) {
          denial(await h.remote('createSchemaCollection','admin',{ slug:'notes',label:'Notes' }),503,'MUTATIONS_DISABLED');
          const native = await h.request(`/schema?/remote=${h.ids.get('createSchemaCollection')}`,'admin',{ method:'POST',headers:{ origin:h.origin,accept:'text/html' },body:new URLSearchParams({ slug:'notes',label:'Notes' }) });
          assert.equal(native.status,503);
        }
        assert.equal(h.storageReads,0,'denial and gate precede every schema database getter');
        if (enabled) {
          h.probeStorage('absent');
          denial(await h.remote('createSchemaCollection','admin',{ slug:'notes',label:'Notes' }),503,'NOT_CONFIGURED');
          assert.equal(h.storageReads,1,'permitted request checks configured storage');
        }
        assert.deepEqual(await h.snapshot(),initial);
      } finally { await h.close(); }
    }
  });
  test(`${target}: actual native HTML schema forms submit registered endpoints and enforce origin`,{ timeout:60_000 },async()=>{
    const h = await schemaAdminRemotes(target);
    try {
      const response = await h.request('/schema'); assert.equal(response.status,200); const html = await response.text();
      const action = html.match(/<form[^>]*action="([^"]+)"[^>]*>/); assert.ok(action,'route-owned native creation form');
      const url = new URL(action[1].replaceAll('&amp;','&'),`${h.origin}/schema`); assert.equal(url.searchParams.get('/remote'),h.ids.get('createSchemaCollection'));
      const native = await h.request(`${url.pathname}${url.search}`,'admin',{ method:'POST',headers:{ origin:h.origin,accept:'text/html' },body:new URLSearchParams({ slug:'notes',label:'Native Notes',supports:'[]' }) });
      assert.equal(native.status,200); assert.equal((await h.query('getSchemaCollection','notes')).label,'Native Notes');
      const detail = await h.request('/schema/notes'); assert.equal(detail.status,200); const detailHtml = await detail.text();
      const forms = [...detailHtml.matchAll(/<form[^>]*action="([^"]+)"[^>]*>/g)];
      for (const name of ['updateSchemaCollection','addSchemaField']) {
        const form = forms.find(form=>form[1].includes(h.ids.get(name)!)); assert.ok(form,`native ${name} registered form`);
        const action = new URL(form[1].replaceAll('&amp;','&'),`${h.origin}/schema/notes`);
        const c = await h.query('getSchemaCollection','notes');
        const input: Record<string,string> = name === 'updateSchemaCollection' ? { ...expected(c),label:'Native Edited' } : { collection:'notes',expectedSchemaVersion:String(c.version),slug:'native_text',label:'Native text',type:'text','b:required':'on',defaultValue:'Default text' };
        const result = await h.request(`${action.pathname}${action.search}`,'admin',{ method:'POST',headers:{ origin:h.origin,accept:'text/html' },body:new URLSearchParams(input) }); assert.equal(result.status,200);
      }
      const final = await h.query('getSchemaCollection','notes'); assert.equal(final.label,'Native Edited'); assert.equal(final.fields[0].slug,'native_text'); assert.equal(final.fields[0].required,true);
      const before = await h.snapshot();
      for (const name of ['createSchemaCollection','updateSchemaCollection','addSchemaField']) for (const origin of [undefined,'null','https://attacker.invalid']) {
        const result = await h.request(`/_app/remote/${h.ids.get(name)}`,'admin',{ method:'POST',headers:origin ? { origin } : {},body:new URLSearchParams({ slug:'attack',label:'Attack' }) }); assert.equal(result.status,403);
      }
      const cross = await h.request(`${url.pathname}${url.search}`,'admin',{ method:'POST',headers:{ origin:'https://attacker.invalid',accept:'text/html' },body:new URLSearchParams({ slug:'attack',label:'Attack' }) });
      assert.equal(cross.status,403); assert.deepEqual(await h.snapshot(),before);
    } finally { await h.close(); }
  });
}
