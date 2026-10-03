// Original native acceptance requirement; zero copied source callback credit.
import {test,expect} from '../helpers/media-authenticated-browser';
import {PNG_4x4} from '../../parity/emdash/media/source-fixtures/image-fixtures';
// Exact 1x1 replacement bytes from the complete pinned MediaDetailPanel callback.
const replacementPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test('replacement updates real image bytes on the same media item and keeps details open',async({admin,page})=>{
 await admin.goToMedia();await page.getByRole('button',{name:'Upload',exact:true}).click();
 const upload=page.getByRole('dialog',{name:'Upload media'});
 await upload.getByLabel('Browse files to upload').setInputFiles({name:'original.png',mimeType:'image/png',buffer:Buffer.from(PNG_4x4)});
 await expect(upload.getByText('Complete',{exact:true})).toBeVisible();await upload.getByRole('button',{name:'Done',exact:true}).click();
 const initial=await page.request.get(new URL('/api/media',page.url()).href);expect(initial.status()).toBe(200);const original=(await initial.json()).data.items[0];expect(original.width).toBe(4);expect(original.height).toBe(4);
 await page.getByRole('button',{name:'original.png',exact:true}).click();const details=page.getByRole('dialog',{name:'Media details'});
 await details.getByLabel('Alt text',{exact:true}).fill('Preserved alt text');await details.getByRole('button',{name:'Save changes',exact:true}).click();await expect(details.getByText('Media details saved',{exact:true})).toBeVisible();
 await expect(details.getByRole('button',{name:'Replace image',exact:true})).toBeVisible();
 await details.getByLabel('Choose replacement image',{exact:true}).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:replacementPng});
 const confirmation=page.getByRole('alertdialog',{name:'Replace original image?'});await expect(confirmation).toBeVisible();
 await confirmation.getByRole('button',{name:'Replace image',exact:true}).click();await expect(confirmation).not.toBeVisible();await expect(details).toBeVisible();await expect(details.getByText('Image replaced.',{exact:true})).toBeVisible();
 const after=await page.request.get(new URL('/api/media',page.url()).href);expect(after.status()).toBe(200);const items=(await after.json()).data.items;expect(items).toHaveLength(1);
 const refreshed=items[0];expect(refreshed.id).toBe(original.id);expect(refreshed.storageKey).toBe(original.storageKey);expect(refreshed.width).toBe(1);expect(refreshed.height).toBe(1);expect(refreshed.alt).toBe('Preserved alt text');expect(refreshed.focalX).toBeNull();expect(refreshed.focalY).toBeNull();
 const bytes=await page.request.get(new URL(refreshed.url,page.url()).href);expect(bytes.status()).toBe(200);expect(await bytes.body()).toEqual(replacementPng);
});
