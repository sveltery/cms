<script lang="ts">
  // Native Svelte transport for the pinned WelcomeModal.tsx role/scope and
  // dismissal contracts. Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, untrack } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import { resolveDashboardQueryClient, retainDashboardQueryClient } from './query.svelte';
  import { resolveWelcomeDismissal } from './welcome-dismissal.svelte';
  import { createDashboardClient } from './client';
  let { open, onClose, userName, userRole, siteName = 'Sveltery CMS', basePath = '', dismissWelcome: suppliedDismissWelcome, onDismissed, queryClient: suppliedQueryClient }: {
    open: boolean; onClose: () => void; userName?: string | null; userRole: number;
    siteName?: string; basePath?: string; dismissWelcome?: () => Promise<void>; onDismissed?: () => void; queryClient?: QueryClient;
  } = $props();
  const dismissWelcome = $derived(suppliedDismissWelcome ?? createDashboardClient(basePath).dismissWelcome);
  const queryClient = untrack(() => resolveDashboardQueryClient(suppliedQueryClient));
  const dismissal = untrack(() => resolveWelcomeDismissal(queryClient));
  const pending = $derived(dismissal.result.isPending);
  onMount(() => retainDashboardQueryClient(queryClient));
  let dialog = $state<HTMLDivElement>();
  const firstName = $derived(userName?.split(' ')?.[0]?.trim() ?? '');
  const role = $derived(userRole >= 50 ? 'Administrator' : userRole >= 40 ? 'Editor' : userRole >= 30 ? 'Author' : userRole >= 20 ? 'Contributor' : 'Subscriber');
  const scope = $derived(userRole >= 50 ? 'You have full access to manage this site, including users, settings, and all content.' : userRole >= 40 ? 'You can manage content, media, menus, and taxonomies.' : userRole >= 30 ? 'You can create and edit your own content.' : 'You can view and contribute to the site.');
  function dismiss() { void dismissal.mutate({ dismissWelcome: () => dismissWelcome(), onDismissed, onClose }).catch(() => {}); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); void dismiss(); }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  $effect(() => {
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  });
</script>

{#if open}
  <div class="welcome-backdrop">
    <div class="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description" tabindex="-1" bind:this={dialog} onkeydown={keydown}>
      <header><span class="brand-mark" aria-hidden="true">S</span><button type="button" class="close" aria-label="Close" onclick={() => void dismiss()}>×</button></header>
      <h2 id="welcome-title">Welcome to {siteName}{firstName ? `, ${firstName}` : ''}!</h2>
      <p id="welcome-description">Your account has been created successfully.</p>
      <section aria-label="Your Role">
        <p><span class="muted">Your Role</span> <span class="role-badge" data-variant={userRole >= 50 ? 'primary' : userRole >= 30 ? 'secondary' : 'outline'}>{role}</span></p>
        <p>{scope}</p>
        {#if userRole >= 50}<p class="muted">As an administrator, you can invite other users from the Users section.</p>{/if}
      </section>
      <footer><button class="primary" type="button" disabled={pending} aria-busy={pending} onclick={() => void dismiss()}>Get Started</button></footer>
    </div>
  </div>
{/if}

<style>
  .welcome-backdrop { position: fixed; inset: 0; z-index: 100; background: rgb(0 0 0 / .45); display: grid; place-items: center; padding: 24px; }
  .welcome-dialog { width: min(100%, 440px); border: 1px solid var(--border, #d6d6d6); border-radius: 12px; background: var(--card, white); color: var(--card-foreground, #161616); padding: 24px; box-shadow: 0 20px 70px rgb(0 0 0 / .2); }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: var(--primary, #252525); color: var(--primary-foreground, white); font-weight: 750; }
  h2 { margin: 0; font-size: 21px; line-height: 1.2; text-wrap: balance; }
  p { margin: 12px 0; line-height: 1.5; font-size: 14px; text-wrap: pretty; }
  #welcome-description, .muted { color: var(--muted-foreground, #606060); }
  section, footer { border-top: 1px solid var(--border, #d6d6d6); padding-top: 16px; margin-top: 20px; }
  .role-badge { display: inline-block; padding: 3px 10px; border: 1px solid var(--border, #d6d6d6); border-radius: 999px; margin-inline-start: 8px; font-size: 12px; font-weight: 600; }
  .role-badge[data-variant=primary] { background: var(--primary, #252525); color: var(--primary-foreground, white); }
  .role-badge[data-variant=secondary] { background: var(--secondary, #eeeeee); }
  button { font: inherit; cursor: pointer; border: 1px solid var(--border, #d6d6d6); border-radius: 7px; background: var(--background, white); color: inherit; padding: 10px 16px; }
  .close { border: 0; padding: 5px 10px; font-size: 24px; line-height: 1; }
  .primary { width: 100%; background: var(--primary, #252525); color: var(--primary-foreground, white); font-weight: 600; }
  button:disabled { cursor: wait; opacity: .65; }
  button:focus-visible { outline: 2px solid var(--ring, #707070); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>
