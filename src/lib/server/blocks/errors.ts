// EmDash 1.1.0 SchemaError constructor contract, 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {CmsError,type DatabaseErrorCode} from '../database/contract.ts';
export class SchemaError extends CmsError {
  constructor(message:string,code:string,details?:Record<string,unknown>) {
    super(code as DatabaseErrorCode,message,details);this.name='SchemaError';
  }
}
export function mapErrorStatus(code:string) {
  if(['BLOCK_TYPE_NOT_FOUND','NOT_FOUND','FIELD_NOT_FOUND','COLLECTION_NOT_FOUND'].includes(code))return 404;
  if(['BLOCK_TYPE_EXISTS','BLOCK_TYPE_BREAKING_CHANGE','BLOCK_TYPE_VERSION_CONFLICT','CONFLICT'].includes(code))return 409;
  if(code==='UNAUTHENTICATED')return 401;
  if(code==='FORBIDDEN')return 403;
  if(['VALIDATION_ERROR','INVALID_SLUG','RESERVED_SLUG','UNSUPPORTED_FIELD_TYPE'].includes(code))return 400;
  return 500;
}
