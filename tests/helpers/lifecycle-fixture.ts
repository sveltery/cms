// Host setup only. Before lifecycle exists, missing capabilities return a failed
// source-shaped result, with the actual existing row retained for assertion-level
// diagnostics. No lifecycle implementation or simulated success lives here.
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { SchemaRegistry as Registry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

const databases = new WeakMap<object, CmsDatabase>();
export class SchemaRegistry extends Registry {
  constructor(db: object) { super(databases.get(db)!); }
}
export const principal = { id: 'author-1', permissions: [
  'schema:read', 'schema:manage', 'content:create', 'content:read',
  'content:read_drafts', 'content:edit_any', 'content:delete_any',
  'content:publish_own', 'content:publish_any'
] } as any;
const revision = (item: {version: number; updatedAt: string}) => Buffer.from(`${item.version}:${item.updatedAt}`).toString('base64');
function condition(token?: string) {
  if (token === undefined) return undefined;
  const decoded = Buffer.from(token, 'base64').toString();
  const split = decoded.indexOf(':');
  return { version: Number(decoded.slice(0, split)), updatedAt: decoded.slice(split + 1) };
}
export async function setupLifecycleFixture() {
  const database = openSqlite(':memory:');
  databases.set(database.db, database);
  await migrateCms(database);
  const registry = new Registry(database);
  for (const slug of ['posts', 'plain_posts', 'post']) {
    await registry.createCollection({ slug, label: slug, ...(slug === 'plain_posts' ? {supports: []} : {}) });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
  }
  const baseline = cmsService(database, principal);
  const modulePath = '../../src/lib/server/database/lifecycle/service.ts';
  let lifecycle: any;
  try { lifecycle = (await import(modulePath)).lifecycleService(database, principal); }
  catch (cause) {
    if (!(cause instanceof Error) || !('code' in cause) || cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  }
  const result = (item: any, extra = {}) => ({ success: true, data: {item, _rev: revision(item)}, ...extra });
  const existing = (type: string, id: string) => baseline.getDraft({type,id});
  async function invoke(name: string, type: string, id: string, input: any = {}) {
    try {
      if (!lifecycle?.[name]) {
        const item = await existing(type, id);
        return {success:false, data:{item,_rev:revision(item)},error:{code:'UNIMPLEMENTED'}};
      }
      const value = await lifecycle[name]({type,id,...input,expected:condition(input._rev)});
      return result(value.item ?? value, value.liveContentChanged === undefined ? {} : {liveContentChanged:value.liveContentChanged});
    } catch (cause: any) { return {success:false,error:{code:cause.code ?? 'ERROR',message:cause.message}}; }
  }
  const runtime = {
    async handleContentCreate(type: string, input: any) {
      try { return result(await (lifecycle ? lifecycle.createContent({type,...input}) : baseline.createDraft({type,...input}))); }
      catch (cause: any) { return {success:false,error:{code:cause.code ?? 'ERROR'}}; }
    },
    handleContentGet: (type: string, id: string) => lifecycle ? invoke('getContent',type,id) : existing(type,id).then(result),
    async handleContentUpdate(type: string, id: string, input: any) {
      if (lifecycle) return invoke('updateContent',type,id,input);
      try {
        const old = await existing(type,id);
        const item = await baseline.updateDraft({type,id,data:input.data ?? {},...(input.slug===undefined?{}:{slug:input.slug}),expected:condition(input._rev) ?? {version:old.version,updatedAt:old.updatedAt}});
        return result(item);
      } catch(cause:any) {return {success:false,error:{code:cause.code ?? 'ERROR'}};}
    },
    handleContentPublish: (type:string,id:string,input?:any) => invoke('publish',type,id,input),
    handleContentUnpublish: (type:string,id:string,input?:any) => invoke('unpublish',type,id,input),
    handleContentDiscardDraft: (type:string,id:string,input?:any) => invoke('discardDraft',type,id,input),
    async handleRevisionList(type:string,id:string) {
      if (!lifecycle) return {success:false,data:{items:[]},error:{code:'UNIMPLEMENTED'}};
      try {return {success:true,data:{items:await lifecycle.listRevisions({type,id})}};}
      catch(cause:any) {return {success:false,error:{code:cause.code ?? 'ERROR'}};}
    },
    async handleRevisionRestore(revisionId:string,authorId:string) {
      if(!lifecycle) return {success:false,error:{code:'UNIMPLEMENTED'}};
      try {const item=await lifecycle.restoreRevision({revisionId});return result(item.item ?? item);}
      catch(cause:any) {return {success:false,error:{code:cause.code ?? 'ERROR'}};}
    }
  };
  return {database,runtime};
}
