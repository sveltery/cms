// Supplemental real owned SQLite fixture. No protected HTTP, credentials or sessions.
import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {sql} from 'kysely';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {ordinaryContentService} from '../../src/lib/server/database/content-service.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
let database:CmsDatabase;
let service:ReturnType<typeof lifecycleService>;
let ordinary:ReturnType<typeof ordinaryContentService>;
let repo:BylineRepository;
beforeEach(async()=>{
 database=await openBylineLifecycleStorage();await migrateCms(database);const registry=new SchemaRegistry(database);
 for(const slug of ['post','page']){await registry.createCollection({slug,label:slug});await registry.createField(slug,{slug:'title',label:'Title',type:'string'});}
 const admin={...principal,permissions:[...principal.permissions,'content:delete_permanent']};
 service=lifecycleService(database,admin,{after:()=>{}});ordinary=ordinaryContentService(database,admin,{after:()=>{}});repo=new BylineRepository(database);
});
afterEach(()=>database.close());
const key=(item:{id:string;locale?:string|null})=>({type:'post',id:item.id,locale:item.locale??'en'});
async function credited(){const profile=await repo.create({slug:'writer',displayName:'Writer'});return service.createContent({type:'post',data:{title:'Credited'},bylines:[{bylineId:profile.id}]});}
async function trash(item:{id:string;locale?:string|null;version:number;updatedAt:string}){await ordinary.deleteContent({...key(item),expected:{version:item.version,updatedAt:item.updatedAt}});}
async function creditRows(id:string){return(await sql`SELECT id FROM _cms_content_bylines WHERE content_id=${id}`.execute(database.db)).rows;}
describe('permanent deletion owns only the purged row credits',()=>{
 it('removes credits and the trashed content row in one actual owner batch',async()=>{
  const item=await credited();await trash(item);await service.permanentDeleteContent(key(item));
  expect(await creditRows(item.id)).toEqual([]);expect((await sql`SELECT id FROM ec_post WHERE id=${item.id}`.execute(database.db)).rows).toEqual([]);
 });
 it('refuses a live row before changing any of its credit or content data',async()=>{
  const item=await credited();await expect(service.permanentDeleteContent(key(item))).rejects.toMatchObject({code:'NOT_FOUND'});
  expect(await creditRows(item.id)).toHaveLength(1);expect((await service.getContent(key(item))).primaryBylineId).toBe(item.primaryBylineId);
 });
 it('keeps a sibling translation credits while purging the requested row',async()=>{
  const item=await credited();const translated=await service.createContent({type:'post',locale:'fr',translationOf:item.id,data:{title:'French'}});
  await trash(item);await service.permanentDeleteContent(key(item));
  expect(await creditRows(item.id)).toEqual([]);expect(await creditRows(translated.id)).toHaveLength(1);expect((await service.getContent(key(translated))).primaryBylineId).toBe(item.primaryBylineId);
 });
 it('rolls back the real content delete if the credit cleanup fails',async()=>{
  const item=await credited();await trash(item);
  await sql`CREATE TRIGGER original_byline_deletion_failure BEFORE DELETE ON _cms_content_bylines BEGIN SELECT RAISE(ABORT,'original-delete-rollback'); END`.execute(database.db);
  await expect(service.permanentDeleteContent(key(item))).rejects.toThrow('original-delete-rollback');
  expect(await creditRows(item.id)).toHaveLength(1);expect((await sql`SELECT id FROM ec_post WHERE id=${item.id} AND deleted_at IS NOT NULL`.execute(database.db)).rows).toEqual([{id:item.id}]);
 });
});
