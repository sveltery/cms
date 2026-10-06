<script lang="ts">
  import { untrack } from 'svelte';
  import type { UserDetail, UpdateUserInput } from './types.ts';
  import { USER_ROLES, roleLabel } from './roles.ts';
  let { user, isLoading = false, isOpen, isSaving = false, isSendingRecovery = false,
    recoverySent = false, recoveryError = null, currentUserId, onClose, onSave, onDisable, onEnable, onSendRecovery }:
    { user: UserDetail | null; isLoading?: boolean; isOpen: boolean; isSaving?: boolean; isSendingRecovery?: boolean;
      recoverySent?: boolean; recoveryError?: string | null; currentUserId?: string; onClose: () => void;
      onSave: (input: UpdateUserInput) => void; onDisable: () => void; onEnable: () => void; onSendRecovery?: () => void } = $props();
  let name = $state(user?.name ?? ''), email = $state(user?.email ?? ''), role = $state(user?.role ?? 30);
  let previousUserId = user?.id;
  $effect(() => {
    const id = user?.id;
    if (id !== previousUserId) untrack(() => {
      previousUserId = id;
      if (user) { name = user.name ?? ''; email = user.email; role = user.role; }
    });
  });
  const isSelf = $derived(!!user && !!currentUserId && user.id === currentUserId);
  const dirty = $derived(!!user && (name !== (user.name ?? '') || email !== user.email || role !== user.role));
  function save(event: SubmitEvent) {
    event.preventDefault(); if (!user) return;
    const input: UpdateUserInput = {};
    // Preserve the pinned component's empty-name/undefined behavior.
    if (name !== (user.name ?? '')) input.name = name || undefined;
    if (email !== user.email) input.email = email;
    if (role !== user.role && !isSelf) input.role = role;
    onSave(input);
  }
  const date = (value: string) => new Date(value).toLocaleDateString();
</script>

{#if isOpen}
  <dialog open role="dialog" aria-modal="true" aria-labelledby="user-detail-title" class="user-detail" onkeydown={event => { if (event.key === 'Escape') onClose(); }}>
    <header><h2 id="user-detail-title">User Details</h2><button type="button" aria-label="Close panel" onclick={onClose}>×</button></header>
    {#if isLoading}
      <div class="animate-pulse" aria-label="Loading user details"><p>Loading...</p></div>
    {:else if user}
      <form id="user-edit-form" onsubmit={save}>
        <div class="profile-heading">
          {#if user.avatarUrl}<img src={user.avatarUrl} alt="" width="64" height="64" />{:else}<span class="avatar">{(name || email)?.[0]?.toUpperCase() ?? '?'}</span>{/if}
          <div><label>Name <input aria-label="Name" bind:value={name} placeholder="Enter name" /></label>
            <label>Email <input aria-label="Email" type="email" bind:value={email} placeholder="Enter email" required /></label></div>
        </div>
        <label>Role
          {#if isSelf}<input aria-label="Role" value={roleLabel(role)} disabled />
            <small>You cannot change your own role</small>
          {:else}<select aria-label="Role" bind:value={role}>{#each USER_ROLES as item}<option value={item.value}>{item.label}</option>{/each}</select>{/if}
        </label>
        <p class:disabled={user.disabled}>{user.disabled ? 'Disabled' : 'Active'}</p>
        <section><h3>Account Info</h3><dl><dt>Created</dt><dd>{date(user.createdAt)}</dd>
          <dt>Last updated</dt><dd>{date(user.updatedAt)}</dd><dt>Last login</dt><dd>{user.lastLogin ? date(user.lastLogin) : 'Never'}</dd>
          <dt>Email verified</dt><dd>{user.emailVerified ? 'Yes' : 'No'}</dd></dl></section>
        <section><h3>Passkeys ({user.credentials.length})</h3>
          {#if !user.credentials.length}<p>No passkeys registered</p>{:else}<ul>{#each user.credentials as credential (credential.id)}
            <li><strong>{credential.name || 'Unnamed passkey'}</strong><span>{credential.deviceType === 'multiDevice' ? 'Synced' : 'Device-bound'}</span>
              <span>Created {date(credential.createdAt)}</span><small>Last used {date(credential.lastUsedAt)}</small></li>{/each}</ul>{/if}
        </section>
        {#if user.oauthAccounts?.length}<section><h3>Linked Accounts ({user.oauthAccounts.length})</h3><ul>{#each user.oauthAccounts as account}
          <li><span>{account.provider}</span><span>Connected {date(account.createdAt)}</span></li>{/each}</ul></section>{/if}
      </form>
    {:else}<p>User not found</p>{/if}
    {#if user}
      <footer><div class="actions"><button type="submit" form="user-edit-form" disabled={!dirty || isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
        {#if !isSelf}<button type="button" onclick={user.disabled ? onEnable : onDisable}>{user.disabled ? 'Enable' : 'Disable'}</button>{/if}</div>
        {#if !isSelf && onSendRecovery}<button type="button" onclick={onSendRecovery} disabled={isSendingRecovery}>{isSendingRecovery ? 'Sending...' : 'Send Recovery Link'}</button>
          {#if recoverySent}<p role="status">Recovery link sent to {user.email}</p>{/if}{#if recoveryError}<p role="alert">{recoveryError}</p>{/if}{/if}
      </footer>
    {/if}
  </dialog>
{/if}

<style>
  .user-detail { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(28rem, 100%); height: 100dvh; max-height: 100dvh; box-sizing: border-box; overflow-y: auto; border: 1px solid #ccd3d9; padding: 1.5rem; background: white; z-index: 30; }
  header, .actions { display: flex; justify-content: space-between; gap: .75rem; align-items: center; }
  h2 { margin: 0; } h3 { font-size: 1rem; } form, footer { margin-top: 1.5rem; } label { display: grid; gap: .4rem; margin-bottom: 1rem; }
  input, select { box-sizing: border-box; width: 100%; padding: .6rem; border: 1px solid #a8b4bf; border-radius: .3rem; } button { padding: .6rem .85rem; cursor: pointer; } button:disabled { cursor: default; }
  .profile-heading { display: flex; gap: 1rem; } .profile-heading > div { flex: 1; } .avatar { width: 4rem; height: 4rem; border-radius: 50%; background: #e7edf3; display: grid; place-items: center; font-size: 1.5rem; } img { border-radius: 50%; }
  section { padding: 1rem; border: 1px solid #dce2e7; margin-top: 1rem; border-radius: .3rem; } dl { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; } dd { margin: 0; text-align: end; }
  ul { list-style: none; padding: 0; } li { display: grid; gap: .25rem; margin-top: .75rem; } .disabled, [role=alert] { color: #ab2634; } footer > button { width: 100%; margin-top: .6rem; } small { color: #536573; }
</style>
