import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Supplemental compiled/native collection controls; no copied source credit.
async function submit(h: Awaited<ReturnType<typeof schemaAdminRemotes>>, page: string, remote: string, data: Record<string,string>) {
  const html = await (await h.request(page)).text();
  const action = [...html.matchAll(/<form[^>]*action="([^"]+)"/g)].find(m => m[1].includes(h.ids.get(remote)!))![1];
  const url = new URL(action.replaceAll('&amp;', '&'), h.origin + page);
  return h.request(url.pathname + url.search, 'admin', { method:'POST', headers:{origin:h.origin,accept:'text/html'},body:new URLSearchParams(data) });
}
for (const target of ['Node','D1'] as const) {
  for (const page of ['/schema','/schema/posts']) {
    test(`${target}: ${page} renders submitted native supports and optional metadata controls`, async () => {
      const h=await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({slug:'posts',label:'Posts',supports:['preview','seo'],labelSingular:'Post',description:'Existing'});
        const html=await (await h.request(page)).text();
        const form=[...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find(m=>m[1].includes(page==='/schema'?'>Create collection</legend>':'>Collection metadata</legend>'))![1];
        assert.match(form,/<select[^>]*name="supportsMode"/, 'Supports is an actual submitted native mode');
        for (const key of ['Drafts','Revisions','Preview','Scheduling','Search','Seo']) {
          assert.match(form,new RegExp(`<input[^>]*name="b:support${key}"[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*name="b:support${key}"`),`${key} is operable in SSR`);
        }
        assert.match(form,/<select[^>]*name="labelSingularMode"/);
        assert.match(form,/<select[^>]*name="descriptionMode"/);
        assert.ok(!/\bdisabled\b/.test(form.match(/<input[^>]*name="labelSingular"[^>]*>/)![0]));
        assert.ok(!/\bdisabled\b/.test(form.match(/<textarea[^>]*name="description"[^>]*>/)![0]));
        if(page!=='/schema') assert.match(form,/<input[^>]*checked[^>]*name="b:supportPreview"|<input[^>]*name="b:supportPreview"[^>]*checked/,'existing flags are checked without an effect');
      } finally {await h.close();}
    });
  }
  test(`${target}: actual native collection submissions set, clear and retain supports and optional metadata`,async()=>{
    const h=await schemaAdminRemotes(target);
    try {
      const response=await submit(h,'/schema','createSchemaCollection',{slug:'posts',label:'Posts',supportsMode:'set',
        'b:supportPreview':'on','b:supportScheduling':'on','b:supportSearch':'on','b:supportSeo':'on',
        labelSingularMode:'set',labelSingular:'Post',descriptionMode:'set',description:'Native creation'});
      assert.equal(response.status,200);
      let c=await h.registry.getCollection('posts');
      assert.ok(c,'the actual native create handler persists selected supports');
      assert.deepEqual(c.supports,['preview','scheduling','search','seo']);
      assert.equal(c.labelSingular,'Post');assert.equal(c.description,'Native creation');
      let result=await submit(h,'/schema/posts','updateSchemaCollection',{collection:'posts',version:String(c.version),updatedAt:c.updatedAt,
        supportsMode:'set',labelSingularMode:'keep',labelSingular:'Ignored',descriptionMode:'keep',description:'Ignored'});
      assert.equal(result.status,200);c=await h.registry.getCollection('posts');assert.ok(c);
      assert.deepEqual(c.supports,[]);assert.equal(c.labelSingular,'Post');assert.equal(c.description,'Native creation');
      result=await submit(h,'/schema/posts','updateSchemaCollection',{collection:'posts',version:String(c.version),updatedAt:c.updatedAt,
        supportsMode:'keep','b:supportDrafts':'on',supports:'abandoned invalid JSON',labelSingularMode:'set',labelSingular:'Native post',descriptionMode:'set',description:''});
      assert.equal(result.status,200);c=await h.registry.getCollection('posts');assert.ok(c);
      assert.deepEqual(c.supports,[]);assert.equal(c.labelSingular,'Native post');assert.equal(c.description,'');
      await h.mutate('createSchemaCollection',{slug:'legacy',label:'Legacy',supports:'["drafts"]'});
      assert.deepEqual((await h.registry.getCollection('legacy'))!.supports,['drafts'],'direct JSON without modes retains the old wire contract');
      await h.mutate('createSchemaCollection',{slug:'defaults',label:'Defaults',supportsMode:'keep','b:supportSeo':'on'});
      assert.deepEqual((await h.registry.getCollection('defaults'))!.supports,['drafts','revisions'],'keep retains domain defaults');
    }finally{await h.close();}
  });
}
