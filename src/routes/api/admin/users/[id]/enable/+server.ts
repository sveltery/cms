import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts,requiredUserId} from '$lib/server/accounts/request';
export const POST:RequestHandler=event=>accountsApi('USER_ENABLE_ERROR',async()=>{
 const {repository,actorId}=await requestAccounts(event,true);await repository.setDisabled(requiredUserId(event.params.id,'VALIDATION_ERROR'),actorId,false);return {success:true};
});
