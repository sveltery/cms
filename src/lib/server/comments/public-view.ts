import type { CmsDatabase } from '../database/contract.ts';
import { commentsReady } from './readiness.ts';
import { nativeCommentDatabase } from './runtime.ts';
import { getCommentsWithDb, type GetCommentsOptions } from './upstream/comments/query.ts';
/** Explicit real-storage template host; absence never installs comments tables. */
export async function readPublicComments(database:CmsDatabase,options:GetCommentsOptions){
 if(!await commentsReady(database))return {available:false,enabled:false,items:[],total:0};
 const db=nativeCommentDatabase(database);
 const collection=await db.selectFrom('_emdash_collections').select('comments_enabled').where('slug','=',options.collection).executeTakeFirst();
 if(!collection?.comments_enabled)return {available:true,enabled:false,items:[],total:0};
 return {available:true,enabled:true,...await getCommentsWithDb(db,options)};
}
