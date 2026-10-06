import {editorError} from '../editor/errors.ts';
import {ApiResponseError} from '../sections-widgets/client.ts';

/** Kit's actual editor envelope crosses into the existing Source-derived API class. */
export function nativeEntryLockWriteError(cause:unknown):unknown {
  if(cause instanceof ApiResponseError)return cause;
  const value=editorError(cause);
  if(value.code!=='ENTRY_LOCKED')return cause;
  return new ApiResponseError(value.status,value.code,value.message,value.details);
}
