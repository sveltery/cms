import type { RequestHandler } from '@sveltejs/kit';
import { withRelationRequest } from '../../../lib/server/relations/http.ts';
import { parseBody,parseQuery,isParseError } from '../../../lib/server/menus/parse.ts';
import { unwrapResult } from '../../../lib/server/menus/http-errors.ts';
import { createRelationBody,relationListQuery } from '../../../lib/server/relations/schemas.ts';
export const prerender=false;
export const GET:RequestHandler=event=>withRelationRequest(event,false,'schema','RELATION_LIST_ERROR','Failed to list relations',async service=>{
  const query=parseQuery(event.url,relationListQuery);if(isParseError(query))return query;
  return unwrapResult(await service.list(query));
});
export const POST:RequestHandler=event=>withRelationRequest(event,true,'schema','RELATION_CREATE_ERROR','Failed to create relation',async service=>{
  const body=await parseBody(event.request,createRelationBody);if(isParseError(body))return body;
  return unwrapResult(await service.create(body),201);
});
