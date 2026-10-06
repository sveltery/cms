// Original ordinary native acceptance; zero copied Source or provider credit.
import {test,expect} from '../helpers/media-authenticated-browser';

// Real 100ms mono PCM WAV. The browser must decode the stored file's metadata.
const recording=Buffer.alloc(44+800*2);
recording.write('RIFF',0);recording.writeUInt32LE(recording.length-8,4);recording.write('WAVE',8);
recording.write('fmt ',12);recording.writeUInt32LE(16,16);recording.writeUInt16LE(1,20);
recording.writeUInt16LE(1,22);recording.writeUInt32LE(8000,24);recording.writeUInt32LE(16000,28);
recording.writeUInt16LE(2,32);recording.writeUInt16LE(16,34);recording.write('data',36);recording.writeUInt32LE(recording.length-44,40);

test('uploaded audio previews the actual stored bytes and decodes its duration',async({admin,page})=>{
 await admin.goToMedia();await page.getByRole('button',{name:'Upload',exact:true}).click();
 const upload=page.getByRole('dialog',{name:'Upload media'});
 await upload.getByLabel('Browse files to upload').setInputFiles({name:'recording.wav',mimeType:'audio/wav',buffer:recording});
 await expect(upload.getByText('Complete',{exact:true})).toBeVisible();await upload.getByRole('button',{name:'Done',exact:true}).click();
 const listed=await page.request.get(new URL('/api/media',page.url()).href);expect(listed.status()).toBe(200);
 const items=(await listed.json()).data.items;expect(items).toHaveLength(1);expect(items[0].mimeType).toBe('audio/wav');
 await page.getByRole('button',{name:'recording.wav',exact:true}).click();
 const audio=page.getByRole('dialog',{name:'Media details'}).locator('audio');
 await expect(audio).toBeVisible();await expect(audio).toHaveAttribute('src',items[0].url);await expect(audio).toHaveAttribute('controls','');
 await expect.poll(()=>audio.evaluate(element=>(element as HTMLAudioElement).duration)).toBeCloseTo(0.1,5);
 const asset=await page.request.get(new URL(items[0].url,page.url()).href);expect(asset.status()).toBe(200);expect(await asset.body()).toEqual(recording);
});
