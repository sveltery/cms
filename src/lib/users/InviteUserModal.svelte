<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { USER_ROLES } from './roles.ts';
  let { open, isSending = false, error = null, inviteUrl = null, onOpenChange, onInvite }:
    { open: boolean; isSending?: boolean; error?: string | null; inviteUrl?: string | null;
      onOpenChange: (open: boolean) => void; onInvite: (email: string, role: number) => void } = $props();
  let email = $state(''), role = $state(30), copied = $state(false), copyError = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;
  $effect(() => { if (open) untrack(() => { email = ''; role = 30; copied = false; copyError = false; }); });
  onDestroy(() => { if (copyTimeout) clearTimeout(copyTimeout); });
  function submit(event: SubmitEvent) { event.preventDefault(); onInvite(email, role); }
  async function copy() {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); copied = true; copyError = false; copyTimeout = setTimeout(() => copied = false, 2000); }
    catch { copyError = true; }
  }
</script>

{#if open}
  <dialog open role="dialog" aria-modal="true" aria-labelledby="invite-user-title" onkeydown={event => { if (event.key === 'Escape') onOpenChange(false); }}>
    <header><h2 id="invite-user-title">{inviteUrl ? 'Invite Link Created' : 'Invite User'}</h2><button type="button" aria-label="Close" onclick={() => onOpenChange(false)}>×</button></header>
    <p>{inviteUrl ? 'No email provider configured. Share this link manually.' : 'Send an invitation email to a new team member.'}</p>
    {#if inviteUrl}
      <label>Invite link <input aria-label="Invite link" value={inviteUrl} readonly /></label>
      <button type="button" onclick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
      {#if copyError}<p role="alert">Could not copy. Select and copy the link manually.</p>{/if}
      <button type="button" onclick={() => onOpenChange(false)}>Done</button>
    {:else}
      <form onsubmit={submit}>
        <label>Email address <input type="email" aria-label="Email address" bind:value={email} placeholder="new@example.com" required /></label>
        <label>Role <select aria-label="Role" bind:value={role}>{#each USER_ROLES as item}<option value={item.value}>{item.label}</option>{/each}</select></label>
        {#if error}<p role="alert">{error}</p>{/if}
        <footer><button type="button" onclick={() => onOpenChange(false)}>Cancel</button><button type="submit" disabled={!email || isSending}>{isSending ? 'Sending...' : 'Send Invite'}</button></footer>
      </form>
    {/if}
  </dialog>
{/if}

<style>
  dialog { position: fixed; inset: 15% auto auto 50%; transform: translateX(-50%); width: min(28rem, calc(100% - 2rem)); box-sizing: border-box; margin: 0; padding: 1.5rem; border: 1px solid #ccd3d9; border-radius: .5rem; background: white; z-index: 40; }
  header, footer { display: flex; gap: .75rem; justify-content: space-between; align-items: center; } h2 { margin: 0; font-size: 1.3rem; } p { line-height: 1.5; }
  label { display: grid; gap: .4rem; margin-bottom: 1rem; } input, select { width: 100%; box-sizing: border-box; padding: .6rem; border: 1px solid #a8b4bf; border-radius: .3rem; } button { padding: .6rem .85rem; cursor: pointer; } button:disabled { cursor: default; } [role=alert] { color: #ab2634; }
</style>
