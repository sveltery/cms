// Host setup only. Before lifecycle exists, missing capabilities return a failed
// source-shaped result, with the actual existing row retained for assertion-level
// diagnostics. No lifecycle implementation or simulated success lives here.
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { SchemaRegistry as Registry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { sql } from 'kysely';
import { ulid } from 'ulidx';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';

const databases = new WeakMap<object, CmsDatabase>();
const contentRepositories = new WeakMap<object, any>();
const revisionRepositories = new WeakMap<object, any>();
export const deferred: Array<() => unknown | Promise<unknown>> = [];
export async function flushDeferred() { for (const task of deferred.splice(0)) await task(); }
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
export async function setupLifecycleFixture({ atomic = false } = {}) {
  const database = openSqlite(':memory:');
  databases.set(database.db, database);
  await migrateCms(database);
  const registry = new Registry(database);
  for (const slug of ['posts', 'plain_posts', 'post']) {
    await registry.createCollection({ slug, label: slug, ...(slug === 'plain_posts' ? {supports: []} : {}) });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
  }
  if (atomic) {
    // Source dialect setup includes a general-status content table. This is
    // fixture layout, not migration coverage; provider-5 upgrade is tested apart.
    const row = (await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE name = 'ec_post'`.execute(database.db)).rows[0];
    if (row.sql.includes("CHECK(status = 'draft')")) {
      const indexes = (await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE tbl_name = 'ec_post' AND type = 'index' AND sql IS NOT NULL`.execute(database.db)).rows;
      await database.atomicBatch([
        sql`DROP TABLE ec_post`.compile(database.db),
        sql.raw(row.sql.replace(" CHECK(status = 'draft')", '')).compile(database.db),
        ...indexes.map(row=>sql.raw(row.sql).compile(database.db))
      ]);
    }
    await registry.createField('post', {slug:'content',label:'Content',type:'portableText'});
  }
  // Only test seed/read helpers use this before provider 5 exists. Retention
  // assertions exercise the actual update handler, which has no revision save.
  const revisionsExist = (await sql`SELECT name FROM sqlite_master WHERE name = '_cms_revisions'`.execute(database.db)).rows.length;
  if (!revisionsExist) await sql`CREATE TABLE _cms_revisions (id TEXT PRIMARY KEY NOT NULL, collection TEXT NOT NULL,
    entry_id TEXT NOT NULL, data TEXT NOT NULL, author_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`.execute(database.db);
  const baseline = cmsService(database, principal);
  const modulePath = '../../src/lib/server/database/lifecycle/service.ts';
  let lifecycle: any;
  try { lifecycle = (await import(modulePath)).lifecycleService(database, principal, {after:(task:()=>unknown)=>deferred.push(task)}); }
  catch (cause) {
    if (!(cause instanceof Error) || !('code' in cause) || cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  }
  try {
    const contentPath = '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
    const revisionPath = '../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
    contentRepositories.set(database.db, new (await import(contentPath)).ContentRepository(database.db));
    revisionRepositories.set(database.db, new (await import(revisionPath)).RevisionRepository(database.db));
  } catch (cause) {
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

// Before product repositories exist these adapters expose existing draft CRUD
// and direct SQL fixture seeding. Unsupported publication retains the real row;
// the preserved rejection assertion fails because no promotion was attempted.
export class ContentRepository {
  private db: any;
  constructor(db: any) { this.db=db; if(contentRepositories.has(db))return contentRepositories.get(db); }
  private get product() { return contentRepositories.get(this.db); }
  async create(input:any) {
    if(this.product)return this.product.create(input);
    const {status,...draftInput}=input;
    const item=await new DraftRepository(databases.get(this.db)!).create(draftInput,principal.id);
    if(input.status)await sql`UPDATE ${sql.ref('ec_'+input.type)} SET status=${input.status} WHERE id=${item.id}`.execute(this.db);
    return this.findById(input.type,item.id);
  }
  async findById(type:string,id:string) {
    if(this.product)return this.product.findById(type,id);
    const item=await new DraftRepository(databases.get(this.db)!).findById(type,id);
    if(!item)return null;
    const row=(await sql<any>`SELECT * FROM ${sql.ref('ec_'+type)} WHERE id=${id}`.execute(this.db)).rows[0];
    return {...item,publishedAt:row.published_at,scheduledAt:row.scheduled_at,liveRevisionId:row.live_revision_id,draftRevisionId:row.draft_revision_id};
  }
  async findBySlugIncludingTrashed(type:string,slug:string) {
    if(this.product)return this.product.findBySlugIncludingTrashed(type,slug);
    return (await sql`SELECT * FROM ${sql.ref('ec_'+type)} WHERE slug=${slug}`.execute(this.db)).rows[0]??null;
  }
  async setDraftRevision(type:string,id:string,revisionId:string) {
    if(this.product)return this.product.setDraftRevision(type,id,revisionId);
    await sql`UPDATE ${sql.ref('ec_'+type)} SET draft_revision_id=${revisionId} WHERE id=${id}`.execute(this.db);
  }
  async update(type:string,id:string,input:any) {
    if(this.product)return this.product.update(type,id,input);
    const assignments=[];
    if(input.status!==undefined)assignments.push(sql`status=${input.status}`);
    if(input.scheduledAt!==undefined)assignments.push(sql`scheduled_at=${input.scheduledAt}`);
    if(assignments.length)await sql`UPDATE ${sql.ref('ec_'+type)} SET ${sql.join(assignments)} WHERE id=${id}`.execute(this.db);
    return this.findById(type,id);
  }
  async publish(type:string,id:string,...args:any[]) {
    return this.product ? this.product.publish(type,id,...args) : this.findById(type,id);
  }
  async replaceDraftRevision(type:string,id:string,revisionId:string,expected:any) {
    // Existing storage has no staging capability; current row remains unchanged.
    return this.product ? this.product.replaceDraftRevision(type,id,revisionId,expected) : false;
  }
}
export class RevisionRepository {
  private db:any;
  constructor(db:any) { this.db=db; if(revisionRepositories.has(db))return revisionRepositories.get(db); }
  private get product() { return revisionRepositories.get(this.db); }
  async create(input:any) {
    if(this.product)return this.product.create(input);
    const id=ulid();
    await sql`INSERT INTO _cms_revisions (id,collection,entry_id,data,author_id) VALUES (${id},${input.collection},${input.entryId},${JSON.stringify(input.data)},${input.authorId??null})`.execute(this.db);
    return this.findById(id);
  }
  async findById(id:string) {
    if(this.product)return this.product.findById(id);
    const row=(await sql<any>`SELECT * FROM _cms_revisions WHERE id=${id}`.execute(this.db)).rows[0];
    return row?{id:row.id,collection:row.collection,entryId:row.entry_id,data:JSON.parse(row.data),authorId:row.author_id,createdAt:row.created_at}:null;
  }
  async countByEntry(collection:string,entryId:string) {
    if(this.product)return this.product.countByEntry(collection,entryId);
    return Number((await sql<any>`SELECT count(id) as count FROM _cms_revisions WHERE collection=${collection} AND entry_id=${entryId}`.execute(this.db)).rows[0].count);
  }
  async deleteIfUnreferenced(collection:string,entryId:string,id:string) {
    if(this.product)return this.product.deleteIfUnreferenced(collection,entryId,id);
    const result=await sql`DELETE FROM _cms_revisions WHERE id=${id} AND NOT EXISTS (SELECT 1 FROM ${sql.ref('ec_'+collection)} WHERE live_revision_id=${id} OR draft_revision_id=${id})`.execute(this.db);
    return (result.numAffectedRows??0n)>0n;
  }
}
export const vi = {
  restoreAllMocks() {},
  spyOn(target:any,key:string) {const original=target[key];return {mockResolvedValueOnce(value:any) {
    target[key]=async(...args:any[])=>{target[key]=original;return value;}; return this;
  }};}
};
