import assert from 'node:assert/strict';
import {test} from 'node:test';

// Original native availability requirements. These are not copied Source assertions.
const boundaries=[
 ['../src/lib/seo/meta.ts',['getSeoMeta','getContentSeo']],
 ['../src/lib/seo/contributions.ts',['generateBaseSeoContributions','generateSiteSeoContributions','applySeoPanelToPageContext']],
 ['../src/lib/seo/metadata.ts',['resolvePageMetadata','renderPageMetadata','safeJsonLdSerialize']],
 ['../src/lib/server/seo/panel.ts',['primeSeoPanel','peekSeoPanel']]
] as const;
for(const [path,names]of boundaries)test('native SEO API exists: '+path,async()=>{
 let product:Record<string,unknown>={};
 try{product=await import(path);}catch(error){
  if(!(error instanceof Error)||!('code'in error)||error.code!=='ERR_MODULE_NOT_FOUND')throw error;
 }
 for(const name of names)assert.equal(typeof product[name],'function',name);
});
