import type { RequestHandler } from '@sveltejs/kit';
import { withRelationRequest } from '../../../../../../../../lib/server/relations/http.ts';
import { parseQuery,isParseError } from '../../../../../../../../lib/server/menus/parse.ts';
import { unwrapResult,apiError } from '../../../../../../../../lib/server/menus/http-errors.ts';
import { cursorPaginationQuery } from '../../../../../../../../lib/server/relations/pagination.ts';
export const prerender=false;
export const GET:RequestHandler=event=>withRelationRequest(event,false,'content','REFERENCES_GET_ERROR','Failed to get references',async service=>{
  const {collection,id,relation}=event.params;
  if(!collection||!id||!relation)return apiError('VALIDATION_ERROR','Collection, id, and relation required',400);
  const page=parseQuery(event.url,cursorPaginationQuery);if(isParseError(page))return page;
  return unwrapResult(await service.children(collection,id,relation,page));
});
