import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,writeFile,rm}from 'node:fs/promises';
import {randomUUID}from 'node:crypto';
import {compile}from 'svelte/compiler';
import {render}from 'svelte/server';
import type {PublicPageContext,PageMetadataContribution,SeoSettings}from '../src/lib/seo/types.ts';

// Original native SSR requirements. No copied Source declaration credit.
async function renderHead(props:{page:PublicPageContext;contributions?:PageMetadataContribution[];siteSeo?:SeoSettings;defaultOgImage?:string|null}){
 const sourceUrl=new URL('../src/lib/seo/SeoHead.svelte',import.meta.url);
 const source=await readFile(sourceUrl,'utf8');
 const moduleUrl=new URL('./.seo-head-'+randomUUID()+'.js',sourceUrl);
 try{
  await writeFile(moduleUrl,compile(source,{filename:'SeoHead.svelte',generate:'server'}).js.code);
  const component=await import(moduleUrl.href);
  return render(component.default,{props}).head;
 }finally{await rm(moduleUrl,{force:true});}
}
const page:PublicPageContext={url:'https://example.com/post/hello',path:'/post/hello',locale:'en',kind:'content',pageType:'article',title:'Hello <World> | Site',pageTitle:'Hello <World>',description:'Description & details',canonical:'https://example.com/post/hello',image:null,siteName:'Site',articleMeta:{publishedTime:'2026-10-01T10:00:00.000Z'}};

test('native head renders the supplied document title and description safely',async()=>{
 const head=await renderHead({page});
 assert.match(head,/<title>Hello &lt;World&gt; \| Site<\/title>/);
 assert.match(head,/<meta name="description" content="Description &amp; details">/);
});
test('native head renders the canonical, noindex and Open Graph URL',async()=>{
 const head=await renderHead({page:{...page,seo:{robots:'noindex, nofollow'}}});
 assert.match(head,/<link rel="canonical" href="https:\/\/example.com\/post\/hello">/);
 assert.match(head,/<meta name="robots" content="noindex, nofollow">/);
 assert.match(head,/<meta property="og:url" content="https:\/\/example.com\/post\/hello">/);
});
test('native head keeps page title distinct from the suffixed document title',async()=>{
 const head=await renderHead({page});
 assert.match(head,/<meta property="og:title" content="Hello &lt;World&gt;">/);
 assert.match(head,/<meta name="twitter:title" content="Hello &lt;World&gt;">/);
});
test('native head renders configured verification and the default social image',async()=>{
 const head=await renderHead({page,siteSeo:{googleVerification:'g-token',bingVerification:'b-token'},defaultOgImage:'https://example.com/default.png'});
 assert.match(head,/<meta name="google-site-verification" content="g-token">/);
 assert.match(head,/<meta name="msvalidate.01" content="b-token">/);
 assert.match(head,/<meta property="og:image" content="https:\/\/example.com\/default.png">/);
 assert.match(head,/<meta name="twitter:card" content="summary_large_image">/);
});
test('native head applies supplied contribution precedence before base metadata',async()=>{
 const head=await renderHead({page,contributions:[{kind:'meta',name:'description',content:'Override'},{kind:'property',property:'og:title',content:'Override OG'}]});
 assert.match(head,/<meta name="description" content="Override">/);
 assert.equal((head.match(/name="description"/g)??[]).length,1);
 assert.match(head,/<meta property="og:title" content="Override OG">/);
});
test('native head embeds one safe JSON-LD script with the original structured values',async()=>{
 const title='</script><script>alert(1)</script>';
 const head=await renderHead({page:{...page,pageTitle:title}});
 assert.equal((head.match(/<script\b/g)??[]).length,1);
 const script=head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
 assert.ok(script);
 assert.equal(JSON.parse(script[1]).headline,title);
 assert.equal(JSON.parse(script[1]).url,page.canonical);
});
