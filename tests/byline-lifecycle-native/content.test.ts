// Supplemental genuine Native lifecycle tests. Source families remain whole and immutable.
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {sql} from 'kysely';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {ordinaryContentService} from '../../src/lib/server/database/content-service.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {setI18nConfig} from '../../src/lib/server/menus/i18n-config.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';

let database:CmsDatabase;
let service:ReturnType<typeof lifecycleService>;
let ordinary:ReturnType<typeof ordinaryContentService>;
let repo:BylineRepository;
beforeEach(async()=>{
 database=await openBylineLifecycleStorage();await migrateCms(database);
 const registry=new SchemaRegistry(database);
 await registry.createCollection({slug:'post',label:'Posts'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 repo=new BylineRepository(database);service=lifecycleService(database,principal,{after:()=>{}});
 ordinary=ordinaryContentService(database,principal,{after:()=>{}});
});
afterEach(async()=>{setI18nConfig(null);await database.close();});
const input=(title='Credited')=>({type:'post',data:{title}});
const key=(item:{id:string;locale?:string|null})=>({type:'post',id:item.id,locale:item.locale??'en'});
const expected=(item:{version:number;updatedAt:string})=>({version:item.version,updatedAt:item.updatedAt});
async function writer(){return repo.create({slug:'writer',displayName:'Writer'});}
async function credits(id:string){return (await sql<{byline_id:string;sort_order:number;role_label:string|null}>`SELECT byline_id,sort_order,role_label FROM _cms_content_bylines WHERE content_id=${id} ORDER BY sort_order`.execute(database.db)).rows;}
describe('the sole Native content writer composes real byline credits',()=>{
 it('creates ordered credits and returns their primary pointer and role label',async()=>{
  const a=await writer();const b=await repo.create({slug:'editor',displayName:'Editor'});
  const item=await service.createContent({...input(),bylines:[{bylineId:b.id,roleLabel:'Editor'},{bylineId:a.id,roleLabel:'Writer'}]});
  expect(item.primaryBylineId).toBe(b.translationGroup);
  expect(item.bylines?.map(credit=>[credit.byline.id,credit.roleLabel])).toEqual([[b.id,'Editor'],[a.id,'Writer']]);
  expect(item.byline?.id).toBe(b.id);
  expect(await credits(item.id)).toEqual([{byline_id:b.translationGroup,sort_order:0,role_label:'Editor'},{byline_id:a.translationGroup,sort_order:1,role_label:'Writer'}]);
 });
 it('returns empty byline hydration on ordinary uncredited creates and reads',async()=>{
  const item=await service.createContent(input());expect(item.bylines).toEqual([]);expect(item.byline).toBeNull();
  expect((await service.getContent(key(item))).bylines).toEqual([]);
  expect((await ordinary.getContent(key(item))).bylines).toEqual([]);
 });
 it('hydrates credits on ordinary and lifecycle reads and preserves their ordering',async()=>{
  const a=await writer();const b=await repo.create({slug:'editor',displayName:'Editor'});
  const item=await service.createContent({...input(),bylines:[{bylineId:b.id},{bylineId:a.id}]});
  expect((await service.getContent(key(item))).bylines?.map(c=>c.byline.id)).toEqual([b.id,a.id]);
  expect((await ordinary.getContent(key(item))).bylines?.map(c=>c.byline.id)).toEqual([b.id,a.id]);
 });
 it('replaces and clears credits without treating an omitted selection as a clear',async()=>{
  const a=await writer();const b=await repo.create({slug:'editor',displayName:'Editor'});
  const item=await service.createContent({...input(),bylines:[{bylineId:a.id}]});
  const reordered=await service.updateContent({...key(item),expected:expected(item),bylines:[{bylineId:b.id},{bylineId:a.id}]});
  expect(reordered.item.bylines?.map(c=>c.byline.id)).toEqual([b.id,a.id]);expect(reordered.liveContentChanged).toBe(true);
  const unchanged=await service.updateContent({...key(item),expected:expected(reordered.item),slug:'renamed'});
  expect((await credits(item.id)).map(c=>c.byline_id)).toEqual([b.translationGroup,a.translationGroup]);
  const cleared=await service.updateContent({...key(item),expected:expected(unchanged.item),bylines:[]});
  expect(cleared.item.bylines).toEqual([]);expect(cleared.item.primaryBylineId).toBeNull();expect(await credits(item.id)).toEqual([]);
 });
 it('advances the existing revision token for byline-only updates',async()=>{
  const a=await writer();const item=await service.createContent(input());
  const update=await service.updateContent({...key(item),expected:expected(item),bylines:[{bylineId:a.id}]});
  expect(update.item.version).toBe(item.version+1);expect(update.item.primaryBylineId).toBe(a.translationGroup);
 });
 it('composes ordinary strict-object updates with the same byline writer',async()=>{
  const a=await writer();const item=await ordinary.createContent(input());
  const updated=await ordinary.updateContent({...key(item),expected:expected(item),bylines:[{bylineId:a.id,roleLabel:'Writer'}]});
  expect(updated.bylines?.[0]?.roleLabel).toBe('Writer');
 });
 it('stores translation-group ids and hydrates only the entry locale sibling',async()=>{
  const a=await writer();const fr=await repo.create({slug:'writer',displayName:'Auteur',translationOf:a.id,locale:'fr'});
  const item=await service.createContent({...input(),locale:'fr',bylines:[{bylineId:a.id},{bylineId:fr.id}]});
  expect(item.primaryBylineId).toBe(a.translationGroup);expect(item.bylines?.map(c=>c.byline.id)).toEqual([fr.id]);
  expect(await credits(item.id)).toHaveLength(1);
 });
 it('preserves an explicit-credit sentinel when no sibling exists in the entry locale',async()=>{
  const a=await writer();const item=await service.createContent({...input(),locale:'fr',bylines:[{bylineId:a.id}]});
  expect(item.primaryBylineId).toBe(a.translationGroup);expect(item.bylines).toEqual([]);expect(item.byline).toBeNull();
 });
 it('persists bylines as live metadata while field updates remain staged and discard keeps the credits',async()=>{
  const a=await writer();const item=await service.createContent(input('Initial'));
  const published=await service.publish({...key(item),expected:expected(item)});
  const update=await service.updateContent({...key(item),expected:expected(published),data:{title:'Staged'},bylines:[{bylineId:a.id}]});
  expect(update.item.data.title).toBe('Staged');expect(update.item.liveData?.title).toBe('Initial');expect(update.item.bylines?.[0]?.byline.id).toBe(a.id);
  const discarded=await service.discardDraft({...key(item),expected:expected(update.item)});
  expect(discarded.data.title).toBe('Initial');expect(discarded.primaryBylineId).toBe(a.translationGroup);expect((await credits(item.id))).toHaveLength(1);
 });
 it('rolls back the actual content insert when the already-tested credit trigger rejects a replacement',async()=>{
  const a=await writer();const b=await repo.create({slug:'editor',displayName:'Editor'});
  await sql.raw("CREATE TRIGGER reject_second_credit BEFORE INSERT ON _cms_content_bylines WHEN NEW.sort_order=1 BEGIN SELECT RAISE(ABORT,'original-byline-rollback'); END").execute(database.db);
  await expect(service.createContent({...input(),bylines:[{bylineId:a.id},{bylineId:b.id}]})).rejects.toThrow('original-byline-rollback');
  expect((await sql`SELECT id FROM ec_post`.execute(database.db)).rows).toEqual([]);expect((await sql`SELECT id FROM _cms_content_bylines`.execute(database.db)).rows).toEqual([]);
 });
 it('rolls back a live update and staged revision if credit insertion fails',async()=>{
  const a=await writer();const b=await repo.create({slug:'editor',displayName:'Editor'});
  const item=await service.createContent(input('Initial'));const published=await service.publish({...key(item),expected:expected(item)});
  await sql.raw("CREATE TRIGGER reject_second_credit BEFORE INSERT ON _cms_content_bylines WHEN NEW.sort_order=1 BEGIN SELECT RAISE(ABORT,'original-byline-rollback'); END").execute(database.db);
  await expect(service.updateContent({...key(item),expected:expected(published),data:{title:'Staged'},bylines:[{bylineId:a.id},{bylineId:b.id}]})).rejects.toThrow('original-byline-rollback');
  const current=await service.getContent(key(item));expect(current.data.title).toBe('Initial');expect(current.version).toBe(published.version);expect(current.draftRevisionId).toBeNull();
  expect((await sql`SELECT id FROM _cms_revisions WHERE entry_id=${item.id}`.execute(database.db)).rows).toHaveLength(1);
 });
});
