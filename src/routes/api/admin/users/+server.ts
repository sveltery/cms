import type {RequestHandler} from './$types';
import {accountsApi,requestAccounts,usersListQuery,parseQuery,isParseError} from '$lib/server/accounts/request';
export const GET:RequestHandler=event=>accountsApi('USER_LIST_ERROR',async()=>{
 const {repository}=await requestAccounts(event);const query=parseQuery(event.url,usersListQuery);
 if(isParseError(query))return query;
 return repository.list({...query,role:query.role?parseInt(query.role,10):undefined});
});
