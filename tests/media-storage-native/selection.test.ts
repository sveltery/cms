// Original native hosting contracts; no copied Source or live S3 deployment credit.
import {beforeEach,expect,it} from 'vitest';
import type {RequestEvent} from '@sveltejs/kit';
import {requestMediaStorage} from '../../src/lib/server/media/storage.ts';
import {LocalStorage} from '../../src/lib/server/media/source/storage/local.ts';
import {S3Storage} from '../../src/lib/server/media/source/storage/s3.ts';
import {env} from '../helpers/media-hosting-env.ts';

const syntheticS3={S3_ENDPOINT:'https://storage.example.test',S3_BUCKET:'fixture-media',S3_ACCESS_KEY_ID:'fixture-key',S3_SECRET_ACCESS_KEY:'fixture-secret',S3_REGION:'us-east-1',S3_PUBLIC_URL:'https://assets.example.test'};
const event=()=>({locals:{cmsRuntime:{basePath:'/cms'}}} as unknown as RequestEvent);
beforeEach(()=>{for(const key of Object.keys(env))delete env[key];});

it('uses explicitly configured S3 storage before the inferred Node media directory',async()=>{
 Object.assign(env,syntheticS3,{SVELTERY_DATABASE_PATH:'/tmp/cms-fixture/database.sqlite'});
 const storage=await requestMediaStorage(event());
 expect(storage).toBeInstanceOf(S3Storage);expect(storage?.getPublicUrl('photo.png')).toBe('https://assets.example.test/photo.png');
});
it('reports invalid explicit S3 configuration instead of silently choosing the inferred directory',async()=>{
 Object.assign(env,syntheticS3,{S3_ENDPOINT:'ftp://storage.example.test',SVELTERY_DATABASE_PATH:'/tmp/cms-fixture/database.sqlite'});
 await expect(requestMediaStorage(event())).rejects.toMatchObject({code:'MISSING_S3_CONFIG'});
});
it('retains an explicitly configured local directory when S3 settings are also present',async()=>{
 Object.assign(env,syntheticS3,{SVELTERY_DATABASE_PATH:'/tmp/cms-fixture/database.sqlite',SVELTERY_MEDIA_DIRECTORY:'/tmp/cms-fixture/explicit-media'});
 const storage=await requestMediaStorage(event());
 expect(storage).toBeInstanceOf(LocalStorage);expect(storage?.getPublicUrl('photo.png')).toBe('/cms/_emdash/api/media/file/photo.png');
});
it('retains adjacent local storage when no explicit storage is configured',async()=>{
 env.SVELTERY_DATABASE_PATH='/tmp/cms-fixture/database.sqlite';
 const storage=await requestMediaStorage(event());
 expect(storage).toBeInstanceOf(LocalStorage);expect(storage?.getPublicUrl('photo.png')).toBe('/cms/_emdash/api/media/file/photo.png');
});
it('constructs the complete Source S3 adapter when no local default applies',async()=>{
 Object.assign(env,syntheticS3);
 const storage=await requestMediaStorage(event());expect(storage).toBeInstanceOf(S3Storage);expect(storage?.getPublicUrl('photo.png')).toBe('https://assets.example.test/photo.png');
});
it('leaves storage unavailable when no host storage configuration exists',async()=>{
 expect(await requestMediaStorage(event())).toBeUndefined();
});
