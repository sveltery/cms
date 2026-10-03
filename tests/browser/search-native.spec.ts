// Original native UI integration coverage. The three upstream fixmes remain
// unchanged and excluded; these assertions add zero copied-source credit.
import {test,expect} from '../helpers/search-browser-fixture.ts';

test('public source widget searches actual published content and renders safe links',async({page,serverInfo})=>{
 await page.goto(serverInfo.baseUrl+'/search');
 const input=page.getByRole('searchbox',{name:'Search published content...'});
 await input.fill('First');
 const result=page.locator('.emdash-live-search-results-list a').filter({hasText:'First Post'});
 await expect(result).toBeVisible();
 await expect(result).toHaveAttribute('href','/posts/first-post');
 await input.fill('Draft');
 await expect(page.locator('.emdash-live-search-no-results')).toBeVisible();
 await expect(page.locator('.emdash-live-search-results-list')).not.toContainText('Draft Post');
});

test('native palette searches real content and opens the actual editor',async({admin,page})=>{
 await admin.devBypassAuth();await admin.goToDashboard();
 await page.keyboard.press('Control+k');
 await page.getByPlaceholder('Search pages and content...').fill('First');
 const entry=page.getByRole('option',{name:'First Post Posts',exact:true});
 await expect(entry).toBeVisible();await entry.click();
 await expect(page).toHaveURL(/\/content\/posts\//);
 await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('First Post');
});

test('native index controls rebuild and disable the real searchable collection',async({admin,page,serverInfo})=>{
 await admin.devBypassAuth();await page.goto(serverInfo.baseUrl+'/settings/search');
 const collection=page.locator('section').filter({has:page.getByRole('heading',{name:'Posts',exact:true})});
 await expect(collection).toContainText('Enabled');
 await collection.getByRole('button',{name:'Rebuild index'}).click();
 await expect(page.getByRole('status')).toContainText('Rebuilt posts:');
 await collection.getByRole('checkbox',{name:'Enable search'}).uncheck();
 await collection.getByRole('button',{name:'Save search configuration'}).click();
 await expect(page.getByRole('status')).toContainText('Search disabled for posts');
 const response=await page.request.get(serverInfo.baseUrl+'/api/search?q=First&collection=posts');
 expect(response.status()).toBe(200);expect((await response.json()).data.items).toEqual([]);
});

test('native palette confines focus and restores the invoking element',async({admin,page})=>{
 await admin.devBypassAuth();await admin.goToDashboard();
 const trigger=page.getByRole('link',{name:'Content',exact:true});await trigger.focus();
 await page.keyboard.press('Control+k');
 const input=page.getByPlaceholder('Search pages and content...');await expect(input).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(page.getByRole('button',{name:'Close Esc'})).toBeFocused();
 await page.keyboard.press('Tab');await expect(input).toBeFocused();
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
