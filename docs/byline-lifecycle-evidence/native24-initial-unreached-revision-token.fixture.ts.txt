// Supplemental Native transport cases over actual canonical content writes.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {ordinaryContentService} from '../../src/lib/server/database/content-service.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {createInput,updateInput,precondition,withRevision} from '../../src/lib/server/content/schema.ts';
import {parse} from '../../src/lib/server/database/validation.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';
let database:ReturnType<typeof openSqlite>;
beforeEach(async()=>{database=openSqlite(':memory:');await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'post',label:'Posts'});await registry.createField('post',{slug:'title',label:'Title',type:'string'});});
afterEach(async()=>{await database.close();});
it('creates real ordered credits from enhanced-form JSON byline selections',async()=>{
 const byline=await new BylineRepository(database).create({slug:'author',displayName:'Author'});
 const {collection,...input}=parse(createInput,{collection:'post',data:{title:'Form story'},bylines:JSON.stringify([{bylineId:byline.id,roleLabel:'Writer'}])});
 const item=await ordinaryContentService(database,principal).createContent({type:collection,...input});
 expect(item.bylines?.map(credit=>[credit.byline.id,credit.roleLabel])).toEqual([[byline.id,'Writer']]);
});
it('clears credits through a byline-only enhanced form without staging field data',async()=>{
 const byline=await new BylineRepository(database).create({slug:'author',displayName:'Author'});const service=ordinaryContentService(database,principal);
 const item=await service.createContent({type:'post',data:{title:'Form story'},bylines:[{bylineId:byline.id}]});
 const {_rev}=withRevision(item);const parsed=parse(updateInput,{collection:'post',id:item.id,locale:item.locale,_rev,bylines:'[]'});
 const {collection,...input}=parsed;
 const updated=await service.updateContent({type:collection,...input,expected:precondition(parsed)});
 expect(updated.bylines).toEqual([]);expect(updated.draftRevisionId).toBeNull();expect(updated.data.title).toBe('Form story');
});
