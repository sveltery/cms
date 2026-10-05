import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts,accountBody,requiredUserId} from '$lib/server/accounts/request';
import {AccountError} from '$lib/server/accounts/repository';
export const GET:RequestHandler=event=>accountsApi('USER_DETAIL_ERROR',async()=>{
 const {repository}=await requestAccounts(event);const item=await repository.detail(requiredUserId(event.params.id));
 if(!item)throw new AccountError('NOT_FOUND','User not found',404);return {item};
});
export const PUT:RequestHandler=event=>accountsApi('USER_UPDATE_ERROR',async()=>{
 const {repository,actorId}=await requestAccounts(event,true);const id=requiredUserId(event.params.id);await repository.requireProfile(id);
 return {item:await repository.update(id,actorId,await accountBody(event))};
});
