import type { RequestEvent } from '@sveltejs/kit';
import type { Permission } from '../database/service.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { checkPublicCsrf } from './upstream/api/csrf.ts';
import { commentsReady } from './readiness.ts';
import { apiError, apiSuccess, handleError, unwrapResult } from './upstream/api/error.ts';
import { parseBody, parseQuery, isParseError } from './upstream/api/parse.ts';
import { commentListQuery, commentStatusBody, commentBulkBody, createReactionBody } from './upstream/api/schemas/comments.ts';
import { handleCommentList, handleCommentInbox, handleCommentCounts, handleCommentGet, handleCommentDelete, handleCommentBulk, hashIp } from './upstream/api/handlers/comments.ts';
import { handleReactionCounts, handleReactionToggle } from './upstream/api/handlers/comment-reactions.ts';
import { submitPublicComment } from './upstream/comments/public-submission.ts';
import { moderateComment, CommentStatusConflictError, type CommentHookRunner } from './upstream/comments/service.ts';
import { extractRequestMeta } from './upstream/plugins/request-meta.ts';
import { resolveSecretsCached } from './upstream/config/secrets.ts';
import { nativeCommentDatabase, nativeCommentRuntime, nativeCommentUser } from './runtime.ts';
import { runWithCommentDatabase } from './upstream/loader.ts';

export function commentsUnavailable(): Response {
 return apiError('COMMENTS_UNAVAILABLE', 'Comments storage is unavailable', 503);
}
function denied(event: RequestEvent, permission: Permission): Response | null {
 const principal = event.locals.cms?.principal;
 if (!principal) return apiError('NOT_AUTHENTICATED', 'Authentication required', 401);
 if (!principal.permissions.includes(permission)) return apiError('FORBIDDEN', 'Insufficient permission', 403);
 return null;
}
async function withComments(event: RequestEvent, routeKind: 'public'|'admin', execute: (db: ReturnType<typeof nativeCommentDatabase>) => Promise<Response>): Promise<Response> {
 const database=event.locals.cms?.database;
 if (!database || !await commentsReady(database)) return commentsUnavailable();
 if (!['GET','HEAD','OPTIONS'].includes(event.request.method)) {
  if (event.locals.cms?.mutationsEnabled !== true) return apiError('MUTATIONS_DISABLED','Mutations are disabled',503);
  if (routeKind === 'admin') {
   const origin=event.locals.cmsRuntime?.publicOrigin;
   if (!origin) return commentsUnavailable();
   try { requireSessionMutationOrigin(event.request,origin); }
   catch (error) { if(error instanceof SessionOriginError) return apiError(error.code,error.message,403); throw error; }
  } else {
   const rejected=checkPublicCsrf(event.request,event.url,event.locals.cmsRuntime?.publicOrigin);
   if(rejected)return rejected;
  }
 }
 const db=nativeCommentDatabase(database);
 return runWithCommentDatabase(db,()=>execute(db));
}
export async function publicCommentsRequest(event: RequestEvent): Promise<Response> {
 return withComments(event,'public',async db=> {
  const {collection,contentId}=event.params;
  if(!collection||!contentId) return apiError('VALIDATION_ERROR','Collection and content ID required',400);
  const runtime=nativeCommentRuntime(event,db);
  if(event.request.method==='POST') return submitPublicComment(runtime,collection,contentId,event.request,await nativeCommentUser(event,db));
  try {
   const row=await db.selectFrom('_emdash_collections').select('comments_enabled').where('slug','=',collection).executeTakeFirst();
   if(!row) return apiError('NOT_FOUND',`Collection '${collection}' not found`,404);
   if(!row.comments_enabled) return apiError('COMMENTS_DISABLED','Comments are not enabled for this collection',403);
   return unwrapResult(await handleCommentList(db,collection,contentId,{limit:Math.min(Number(event.url.searchParams.get('limit')||50),100),cursor:event.url.searchParams.get('cursor')??undefined,threaded:event.url.searchParams.get('threaded')==='true'}));
  } catch(error) { return handleError(error,'Failed to list comments','COMMENT_LIST_ERROR'); }
 });
}
export async function reactionCommentsRequest(event: RequestEvent): Promise<Response> {
 return withComments(event,'public',async db=> {
  const {collection,contentId}=event.params;
  if(!collection||!contentId) return apiError('VALIDATION_ERROR','Collection and content ID required',400);
  try {
   const config=nativeCommentRuntime(event,db).config;
   if(event.request.method==='POST') {
    const body=await parseBody(event.request,createReactionBody);
    if(isParseError(body)) return body;
    if(body.website_url) return apiSuccess({reacted:false,counts:{}});
    const ip=extractRequestMeta(event.request,config).ip;
    const voterHash=ip?await hashIp(ip,(await resolveSecretsCached(db)).ipSalt):'unknown';
    return unwrapResult(await handleReactionToggle(db,{collection,contentId,commentId:body.commentId,reaction:body.reaction,voterHash}));
   }
   const ip=extractRequestMeta(event.request,config).ip;
   const voterHash=ip?await hashIp(ip,(await resolveSecretsCached(db)).ipSalt):'unknown';
   return unwrapResult(await handleReactionCounts(db,collection,contentId,voterHash));
  } catch(error) { return event.request.method==='POST'
    ? handleError(error,'Failed to toggle reaction','REACTION_TOGGLE_ERROR')
    : handleError(error,'Failed to read reactions','REACTION_COUNTS_ERROR'); }
 });
}
export async function adminCommentsRequest(event: RequestEvent,operation:'inbox'|'counts'|'get'|'status'|'delete'|'bulk'): Promise<Response> {
 return withComments(event,'admin',async db=> {
  try {
   if(operation==='bulk') {
    const body=await parseBody(event.request,commentBulkBody);if(isParseError(body))return body;
    const rejected=denied(event,body.action==='delete'?'comments:delete':'comments:moderate');if(rejected)return rejected;
    return unwrapResult(await handleCommentBulk(db,body.ids,body.action));
   }
   const rejected=denied(event,operation==='delete'?'comments:delete':'comments:moderate');if(rejected)return rejected;
   if(operation==='inbox') {const query=parseQuery(event.url,commentListQuery);return isParseError(query)?query:unwrapResult(await handleCommentInbox(db,query));}
   if(operation==='counts') return unwrapResult(await handleCommentCounts(db));
   const id=event.params.id;if(!id)return apiError('VALIDATION_ERROR','Comment ID required',400);
   if(operation==='delete')return unwrapResult(await handleCommentDelete(db,id));
   if(operation==='get')return unwrapResult(await handleCommentGet(db,id));
   const body=await parseBody(event.request,commentStatusBody);if(isParseError(body))return body;
   const existing=await handleCommentGet(db,id);if(!existing.success)return unwrapResult(existing);
   const user=await nativeCommentUser(event,db);
   const runtime=nativeCommentRuntime(event,db);
   const hooks:CommentHookRunner={runBeforeCreate:event=>runtime.hooks.runCommentBeforeCreate(event),runModerate:async()=>({status:'pending'}),fireAfterCreate:event=>{void runtime.hooks.runCommentAfterCreate(event);},fireAfterModerate:event=>runtime.hooks.runCommentAfterModerate(event)};
   const updated=await moderateComment(db,id,body.status,existing.data.status,{source:'admin',userId:event.locals.cms!.principal!.id,name:user?.name??null},hooks);
   return updated?apiSuccess(updated):apiError('NOT_FOUND','Comment not found',404);
  } catch(error) {
   if(error instanceof CommentStatusConflictError)return apiError(error.code,error.message,409,{currentStatus:error.currentStatus});
   const failures={inbox:['Failed to list comments','COMMENT_INBOX_ERROR'],counts:['Failed to get comment counts','COMMENT_COUNTS_ERROR'],get:['Failed to get comment','COMMENT_GET_ERROR'],delete:['Failed to delete comment','COMMENT_DELETE_ERROR'],status:['Failed to update comment status','COMMENT_STATUS_ERROR'],bulk:['Failed to perform bulk operation','COMMENT_BULK_ERROR']} as const;
   const [message,code]=failures[operation];
   return handleError(error,message,code);
  }
 });
}
