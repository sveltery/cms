// Original native acceptance requirement; zero copied source callback credit.
import {test,expect} from '../helpers/media-authenticated-browser';
import {PNG_4x4} from '../../parity/emdash/media/source-fixtures/image-fixtures';

test('crop creates real image bytes and a new persisted media item while preserving the original',async({admin,page})=>{
 await admin.goToMedia();
 await page.getByRole('button',{name:'Upload',exact:true}).click();
 const upload=page.getByRole('dialog',{name:'Upload media'});
 await upload.getByLabel('Browse files to upload').setInputFiles({name:'source.png',mimeType:'image/png',buffer:Buffer.from(PNG_4x4)});
 await expect(upload.getByText('Complete',{exact:true})).toBeVisible();
 await upload.getByRole('button',{name:'Done',exact:true}).click();
 const before=await page.request.get(new URL('/api/media',page.url()).href);expect(before.status()).toBe(200);
 const original=(await before.json()).data.items[0];expect(original.width).toBe(4);expect(original.height).toBe(4);
 await page.getByRole('button',{name:'source.png',exact:true}).click();
 const details=page.getByRole('dialog',{name:'Media details'});
 await expect(details.getByRole('button',{name:'Crop image',exact:true})).toBeVisible();
 await details.getByRole('button',{name:'Crop image',exact:true}).click();
 const crop=page.getByRole('dialog',{name:'Crop image',exact:true});
 await expect(crop.getByLabel('Crop output dimensions')).toHaveText('4 × 4');
 await crop.getByLabel('Crop aspect ratio').selectOption('freeform');
 await crop.getByLabel('Crop X',{exact:true}).fill('2');
 await crop.getByLabel('Crop Y',{exact:true}).fill('0');
 await crop.getByLabel('Crop width',{exact:true}).fill('2');
 await crop.getByLabel('Crop height',{exact:true}).fill('4');
 await expect(crop.getByLabel('Crop output dimensions')).toHaveText('2 × 4');
 await crop.getByRole('button',{name:'Create cropped copy',exact:true}).click();
 await expect(crop).not.toBeVisible();
 const after=await page.request.get(new URL('/api/media',page.url()).href);expect(after.status()).toBe(200);
 const items=(await after.json()).data.items;expect(items).toHaveLength(2);
 const unchanged=items.find((item:any)=>item.id===original.id);expect(unchanged.storageKey).toBe(original.storageKey);expect(unchanged.width).toBe(4);expect(unchanged.height).toBe(4);
 const copy=items.find((item:any)=>item.id!==original.id);expect(copy.filename).toBe('source-2x4.png');expect(copy.width).toBe(2);expect(copy.height).toBe(4);expect(copy.storageKey).not.toBe(original.storageKey);
 const originalBytes=await page.request.get(new URL(original.url,page.url()).href);expect(originalBytes.status()).toBe(200);expect(await originalBytes.body()).toEqual(Buffer.from(PNG_4x4));
 const copiedBytes=await page.request.get(new URL(copy.url,page.url()).href);expect(copiedBytes.status()).toBe(200);expect(copiedBytes.headers()['content-type']).toBe('image/png');
 const dimensions=await page.evaluate(async(url)=>{const response=await fetch(url);const bitmap=await createImageBitmap(await response.blob());try{return {width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}},copy.url);
 expect(dimensions).toEqual({width:2,height:4});
});
