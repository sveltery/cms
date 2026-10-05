import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts} from '$lib/server/accounts/request';
export const POST:RequestHandler=event=>accountsApi('USER_DISABLE_ERROR',async()=>{
 const {repository,actorId}=await requestAccounts(event,true);await repository.setDisabled(event.params.id,actorId,true);return {success:true};
});
