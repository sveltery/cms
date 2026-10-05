// Supplemental canonical lifecycle coupling; immutable Source whole families are separate.
import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {sql} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
let database:ReturnType<typeof openSqlite>;
let service:ReturnType<typeof lifecycleService>;
let repo:BylineRepository;
beforeEach(async()=>{
 database=openSqlite(':memory:');await migrateCms(database);const registry=new SchemaRegistry(database);
 await registry.createCollection({slug:'post',label:'Posts'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 await registry.createField('post',{slug:'shared',label:'Shared',type:'string',translatable:false});
 repo=new BylineRepository(database);service=lifecycleService(database,principal,{after:()=>{}});
});
afterEach(()=>database.close());
const key=(id:string,locale='en')=>({type:'post',id,locale});
async function profile(){const en=await repo.create({slug:'writer',displayName:'Writer'});const fr=await repo.create({slug:'writer',displayName:'Auteur',locale:'fr',translationOf:en.id});return{en,fr};}
describe('byline copy through the one content lifecycle',()=>{
 it('inherits per-row credits and strict localized hydration when translationOf omits bylines',async()=>{
  const {en,fr}=await profile();const original=await service.createContent({type:'post',data:{title:'English',shared:'shared'},bylines:[{bylineId:en.id,roleLabel:'Writer'}]});
  const translated=await service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'French',shared:'override'}});
  expect(translated.translationGroup).toBe(original.translationGroup);expect(translated.data).toEqual({title:'French',shared:'shared'});
  expect(translated.primaryBylineId).toBe(en.translationGroup);expect(translated.bylines?.[0]?.byline.id).toBe(fr.id);expect(translated.bylines?.[0]?.roleLabel).toBe('Writer');
 });
 it('keeps explicit selections on a translation and treats an explicit empty selection as authoritative',async()=>{
  const {en}=await profile();const other=await repo.create({slug:'other',displayName:'Autre',locale:'fr'});
  const original=await service.createContent({type:'post',data:{title:'English'},bylines:[{bylineId:en.id}]});
  const translated=await service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'French'},bylines:[{bylineId:other.id}]});
  expect(translated.bylines?.[0]?.byline.id).toBe(other.id);
  const empty=await service.createContent({type:'post',locale:'de',translationOf:original.id,data:{title:'German'},bylines:[]});
  expect(empty.bylines).toEqual([]);expect(empty.primaryBylineId).toBeNull();
 });
 it('copies an unresolved locale credit sentinel without author fallback',async()=>{
  const en=await repo.create({slug:'writer',displayName:'Writer'});
  const original=await service.createContent({type:'post',data:{title:'English'},bylines:[{bylineId:en.id}]});
  const translated=await service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'French'}});
  expect(translated.primaryBylineId).toBe(en.translationGroup);expect(translated.bylines).toEqual([]);expect(translated.byline).toBeNull();
 });
 it('hydrates an explicitly unscoped list by each entry locale while keeping the default list scoped',async()=>{
  const {en,fr}=await profile();const original=await service.createContent({type:'post',data:{title:'English'},bylines:[{bylineId:en.id}]});
  const translated=await service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'French'}});
  const defaults=await service.listContent({type:'post'});expect(defaults.items.map(item=>item.id)).toEqual([original.id]);
  const all=await service.listContent({type:'post'},{allLocales:true});
  expect(all.items.find(item=>item.id===original.id)?.byline?.id).toBe(en.id);expect(all.items.find(item=>item.id===translated.id)?.byline?.id).toBe(fr.id);
 });
 it('refuses a second translation at the same locale without adding extra row or credit writes',async()=>{
  const {en}=await profile();const original=await service.createContent({type:'post',data:{title:'English'},bylines:[{bylineId:en.id}]});
  await service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'French'}});
  await expect(service.createContent({type:'post',locale:'fr',translationOf:original.id,data:{title:'Another'}})).rejects.toMatchObject({code:'CONFLICT'});
  expect((await sql`SELECT id FROM ec_post`.execute(database.db)).rows).toHaveLength(2);
  expect((await sql`SELECT id FROM _cms_content_bylines`.execute(database.db)).rows).toHaveLength(2);
 });
 it('duplicates live stored fields and ordered credits while creating its own group and draft state',async()=>{
  const {en}=await profile();const original=await service.createContent({type:'post',data:{title:'Story'},bylines:[{bylineId:en.id,roleLabel:'Writer'}]});
  const copied=await service.duplicateContent(key(original.id));
  expect(copied.id).not.toBe(original.id);expect(copied.translationGroup).toBe(copied.id);expect(copied.status).toBe('draft');expect(copied.data.title).toBe('Story (Copy)');expect(copied.slug).toBe('story-copy');expect(copied.bylines?.[0]?.roleLabel).toBe('Writer');
 });
 it('rolls back the duplicate row when its copied primary pointer fails',async()=>{
  const {en}=await profile();const original=await service.createContent({type:'post',data:{title:'Story'},bylines:[{bylineId:en.id}]});
  await sql`CREATE TRIGGER original_byline_copy_failure BEFORE UPDATE OF primary_byline_id ON ec_post WHEN NEW.slug='story-copy' BEGIN SELECT RAISE(ABORT,'original-copy-rollback'); END`.execute(database.db);
  await expect(service.duplicateContent(key(original.id))).rejects.toThrow('original-copy-rollback');
  expect((await sql`SELECT id FROM ec_post`.execute(database.db)).rows).toEqual([{id:original.id}]);expect((await sql`SELECT content_id FROM _cms_content_bylines`.execute(database.db)).rows).toEqual([{content_id:original.id}]);
 });
});
