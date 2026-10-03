import type { RequestEvent } from '@sveltejs/kit';
import type { Storage } from './source/storage/types.ts';
import { env } from '$env/dynamic/private';

/** Every selector comes from trusted hosting configuration, never request data. */
export async function requestMediaStorage(event:RequestEvent):Promise<Storage|undefined> {
  const host=event.platform?.env;
  const setting=(name:string)=>env[name] ?? (typeof host?.[name]==='string' ? host[name] as string:undefined);
  const r2Name=setting('SVELTERY_R2_BINDING');
  const bucket=host?.[r2Name ?? 'CMS_MEDIA'];
  if(bucket && typeof bucket==='object' && 'get' in bucket && 'put' in bucket) {
    const {R2Storage}=await import('./r2.ts');
    return new R2Storage(bucket as import('@cloudflare/workers-types').R2Bucket,setting('SVELTERY_MEDIA_PUBLIC_URL'));
  }
  const explicitDirectory=setting('SVELTERY_MEDIA_DIRECTORY');
  if(explicitDirectory) {
    const {LocalStorage}=await import('./source/storage/local.ts');
    return new LocalStorage({directory:explicitDirectory,baseUrl:`${event.locals.cmsRuntime?.basePath ?? ''}/_emdash/api/media/file`});
  }
  const endpoint=setting('S3_ENDPOINT');
  if(endpoint) {
    const {createStorage}=await import('./source/storage/s3.ts');
    return createStorage({endpoint,bucket:setting('S3_BUCKET'),accessKeyId:setting('S3_ACCESS_KEY_ID'),secretAccessKey:setting('S3_SECRET_ACCESS_KEY'),region:setting('S3_REGION'),publicUrl:setting('S3_PUBLIC_URL')});
  }
  // An adjacent directory is a hosting default, after explicit storage settings.
  const databasePath=setting('SVELTERY_DATABASE_PATH');
  if(databasePath && databasePath!==':memory:') {
    const path=await import('node:path');
    const {LocalStorage}=await import('./source/storage/local.ts');
    return new LocalStorage({directory:path.join(path.dirname(databasePath),'media'),baseUrl:`${event.locals.cmsRuntime?.basePath ?? ''}/_emdash/api/media/file`});
  }
  return undefined;
}
