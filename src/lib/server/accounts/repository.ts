// EmDash 1.1.0 user-administration projection adapted to native split identity tables.
// Source packages/auth/src/adapters/kysely.ts at913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// MIT, Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {sql} from 'kysely';
import {ulid} from 'ulidx';
import {identityAdapter,identityDb} from '../auth/identity-store.ts';
import type {CmsDatabase} from '../database/contract.ts';
import type {RoleLevel,User} from '../auth/vendor/types.ts';
export interface AdminUser {
 id:string;email:string;name:string|null;avatarUrl:string|null;role:RoleLevel;emailVerified:boolean;disabled:boolean;
 createdAt:string;updatedAt:string;lastLogin:string|null;credentialCount:number;
}
export interface AdminUserDetail extends AdminUser {
 credentials:{id:string;name:string|null;deviceType:string;createdAt:string;lastUsedAt:string}[];
}
export class AccountError extends Error {
 constructor(readonly code:string,message:string,readonly status:number){super(message);this.name='AccountError';}
}
/** Explicit allowlist keeps custom identity metadata out of administrator transport receipts. */
function adminProjection(user:User,lastLogin:Date|null,credentialCount:number):AdminUser {
 return {id:user.id,email:user.email,name:user.name,avatarUrl:user.avatarUrl,role:user.role,
  emailVerified:user.emailVerified,disabled:user.disabled,createdAt:user.createdAt.toISOString(),
  updatedAt:user.updatedAt.toISOString(),lastLogin:lastLogin?.toISOString()??null,credentialCount};
}
export function accountsRepository(database:CmsDatabase){
 const db=identityDb(database),adapter=identityAdapter(database);
 async function profile(id:string){return adapter.getUserById(id);}
 async function countAdmins(){return Number((await db.selectFrom('_cms_auth_users').select(eb=>eb.fn.countAll<number>().as('count')).where('role','=',50).where('disabled','=',0).executeTakeFirstOrThrow()).count);}
 async function detail(id:string):Promise<AdminUserDetail|null>{
  const user=await profile(id);if(!user)return null;
  const credentials=(await adapter.getCredentialsByUserId(id)).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
  const lastLogin=credentials.reduce<Date|null>((last,c)=>!last||c.lastUsedAt>last?c.lastUsedAt:last,null);
  return {...adminProjection(user,lastLogin,credentials.length),
   credentials:credentials.map(c=>({id:c.id,name:c.name,deviceType:c.deviceType,createdAt:c.createdAt.toISOString(),lastUsedAt:c.lastUsedAt.toISOString()}))};
 }
 async function list(options:{search?:string;role?:number;cursor?:string;limit?:number}={}){
  const limit=Math.min(options.limit??50,100);
  let query=db.selectFrom('_cms_auth_users as u').innerJoin('_cms_auth_profiles as p','p.user_id','u.id')
   .select('u.id').orderBy('p.created_at','desc').limit(limit+1);
  if(options.search){const term=`%${options.search}%`;query=query.where(eb=>eb.or([eb('p.email','like',term),eb('p.name','like',term)]));}
  if(options.role!==undefined)query=query.where('u.role','=',options.role);
  if(options.cursor){const cursor=await profile(options.cursor);if(cursor)query=query.where('p.created_at','<',cursor.createdAt.toISOString());}
  const rows=await query.execute();
  const details=await Promise.all(rows.slice(0,limit).map(row=>detail(row.id)));
  const items=details.filter((user):user is AdminUserDetail=>user!==null).map(({credentials,...user})=>user);
  const legacyCount=Number((await db.selectFrom('_cms_auth_users as u').leftJoin('_cms_auth_profiles as p','p.user_id','u.id')
   .select(eb=>eb.fn.countAll<number>().as('count')).where('p.user_id','is',null).executeTakeFirstOrThrow()).count);
  return {items,nextCursor:rows.length>limit?items.at(-1)?.id:undefined,legacyCount};
 }
 async function requireProfile(id:string){const user=await profile(id);if(!user)throw new AccountError('NOT_FOUND','User not found',404);return user;}
 async function update(id:string,actorId:string,input:{name?:string;email?:string;role?:RoleLevel}){
  const target=await requireProfile(id);
  if(input.role!==undefined&&id===actorId)throw new AccountError('SELF_ROLE_CHANGE','Cannot change your own role',400);
  if(input.email&&input.email!==target.email){const existing=await adapter.getUserByEmail(input.email);if(existing)throw new AccountError('EMAIL_IN_USE','Email already in use',409);}
  const demoting=input.role!==undefined&&input.role<50&&target.role===50;
  if(demoting&&await countAdmins()<=1)throw new AccountError('LAST_ADMIN','Cannot demote the last admin. Promote another user first.',400);
  // Native profile/role physical split is one adapter-proven atomic batch.
  // Source has one users UPDATE; this is storage composition, no concurrent-session proof.
  const token=ulid(),changes:{updated_at:string;name?:string;email?:string}={updated_at:new Date().toISOString()};
  if(input.name!==undefined)changes.name=input.name;if(input.email!==undefined)changes.email=input.email.toLowerCase();
  const guard=demoting?sql`INSERT INTO _cms_guards(token,pass) VALUES(${token},CASE WHEN (SELECT count(*) FROM _cms_auth_users WHERE role=50 AND disabled=0)>1 THEN 1 ELSE 0 END)`.compile(db):undefined;
  try{await database.atomicBatch([...(guard?[guard]:[]),db.updateTable('_cms_auth_profiles').set(changes).where('user_id','=',id).compile(),
   ...(input.role!==undefined?[db.updateTable('_cms_auth_users').set({role:input.role}).where('id','=',id).compile()]:[]),
   ...(guard?[sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db)]:[])]);
  }catch(cause){if(guard&&await countAdmins()<=1)throw new AccountError('LAST_ADMIN','Cannot demote the last admin. Promote another user first.',400);throw cause;}
  return (await detail(id))!;
 }
 async function setDisabled(id:string,actorId:string,disabled:boolean){
  if(disabled&&id===actorId)throw new AccountError('VALIDATION_ERROR','Cannot disable your own account',400);
  const target=await requireProfile(id);
  if(disabled&&target.role===50&&await countAdmins()<=1)throw new AccountError('VALIDATION_ERROR','Cannot disable the last admin. Promote another user first.',400);
  // One SQL statement owns this actual current-role store change; no credential/session issuance.
  const query=db.updateTable('_cms_auth_users').set({disabled:disabled?1:0}).where('id','=',id);
  const result=await (disabled&&target.role===50?query.where(sql<boolean>`(SELECT count(*) FROM _cms_auth_users WHERE role=50 AND disabled=0)>1`):query).executeTakeFirst();
  if(disabled&&target.role===50&&result.numUpdatedRows===0n)throw new AccountError('VALIDATION_ERROR','Cannot disable the last admin. Promote another user first.',400);
  await db.updateTable('_cms_auth_profiles').set({updated_at:new Date().toISOString()}).where('user_id','=',id).execute();
 }
 return {list,detail,requireProfile,update,setDisabled};
}
