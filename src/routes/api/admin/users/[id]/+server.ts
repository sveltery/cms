import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts,accountBody} from '$lib/server/accounts/request';
import {AccountError} from '$lib/server/accounts/repository';
export const GET:RequestHandler=event=>accountsApi('USER_DETAIL_ERROR',async()=>{
 const {repository}=await requestAccounts(event);const item=await repository.detail(event.params.id);
 if(!item)throw new AccountError('NOT_FOUND','User not found',404);return {item};
});
export const PUT:RequestHandler=event=>accountsApi('USER_UPDATE_ERROR',async()=>{
 const {repository,actorId}=await requestAccounts(event,true);await repository.requireProfile(event.params.id);
 return {item:await repository.update(event.params.id,actorId,await accountBody(event))};
});
