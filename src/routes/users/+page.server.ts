import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requestAccounts } from '$lib/server/accounts/request.ts';
import { AccountError } from '$lib/server/accounts/repository.ts';
/** The unchanged User99 boundary rereads actual stored role/disabled authority. */
export const load:PageServerLoad=async event=>{
  try{await requestAccounts(event);}catch(cause){if(cause instanceof AccountError)error(cause.status,cause.message);throw cause;}
  return {basePath:event.locals.cmsRuntime?.basePath??''};
};
