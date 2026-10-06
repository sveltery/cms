<script lang="ts">
  // Pinned whole UsersPage transitions; native state replaces React Query.
  // MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
  import { onMount, onDestroy } from 'svelte';
  import type { UsersClient, UserListItem, UserDetail as Detail, UpdateUserInput } from './types.ts';
  import UserList from './UserList.svelte';
  import UserDetail from './UserDetail.svelte';
  import InviteUserModal from './InviteUserModal.svelte';
  import { roleLabel } from './roles.ts';
  let {client}:{client:UsersClient}=$props();
  let users=$state<UserListItem[]>([]),nextCursor=$state<string|undefined>(),loading=$state(true),loadError=$state('');
  let search=$state(''),debouncedSearch=$state(''),roleFilter=$state<number|undefined>();
  let selectedId=$state<string|null>(null),detail=$state<Detail|null>(null),detailOpen=$state(false),detailLoading=$state(false);
  let inviteOpen=$state(false),invitePending=$state(false),inviteError=$state<string|null>(null),inviteUrl=$state<string|null>(null);
  let saving=$state(false),saveError=$state(''),pendingSave=$state<UpdateUserInput|null>(null),demoteOpen=$state(false);
  let disableOpen=$state(false),disabling=$state(false),disableError=$state('');
  let recoveryPending=$state(false),recoverySent=$state(false),recoveryError=$state<string|null>(null);
  let listGeneration=0,detailGeneration=0,destroyed=false;
  let searchTimer:ReturnType<typeof setTimeout>|undefined,recoveryTimer:ReturnType<typeof setTimeout>|undefined,closeTimer:ReturnType<typeof setTimeout>|undefined;
  const message=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback;
  async function load(append=false){
    const generation=++listGeneration;loading=true;loadError='';
    try{const page=await client.fetchUsers({search:debouncedSearch||undefined,role:roleFilter,cursor:append?nextCursor:undefined});if(generation!==listGeneration||destroyed)return;users=append?[...users,...page.items]:page.items;nextCursor=page.nextCursor;}
    catch(error){if(generation===listGeneration&&!destroyed)loadError=message(error,'Failed to fetch users');}
    finally{if(generation===listGeneration&&!destroyed)loading=false;}
  }
  async function fetchDetail(id:string){const generation=++detailGeneration;detailLoading=true;try{const user=await client.fetchUser(id);if(generation===detailGeneration&&!destroyed&&id===selectedId)detail=user;}catch{if(generation===detailGeneration&&!destroyed)detail=null;}finally{if(generation===detailGeneration&&!destroyed)detailLoading=false;}}
  function select(id:string){if(closeTimer)clearTimeout(closeTimer);selectedId=id;detail=null;detailOpen=true;void fetchDetail(id);}
  function closeDetail(){detailOpen=false;closeTimer=setTimeout(()=>{selectedId=null;detail=null;detailGeneration++;},200);}
  function searchChanged(value:string){search=value;if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(()=>{debouncedSearch=value;void load();},300);}
  function roleChanged(value:number|undefined){roleFilter=value;void load();}
  async function refresh(){const id=selectedId;await Promise.all([load(),id?fetchDetail(id):Promise.resolve()]);}
  async function update(input:UpdateUserInput){if(!selectedId||saving)return;saving=true;saveError='';try{await client.updateUser(selectedId,input);demoteOpen=false;pendingSave=null;await refresh();}catch(error){saveError=message(error,'Failed to update user');}finally{saving=false;}}
  function save(input:UpdateUserInput){if(!selectedId)return;if(input.role!==undefined&&detail?.role!==undefined&&input.role<detail.role){pendingSave=input;demoteOpen=true;return;}void update(input);}
  async function disable(){if(!selectedId||disabling)return;disabling=true;disableError='';try{await client.disableUser(selectedId);disableOpen=false;await refresh();}catch(error){disableError=message(error,'Failed to disable user');}finally{disabling=false;}}
  async function enable(){if(!selectedId)return;try{await client.enableUser(selectedId);await refresh();}catch(error){saveError=message(error,'Failed to enable user');}}
  async function recover(){if(!selectedId||recoveryPending)return;recoveryPending=true;recoverySent=false;recoveryError=null;try{await client.sendRecoveryLink(selectedId);recoverySent=true;if(recoveryTimer)clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{recoverySent=false;recoveryError=null;},4000);}catch(error){recoveryError=message(error,'Failed to send recovery link');}finally{recoveryPending=false;}}
  function changeInvite(open:boolean){inviteOpen=open;if(!open){inviteError=null;inviteUrl=null;}}
  async function invite(email:string,role:number){if(invitePending)return;invitePending=true;inviteError=null;try{const result=await client.inviteUser(email,role);if(result.inviteUrl)inviteUrl=result.inviteUrl;else inviteOpen=false;await load();}catch(error){inviteError=message(error,'Failed to invite user');}finally{invitePending=false;}}
  onMount(()=>{void load();});
  onDestroy(()=>{destroyed=true;listGeneration++;detailGeneration++;for(const timer of [searchTimer,recoveryTimer,closeTimer])if(timer)clearTimeout(timer);});
</script>
{#if loadError}<div class="error"><p role="alert">Failed to load users: {loadError}</p><button onclick={()=>load()}>Try again</button></div>
{:else}<UserList {users} isLoading={loading} hasMore={!!nextCursor} searchQuery={search} {roleFilter} onSearchChange={searchChanged} onRoleFilterChange={roleChanged} onSelectUser={select} onInviteUser={()=>changeInvite(true)} onLoadMore={()=>{void load(true);}}/>{/if}
<!-- Preserve the pinned actual caller's unset currentUserId until its complete bug qualification. Stored-user authority independently protects writes. -->
<UserDetail user={detail} isLoading={detailLoading} isOpen={detailOpen} isSaving={saving} isSendingRecovery={recoveryPending} {recoverySent} {recoveryError} currentUserId={undefined} onClose={closeDetail} onSave={save} onDisable={()=>{disableError='';disableOpen=true;}} onEnable={()=>{void enable();}} onSendRecovery={()=>{void recover();}}/>
<InviteUserModal open={inviteOpen} isSending={invitePending} error={inviteError} {inviteUrl} onOpenChange={changeInvite} onInvite={(email,role)=>{void invite(email,role);}}/>
{#if disableOpen}<dialog open role="dialog" aria-modal="true" aria-labelledby="disable-user-title" onkeydown={event=>{if(event.key==='Escape'&&!disabling){disableOpen=false;disableError='';}}}><h2 id="disable-user-title">Disable User?</h2><p>Disabling <strong>{detail?.name||detail?.email}</strong> will prevent them from logging in until re-enabled. Their content will be preserved.</p>{#if disableError}<p role="alert">{disableError}</p>{/if}<footer><button disabled={disabling} onclick={()=>{disableOpen=false;disableError='';}}>Cancel</button><button disabled={disabling} onclick={()=>{void disable();}}>{disabling?'Disabling...':'Disable User'}</button></footer></dialog>{/if}
{#if demoteOpen}<dialog open role="dialog" aria-modal="true" aria-labelledby="demote-user-title" onkeydown={event=>{if(event.key==='Escape'&&!saving){demoteOpen=false;pendingSave=null;saveError='';}}}><h2 id="demote-user-title">Demote User?</h2><p>Change <strong>{detail?.name||detail?.email}</strong> from <strong>{roleLabel(detail?.role??0)}</strong> to <strong>{roleLabel(pendingSave?.role??0)}</strong>? They will lose access to higher-level features.</p>{#if saveError}<p role="alert">{saveError}</p>{/if}<footer><button disabled={saving} onclick={()=>{demoteOpen=false;pendingSave=null;saveError='';}}>Cancel</button><button disabled={saving} onclick={()=>{if(pendingSave)void update(pendingSave);}}>{saving?'Demoting...':'Demote User'}</button></footer></dialog>{/if}
<style>
  dialog{position:fixed;inset:25% auto auto 50%;transform:translateX(-50%);margin:0;width:min(30rem,calc(100% - 2rem));box-sizing:border-box;border:1px solid #ccd3d9;border-radius:.5rem;padding:1.5rem;background:white;z-index:50}footer{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1rem}button{padding:.6rem .85rem;cursor:pointer}button:disabled{cursor:default}[role=alert]{color:#ab2634}.error{padding:1.5rem;border:1px solid #ab2634;border-radius:.5rem}
</style>
