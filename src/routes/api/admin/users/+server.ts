import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts,usersListQuery} from '$lib/server/accounts/request';
import {AccountError} from '$lib/server/accounts/repository';
export const GET:RequestHandler=event=>accountsApi('USER_LIST_ERROR',async()=>{
 const {repository}=await requestAccounts(event);const query=usersListQuery.safeParse(Object.fromEntries(event.url.searchParams));
 if(!query.success)throw new AccountError('VALIDATION_ERROR','Invalid user list query',400);
 return repository.list({...query.data,role:query.data.role?parseInt(query.data.role,10):undefined});
});
