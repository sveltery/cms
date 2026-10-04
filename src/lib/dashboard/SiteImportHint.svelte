<script lang="ts">
  // Preserve the Source nested hint lifetime, including denied-storage fallback.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { untrack } from 'svelte';
  import type { QueryClient } from '@tanstack/query-core';
  import type { DashboardClient, DashboardStats } from './types';
  import { observeDashboardQuery } from './query.svelte';
  let { stats, client, queryClient, basePath }: {
    stats: DashboardStats; client: DashboardClient; queryClient: QueryClient; basePath: string;
  } = $props();
  const hintKey = 'emdash:dashboard:site-import-hint-dismissed';
  function readDismissed() { try { return localStorage.getItem(hintKey) === '1'; } catch { return false; } }
  let dismissed = $state(readDismissed());
  const mayBeEmpty = $derived(stats.mediaCount === 0 && stats.collections.every(collection => collection.total === 0));
  const capabilities = observeDashboardQuery(untrack(() => queryClient), () => ({
    queryKey: ['transfer', 'capabilities'],
    queryFn: () => client.fetchTransferCapabilities(),
    enabled: !dismissed && mayBeEmpty
  }));
  function dismiss() { dismissed = true; try { localStorage.setItem(hintKey, '1'); } catch { /* Optional preference only. */ } }
</script>
{#if !dismissed && mayBeEmpty && capabilities.result.data?.portableDomain.empty}
  <section class="notice"><h2>Moving from another EmDash site?</h2><p>This site has no content yet, so you can import a .emdash package exported from another EmDash site.</p><a class="button" href={`${basePath}/settings/transfer?start=import`}>Import a site package</a><button type="button" aria-label="Dismiss import suggestion" onclick={dismiss}>×</button></section>
{/if}
<style>
  .notice { background: var(--muted, #f4f4f4); border: 1px solid var(--border, #d6d6d6); border-radius: 9px; padding: 16px; }
  h2 { font-size: 16px; line-height: 1.4; margin: 0; font-weight: 600; }
  p { font-size: 14px; line-height: 1.6; text-wrap: pretty; }
  .button, button { display: inline-flex; border: 1px solid var(--border, #d6d6d6); border-radius: 6px; background: var(--background, white); padding: 8px 12px; font: inherit; font-size: 13px; color: inherit; text-decoration: none; cursor: pointer; }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--ring, #707070); outline-offset: 3px; }
</style>
