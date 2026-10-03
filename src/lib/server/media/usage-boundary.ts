import type {Kysely} from 'kysely';
import type {Database} from './source/database/types.ts';
import type {ApiResult} from './source/api/types.ts';
/** Explicit failure boundary, replaced only when actual ME3 provider12 exists. */
export async function handleMediaUsageSummaries(_db:Kysely<Database>,_ids:string[],_options:{includeCount:boolean}):Promise<ApiResult<Record<string,never>>>{
 return {success:false,error:{code:'MEDIA_USAGE_NOT_CONFIGURED',message:'Media usage is not configured'}};
}
