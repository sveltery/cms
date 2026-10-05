import assert from 'node:assert/strict';
import {test} from 'vitest';
import {historicalFeatureStorage} from '../helpers/canonical-feature-storage-original.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
import {GET} from '../../src/routes/sitemap-[collection].xml/+server.ts';
import {waitForDeferredTasks} from '../../src/lib/server/redirects/deferred-tasks.ts';

for(const mode of ['Node','raw D1'] as const)test(mode+': actual public sitemap uses final canonical storage and trusted runtime base path',async()=>{
 const fixture=await historicalFeatureStorage(mode);
 try{
  await migrateCms(fixture.database);
  await new SchemaRegistry(fixture.database).createCollection({slug:'post',label:'Posts',supports:['seo','drafts'],routable:true,urlPattern:'/posts/{slug}'});
  const service=lifecycleService(fixture.database,principal,{after:()=>{}});
  const visible=await service.createContent({type:'post',slug:'visible',data:{},seo:{noIndex:false}});
  const hidden=await service.createContent({type:'post',slug:'hidden',data:{},seo:{noIndex:true}});
  await service.publish({type:'post',id:visible.id});await service.publish({type:'post',id:hidden.id});
  const response=await GET({locals:{cms:{database:fixture.database},cmsRuntime:{publicOrigin:'https://example.com',basePath:'/docs',rpName:'Sveltery CMS'}},params:{collection:'post'},url:new URL('https://example.com/docs/sitemap-post.xml')} as any);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/xml; charset=utf-8');
  const xml=await response.text();
  assert.ok(xml.includes('<loc>https://example.com/docs/posts/visible</loc>'));
  assert.ok(!xml.includes('/posts/hidden'));
 }finally{await waitForDeferredTasks();await fixture.close();}
},90000);
