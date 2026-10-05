// Native Kit transport for pinned Source content-taxonomy assignments; MIT notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withTaxonomyRequest } from '$lib/server/taxonomies/http.ts';
import { getEntryTaxonomyAssignments,setEntryTaxonomyAssignments,entryForTaxonomyAssignment } from '$lib/server/taxonomies/assignments.ts';
import { contentTermsBody } from '$lib/server/taxonomies/schemas.ts';
import { parseBody,isParseError } from '$lib/server/menus/parse.ts';
import { apiError,unwrapResult } from '$lib/server/menus/http-errors.ts';
export const prerender=false;
type AssignmentParams={collection:string;id:string;taxonomy:string};
export const GET:RequestHandler<AssignmentParams>=event=>withTaxonomyRequest(event,false,'content:read','TERMS_GET_ERROR','Failed to get entry terms',async(db,storage)=>{
 const {collection,id,taxonomy}=event.params;
 if(!collection||!id||!taxonomy)return apiError('VALIDATION_ERROR','Collection, id, and taxonomy required',400);
 return unwrapResult(await getEntryTaxonomyAssignments(db,storage,collection,id,taxonomy));
});
export const POST:RequestHandler<AssignmentParams>=event=>withTaxonomyRequest(event,true,['content:edit_own','content:edit_any'],'TERMS_SET_ERROR','Failed to set entry terms',async(db,storage)=>{
 const {collection,id,taxonomy}=event.params;
 if(!collection||!id||!taxonomy)return apiError('VALIDATION_ERROR','Collection, id, and taxonomy required',400);
 const entry=await entryForTaxonomyAssignment(storage,collection,id);
 if(!entry)return apiError('NOT_FOUND','Content not found',404);
 const principal=event.locals.cms!.principal!;
 if(!principal.permissions.includes('content:edit_any')&&entry.authorId!==principal.id)return apiError('FORBIDDEN','Insufficient permissions',403);
 const body=await parseBody(event.request,contentTermsBody);if(isParseError(body))return body;
 return unwrapResult(await setEntryTaxonomyAssignments(db,storage,collection,entry.id,taxonomy,body.termIds));
});
