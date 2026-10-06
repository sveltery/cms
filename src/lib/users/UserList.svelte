<script lang="ts">
  // Complete pinned UserList display/toolbar/pagination behaviors adapted to Svelte.
  // MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
  import type { UserListItem } from './types.ts';
  import { USER_ROLES, roleLabel } from './roles.ts';
  let {users,isLoading=false,hasMore=false,searchQuery,roleFilter,onSearchChange,onRoleFilterChange,onSelectUser,onInviteUser,onLoadMore}:
    {users:UserListItem[];isLoading?:boolean;hasMore?:boolean;searchQuery:string;roleFilter:number|undefined;
    onSearchChange:(query:string)=>void;onRoleFilterChange:(role:number|undefined)=>void;onSelectUser:(id:string)=>void;onInviteUser:()=>void;onLoadMore?:()=>void}=$props();
</script>
<header><h1>Users</h1><button onclick={onInviteUser}>Invite User</button></header>
<div class="toolbar"><input aria-label="Search users" placeholder="Search by name or email..." value={searchQuery} oninput={event=>onSearchChange(event.currentTarget.value)} />
  <select aria-label="Filter by role" value={roleFilter?.toString()??'all'} onchange={event=>onRoleFilterChange(event.currentTarget.value==='all'?undefined:Number(event.currentTarget.value))}>
    <option value="all">All roles</option>{#each USER_ROLES as role}<option value={role.value}>{role.label}</option>{/each}</select></div>
<div class="table-wrap"><table><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last Login</th><th scope="col">Passkeys</th></tr></thead><tbody>
  {#if !users.length&&!isLoading}<tr><td colspan="5" class="empty">{#if searchQuery||roleFilter!==undefined}No users found matching your filters. <button onclick={()=>{onSearchChange('');onRoleFilterChange(undefined);}}>Clear filters</button>{:else}No users yet. <button onclick={onInviteUser}>Invite your first team member</button>{/if}</td></tr>
  {:else}{#each users as user (user.id)}<tr><td><div class="user"><span class="avatar">{#if user.avatarUrl}<img src={user.avatarUrl} alt="" width="32" height="32" />{:else}{(user.name||user.email)?.[0]?.toUpperCase()??'?'}{/if}</span><div><button class="user-link" onclick={()=>onSelectUser(user.id)}>{user.name||user.email}</button>{#if user.name}<div class="email">{user.email}</div>{/if}</div></div></td>
    <td><span class="role">{roleLabel(user.role)}</span></td><td class:disabled={user.disabled}>{user.disabled?'Disabled':'Active'}</td><td>{user.lastLogin?new Date(user.lastLogin).toLocaleDateString():'Never'}</td><td>{user.credentialCount}</td></tr>{/each}{/if}
  {#if isLoading}<tr><td colspan="5" class="empty" role="status">Loading...</td></tr>{/if}
</tbody></table></div>
{#if hasMore&&!isLoading}<div class="more"><button onclick={onLoadMore}>Load More</button></div>{/if}
<style>
  header,.toolbar {display:flex;align-items:center;gap:1rem;justify-content:space-between;margin-bottom:1rem}h1{font-size:1.7rem;margin:0}.toolbar{justify-content:flex-start;flex-wrap:wrap}input,select,button{padding:.6rem .8rem;border:1px solid #a8b4bf;border-radius:.35rem}button{cursor:pointer;background:transparent}input{min-width:min(20rem,100%)}.table-wrap{border:1px solid #d4d4d8;border-radius:.5rem;overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{padding:.85rem 1rem;text-align:start;border-bottom:1px solid #e3e7eb}th{background:#f5f7fa;font-size:.9rem}.user{display:flex;align-items:center;gap:.75rem}.avatar{border-radius:50%;width:2rem;height:2rem;background:#e7edf3;display:grid;place-items:center;flex-shrink:0}.avatar img{border-radius:50%;object-fit:cover}.user-link{border:0;padding:0;text-align:start;font-weight:600}.email{font-size:.85rem;color:#536573}.disabled{color:#ab2634}.empty{text-align:center;padding:2rem}.more{text-align:center;margin:1rem}.role{padding:.2rem .5rem;background:#edf1f6;border-radius:.3rem}
</style>
