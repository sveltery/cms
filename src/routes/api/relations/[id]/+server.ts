import type { RequestHandler } from '@sveltejs/kit';
import { withRelationRequest } from '../../../../lib/server/relations/http.ts';
import { parseBody,isParseError } from '../../../../lib/server/menus/parse.ts';
import { unwrapResult,apiError } from '../../../../lib/server/menus/http-errors.ts';
import { updateRelationBody } from '../../../../lib/server/relations/schemas.ts';
export const prerender=false;
export const GET:RequestHandler=event=>withRelationRequest(event,false,'schema','RELATION_GET_ERROR','Failed to get relation',async service=>{
  if(!event.params.id)return apiError('VALIDATION_ERROR','Relation id required',400);
  return unwrapResult(await service.get(event.params.id));
});
export const PATCH:RequestHandler=event=>withRelationRequest(event,true,'schema','RELATION_UPDATE_ERROR','Failed to update relation',async service=>{
  if(!event.params.id)return apiError('VALIDATION_ERROR','Relation id required',400);
  const body=await parseBody(event.request,updateRelationBody);if(isParseError(body))return body;
  return unwrapResult(await service.update(event.params.id,body));
});
export const DELETE:RequestHandler=event=>withRelationRequest(event,true,'schema','RELATION_DELETE_ERROR','Failed to delete relation',async service=>{
  if(!event.params.id)return apiError('VALIDATION_ERROR','Relation id required',400);
  return unwrapResult(await service.delete(event.params.id));
});
