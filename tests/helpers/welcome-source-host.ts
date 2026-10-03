// Native storage/transport fixture for two complete source welcome callbacks.
// Source users is split across actual native authority/profiles; only its profile
// lookup failure is mapped. No caller identity is sent to a product endpoint.
import {schemaAdminRemotes} from './schema-admin-remotes.ts';
import {createFirstAdmin} from '../../src/lib/server/auth/identity-store.ts';
import {hashSessionToken} from '../../src/lib/server/auth/session.ts';
const hosts=new WeakMap<object,Awaited<ReturnType<typeof schemaAdminRemotes>>>();
export async function setupTestDatabase(){
 const h=await schemaAdminRemotes(process.env.CMS_WELCOME_SOURCE_TARGET==='D1'?'D1':'Node',true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};}});
 await h.database.db.deleteFrom('_cms_auth_sessions').execute();await h.database.db.deleteFrom('_cms_auth_users').execute();
 const db=new Proxy(h.database.db,{get(target,key){
  if(key==='schema')return new Proxy(target.schema,{get(schema,member){if(member==='dropTable')return (name:string)=>schema.dropTable(name==='users'?'_cms_auth_profiles':name);const value=Reflect.get(schema,member);return typeof value==='function'?value.bind(schema):value;}});
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});hosts.set(db,h);return db;
}
export const teardownTestDatabase=(db:object)=>hosts.get(db)!.close();
export class UserRepository{
 private readonly db:object;
 constructor(db:object){this.db=db;}
 async create(input:{email:string;name:string;role:'admin'}){
  const h=hosts.get(this.db)!,user=await createFirstAdmin(h.database,{email:input.email,name:input.name});if(!user)throw new Error('Native fixture first admin failed');
  await h.database.db.insertInto('_cms_auth_sessions').values({hash:(await hashSessionToken(h.tokens.admin))!,user_id:user.id,expires_at:Date.now()+600_000}).execute();return user;
 }
}
type Context={locals:{emdash:{db:object}};request?:Request;session?:unknown};
export const GET=(context:Context)=>hosts.get(context.locals.emdash.db)!.request('/api/auth/me');
export async function POST(context:Context){const h=hosts.get(context.locals.emdash.db)!;return h.request('/api/welcome','admin',{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:await context.request!.text()});}
export type {CmsTables as Database} from '../../src/lib/server/database/contract.ts';
