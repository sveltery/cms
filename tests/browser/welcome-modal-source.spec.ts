// Complete immutable EmDash1.1.0 source callback; native page/query fixture only.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {test as base,expect} from '@playwright/test';
import {stringify} from 'devalue';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {webauthnCredential} from '../helpers/webauthn-credential';
const ADMIN_ROOT_PATTERN=/\/_emdash\/admin\/?$/;
const CURRENT_USER_PATTERN="**/_emdash/api/auth/me";
const LONG_FIRST_NAME="Alexanderthegreatestname";
const MAX_LINE_BOX_OVERLAP_RATIO=0.1;
const test=base.extend({page:async({page},use)=>{
 const h=await passkeyRuntime('Node');
 const adapted=new Proxy(page,{get(target,key){
  if(key==='route')return async(pattern,callback)=>{
   await page.route(pattern===CURRENT_USER_PATTERN?`**/_app/remote/${h.ids.getCurrentUser}`:pattern,route=>callback(new Proxy(route,{get(original,member){
    if(member==='fulfill')return async(options)=>{const body=JSON.parse(options.body);return original.fulfill({...options,body:JSON.stringify({type:'result',data:stringify({_:body.data})})});};
    const value=Reflect.get(original,member);return typeof value==='function'?value.bind(original):value;
   }})));
  };
  if(key==='goto')return async(url,options)=>{
   if(url.startsWith('/_emdash/api/setup/dev-bypass')){
    const credential=webauthnCredential(h.origin),post=(path,body)=>page.request.post(h.origin+path,{headers:{origin:h.origin},data:body});
    let response=await post('/api/setup/admin',{email:'welcome@example.com',name:'Welcome User'});expect(response.status()).toBe(200);let body=await response.json();
    response=await post('/api/setup/admin/verify',{credential:credential.registration(body.data.options.challenge)});expect(response.status()).toBe(200);
    response=await post('/api/auth/passkey/options',{});expect(response.status()).toBe(200);body=await response.json();
    response=await post('/api/auth/passkey/verify',{credential:credential.assertion(body.data.options.challenge)});expect(response.status()).toBe(200);
    return page.goto(h.origin+'/dashboard',options);
   }return page.goto(url,options);
  };
  if(key==='waitForURL')return (pattern,options)=>page.waitForURL(pattern===ADMIN_ROOT_PATTERN?/\/dashboard\/?$/:pattern,options);
  if(key==='waitForSelector')return (selector,options)=>page.waitForSelector(selector==='astro-island:not([ssr])'?'[data-native-dashboard=true]':selector,options);
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
 try{await use(adapted);}finally{await h.close();}
}});
test("wrapped welcome title lines do not collide", async ({ page }) => {
	await page.route(CURRENT_USER_PATTERN, async (route) => {
		if (route.request().method() !== "GET") {
			await route.continue();
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				success: true,
				data: {
					id: "welcome-test-user",
					email: "welcome-test@emdash.local",
					name: LONG_FIRST_NAME,
					role: 50,
					isFirstLogin: true,
				},
			}),
		});
	});

	await page.goto("/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin");
	await page.waitForURL(ADMIN_ROOT_PATTERN, { timeout: 30_000 });
	await page.waitForSelector("astro-island:not([ssr])", { timeout: 30_000 });

	const title = page.getByRole("heading", {
		name: `Welcome to EmDash, ${LONG_FIRST_NAME}!`,
	});
	await expect(title).toBeVisible({ timeout: 30_000 });

	const lineRects = await title.evaluate((element) => {
		const range = document.createRange();
		range.selectNodeContents(element);
		return Array.from(range.getClientRects(), ({ top, bottom, height }) => ({
			top,
			bottom,
			height,
		}));
	});

	expect(lineRects.length).toBeGreaterThanOrEqual(2);
	for (let i = 0; i < lineRects.length - 1; i++) {
		const currentLine = lineRects[i]!;
		const nextLine = lineRects[i + 1]!;
		const overlap = Math.max(0, currentLine.bottom - nextLine.top);
		expect(overlap / currentLine.height).toBeLessThanOrEqual(MAX_LINE_BOX_OVERLAP_RATIO);
	}
});
