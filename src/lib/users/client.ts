// Complete pinned users API contracts with native SvelteKit base path.
// MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import { parseApiResponse, throwResponseError } from '../sections-widgets/client.ts';
import type { UsersClient, UsersPageResult, UserDetail, InviteResult } from './types.ts';
/** Injected fetch is a controlled test seam. Production always uses browser fetch. */
export function createUsersClient(basePath='',fetcher:typeof fetch=fetch):UsersClient {
  const root=`${basePath}/api`,user=(id:string)=>`${root}/admin/users/${encodeURIComponent(id)}`;
  function request(url:string,init?:RequestInit){const headers=new Headers(init?.headers);headers.set('X-EmDash-Request','1');return fetcher(url,{...init,headers});}
  function body(value:unknown):RequestInit{return {headers:{'Content-Type':'application/json'},body:JSON.stringify(value)};}
  async function post(url:string,fallback:string){const response=await request(url,{method:'POST'});if(!response.ok)await throwResponseError(response,fallback);}
  return {
    async fetchUsers(options){const params=new URLSearchParams();if(options?.search)params.set('search',options.search);if(options?.role!==undefined)params.set('role',String(options.role));if(options?.cursor)params.set('cursor',options.cursor);if(options?.limit)params.set('limit',String(options.limit));return parseApiResponse<UsersPageResult>(await request(`${root}/admin/users${params.size?`?${params}`:''}`),'Failed to fetch users');},
    async fetchUser(id){const response=await request(user(id));if(!response.ok){if(response.status===404)throw new Error(`User not found: ${id}`);await throwResponseError(response,'Failed to fetch user');}return (await parseApiResponse<{item:UserDetail}>(response,'Failed to fetch user')).item;},
    async updateUser(id,input){return (await parseApiResponse<{item:unknown}>(await request(user(id),{method:'PUT',...body(input)}),'Failed to update user')).item;},
    disableUser:id=>post(`${user(id)}/disable`,'Failed to disable user'),
    enableUser:id=>post(`${user(id)}/enable`,'Failed to enable user'),
    sendRecoveryLink:id=>post(`${user(id)}/send-recovery`,'Failed to send recovery link'),
    async inviteUser(email,role){return parseApiResponse<InviteResult>(await request(`${root}/auth/invite`,{method:'POST',...body({email,role})}),'Failed to invite user');}
  };
}
