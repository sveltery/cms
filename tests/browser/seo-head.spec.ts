import {test,expect}from '@playwright/test';
import {createServer,type ViteDevServer}from 'vite';
import {svelte}from '@sveltejs/vite-plugin-svelte';
import {fileURLToPath}from 'node:url';
import {mkdtemp,rm}from 'node:fs/promises';
import {tmpdir}from 'node:os';
import {join}from 'node:path';

// Original native client-head fixture. No Source, persistence or plugin credit.
test('native head updates title, canonical, noindex and one JSON-LD graph reactively',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'cms-seo-head-vite-'));
 const root=fileURLToPath(new URL('../helpers/seo-head-client/',import.meta.url));
 const server:ViteDevServer=await createServer({configFile:false,root,cacheDir:directory,logLevel:'error',
  plugins:[svelte({configFile:false})],server:{host:'127.0.0.1',port:0,fs:{allow:[fileURLToPath(new URL('../../',import.meta.url))]}}});
 try{
  await server.listen();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls!.local[0]);
  await expect(page.getByRole('heading',{name:'Native SEO head fixture'})).toBeVisible();
  await expect(page).toHaveTitle('Initial | Site');
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content','Initial');
  await expect(page.locator('head meta[name="google-site-verification"]')).toHaveAttribute('content','g-token');
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('head script[type="application/ld+json"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Update page metadata'}).click();
  await expect(page).toHaveTitle('Changed | Site');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href','https://example.com/post/changed');
  await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content','Changed');
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
  await expect(page.locator('head script[type="application/ld+json"]')).toHaveCount(1);
  expect(await page.locator('head script[type="application/ld+json"]').evaluate(node=>JSON.parse(node.textContent!))).toMatchObject({headline:'Changed',url:'https://example.com/post/changed'});
  await page.getByRole('button',{name:'Update page metadata'}).click();
  await expect(page).toHaveTitle('Initial | Site');
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await server.close();await rm(directory,{recursive:true,force:true});}
});
