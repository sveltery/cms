// Relevant exact status cases from Source api/errors.ts at immutable
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { ApiResult } from '../menus/api-types.ts';
import { apiError } from '../menus/http-errors.ts';
export { apiError };

/** Pinned mapping for the complete set of codes emitted by relations. */
export function unwrapResult<T>(result:ApiResult<T>,successStatus=200):Response {
  if(result.success)return Response.json(result,{status:successStatus,headers:{'Cache-Control':'private, no-store'}});
  const code=result.error.code;
  const status=['NOT_FOUND','COLLECTION_NOT_FOUND'].includes(code)?404:code==='CONFLICT'?409:code.endsWith('_ERROR')&&code!=='VALIDATION_ERROR'?500:400;
  return apiError(code,result.error.message,status,result.error.details);
}
