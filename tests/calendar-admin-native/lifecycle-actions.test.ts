import { afterEach,describe,expect,it } from 'vitest';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { principal } from '../helpers/lifecycle-fixture.ts';
const closers:Array<()=>Promise<void>>=[];
afterEach(async()=>{for(const close of closers.splice(0))await close();});
async function fixture(target:'Node'|'D1') {
  const storage=await schemaAdminStorage(target);closers.push(storage.close);
  await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
  await registry.createCollection({slug:'posts',label:'Posts'});
  await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
  const service=lifecycleService(storage.database,principal,{after:()=>{}});
  const item=await service.createContent({type:'posts',slug:'launch',data:{title:'Launch'}});
  return {service,item};
}
for(const target of ['Node','D1'] as const)describe(`${target} actual calendar lifecycle actions`,()=>{
  it('schedules and removes a draft schedule through the sole repository',async()=>{
    const {service,item}=await fixture(target);expect(typeof service.schedule).toBe('function');
    const scheduled=await service.schedule({type:'posts',id:item.id,locale:'en',scheduledAt:'2030-10-20T09:00:00.000Z'});
    expect(scheduled.status).toBe('scheduled');expect(scheduled.scheduledAt).toBe('2030-10-20T09:00:00.000Z');
    const removed=await service.unschedule({type:'posts',id:item.id,locale:'en'});
    expect(removed.status).toBe('draft');expect(removed.scheduledAt).toBeNull();expect(removed.data.title).toBe('Launch');
  });
  it('keeps the published version and pending draft when scheduling is removed',async()=>{
    const {service,item}=await fixture(target);expect(typeof service.schedule).toBe('function');
    const live=await service.publish({type:'posts',id:item.id,locale:'en'});
    await service.updateContent({type:'posts',id:item.id,locale:'en',data:{title:'Changed'}});
    const scheduled=await service.schedule({type:'posts',id:item.id,locale:'en',scheduledAt:'2030-10-20T09:00:00.000Z'});
    expect(scheduled.status).toBe('published');expect(scheduled.liveRevisionId).toBe(live.liveRevisionId);expect(scheduled.draftRevisionId).not.toBeNull();
    const removed=await service.unschedule({type:'posts',id:item.id,locale:'en'});
    expect(removed.status).toBe('published');expect(removed.draftRevisionId).toBe(scheduled.draftRevisionId);expect(removed.scheduledAt).toBeNull();
  });
  it('retains the existing precondition conflict and does not change storage',async()=>{
    const {service,item}=await fixture(target);expect(typeof service.schedule).toBe('function');
    await expect(service.schedule({type:'posts',id:item.id,locale:'en',scheduledAt:'2030-10-20T09:00:00.000Z',expected:{version:-1,updatedAt:item.updatedAt}})).rejects.toMatchObject({code:'CONFLICT'});
    expect((await service.getContent({type:'posts',id:item.id,locale:'en'})).scheduledAt).toBeNull();
  });
  it('rejects past scheduling with the published datetime validator',async()=>{
    const {service,item}=await fixture(target);expect(typeof service.schedule).toBe('function');
    await expect(service.schedule({type:'posts',id:item.id,locale:'en',scheduledAt:'2020-10-20T09:00:00.000Z'})).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    expect((await service.getContent({type:'posts',id:item.id,locale:'en'})).status).toBe('draft');
  });
});
