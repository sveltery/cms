<script lang="ts">
  // Native Svelte transport for pinned Dashboard.tsx; Source fixture assertions
  // remain complete. Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, untrack } from 'svelte';
  import { Card, CardHeader, CardContent } from '../ui/vendor/sveltery/card/index';
  import { createDashboardClient } from './client';
  import { formatRelativeTime } from './time';
  import type { DashboardClient, DashboardManifest, DashboardStats } from './types';
  let { manifest, user, client: suppliedClient, basePath = '', locale = 'en' }: {
    manifest: DashboardManifest; user?: { role: number } | null; client?: DashboardClient;
    basePath?: string; locale?: string;
  } = $props();
  const client = $derived(suppliedClient ?? createDashboardClient(basePath));
  let stats = $state<DashboardStats>();
  let loading = $state(true);
  let error = $state(false);
  let policyError = $state<string | null>(null);
  let dismissPending = $state(false);
  let importDismissed = $state(false);
  let importable = $state(false);
  let importRequest: Promise<void> | undefined;
  let active = true;
  const role = $derived(user?.role ?? 0);
  const drafts = $derived(stats?.collections.reduce((sum, collection) => sum + collection.draft, 0) ?? 0);
  const scheduled = $derived(stats?.collections.reduce((sum, collection) => sum + collection.scheduled, 0) ?? 0);
  const overdue = $derived(stats?.collections.reduce((sum, collection) => sum + (collection.overdueScheduled ?? 0), 0) ?? 0);
  const policyRejected = $derived(stats?.policyRejectedScheduled ?? 0);
  const rejections = $derived(stats?.policyRejections ?? []);
  const schedulerNeedsAttention = $derived(overdue > 0 && stats?.schedulerHealth !== undefined && stats.schedulerHealth.status !== 'healthy');
  const quickActions = $derived(Object.entries(manifest.collections).filter(([, collection]) => !collection.hidden && collection.quickCreate !== false));
  const statusLabels: Record<string, string> = { published: 'Published', draft: 'Draft', scheduled: 'Scheduled', pending: 'Pending changes', pending_changes: 'Pending changes', private: 'Private', archived: 'Archived' };
  const hintKey = 'emdash:dashboard:site-import-hint-dismissed';
  const href = (path: string) => `${basePath}${path}`;
  const importEnabled = $derived(role >= 50 && !importDismissed && stats !== undefined && stats.mediaCount === 0 && stats.collections.every(collection => collection.total === 0));
  function checkImport(requestClient: DashboardClient = client): Promise<void> {
    if (!active || !importEnabled) return Promise.resolve();
    if (importRequest) return importRequest;
    importRequest = Promise.resolve().then(async () => {
      try { const capabilities = await requestClient.fetchTransferCapabilities(); if (active && importEnabled) importable = capabilities.portableDomain.empty; }
      catch { /* Source retains cached eligibility on a later error; no initial data means no suggestion. */ }
      finally { importRequest = undefined; }
    });
    return importRequest;
  }
  $effect(() => {
    const enabled = importEnabled;
    const requestClient = client;
    if (enabled) untrack(() => { void checkImport(requestClient); });
    else importable = false;
  });
  async function refresh() {
    try { const value = await client.fetchDashboardStats(); if (active) { stats = value; error = false; } }
    catch { if (active) error = true; }
    finally { if (active) loading = false; }
  }
  async function dismissPolicy(collection: string, id: string, revision: string) {
    dismissPending = true; policyError = null;
    try { await client.dismissScheduledPolicyRejection(collection, id, revision); }
    catch (cause) { if (active) policyError = cause instanceof Error ? cause.message : 'An error occurred'; }
    finally { await refresh(); if (active) dismissPending = false; }
  }
  function dismissImport() {
    importDismissed = true;
    try { localStorage.setItem(hintKey, '1'); } catch { /* Optional preference only. */ }
  }
  onMount(() => {
    active = true;
    try { importDismissed = localStorage.getItem(hintKey) === '1'; } catch { /* Denied storage retains the Source default. */ }
    void refresh();
    const focus = () => { void refresh(); void checkImport(); };
    window.addEventListener('focus', focus);
    return () => { active = false; window.removeEventListener('focus', focus); };
  });
</script>

<div class="dashboard">
  {#if manifest.marketplace && role >= 50}
    <section class="notice" role="status"><h2>Marketplace configuration is deprecated</h2><p>New plugin discovery uses the registry. Existing marketplace plugins can still be updated or uninstalled while you switch over.</p><a href="https://docs.emdashcms.com/plugins/migrate-from-marketplace/">Migration guide</a></section>
  {/if}
  <header class="dashboard-header"><h1>Dashboard</h1><div class="quick-actions">
    {#each quickActions as [slug, collection] (slug)}<a class="button" href={href(`/content/${encodeURIComponent(slug)}/new`)}>{collection.labelSingular ?? collection.label}</a>{/each}
    <a class="button" href={href('/media')}>Upload Media</a>
  </div></header>
  {#if error}<section class="notice" role="alert"><strong>Could not load dashboard data</strong><p>Refresh the page or try again.</p></section>{/if}
  {#if !error || stats}
    {#if stats && role >= 50 && importable && !importDismissed && stats.mediaCount === 0 && stats.collections.every(collection => collection.total === 0)}
      <section class="notice"><h2>Moving from another EmDash site?</h2><p>This site has no content yet, so you can import a .emdash package exported from another EmDash site.</p><a class="button" href={href('/settings/transfer?start=import')}>Import a site package</a><button type="button" aria-label="Dismiss import suggestion" onclick={dismissImport}>×</button></section>
    {/if}
    {#if stats && policyRejected > 0}
      <section class="notice" role="alert">
        <h2>Publication policy blocked scheduled content</h2>
        <p>{policyRejected === 1 ? 'Open the affected entry, resolve the policy reason, and schedule it again. A successful schedule or publish clears this notice.' : 'Open the affected entries, resolve the policy reasons, and schedule them again. A successful schedule or publish clears each notice.'}</p>
        {#if rejections.length}<ul>{#each rejections as rejection (`${rejection.collection}:${rejection.id}`)}<li><a href={href(`/content/${encodeURIComponent(rejection.collection)}/${encodeURIComponent(rejection.id)}`)}><bdi dir="ltr">{rejection.collection}/{rejection.id}</bdi></a><p>{rejection.reason}</p>{#if role >= 40}<button type="button" disabled={dismissPending} onclick={() => void dismissPolicy(rejection.collection, rejection.id, rejection._rev)}>Dismiss</button>{/if}</li>{/each}</ul>{/if}
        {#if policyRejected > rejections.length}<p>{policyRejected - rejections.length === 1 ? 'One more blocked entry is not shown.' : `${policyRejected - rejections.length} more blocked entries are not shown.`}</p>{/if}
        {#if policyError}<p role="alert">{policyError}</p>{/if}
      </section>
    {/if}
    {#if schedulerNeedsAttention}
      <section class="notice" role="alert"><h2>Scheduled publishing needs attention</h2><p>{overdue === 1 ? 'One scheduled item is overdue' : `${overdue} scheduled items are overdue`}{stats?.schedulerHealth?.status === 'unknown' ? ', but no scheduler run has completed.' : ' and the scheduler heartbeat is stale.'} Check the scheduled publishing configuration.</p></section>
    {/if}
    {#if loading}<div class="metrics" aria-label="Loading dashboard data" aria-busy="true">{#each [1, 2, 3] as key (key)}<Card class="skeleton"><CardContent><span class="skeleton-line"></span><span class="skeleton-line short"></span></CardContent></Card>{/each}</div>
    {:else if stats}
      <div class="metrics">
        <Card><CardHeader><h2>{drafts === 1 ? 'Draft' : 'Drafts'}</h2></CardHeader><CardContent><span data-testid="dashboard-metric-value">{drafts}</span></CardContent></Card>
        {#if scheduled > 0}<Card><CardHeader><h2>{#if role >= 20}<a href={href('/calendar')}>Scheduled</a>{:else}Scheduled{/if}</h2></CardHeader><CardContent><span data-testid="dashboard-metric-value">{scheduled}</span></CardContent></Card>{/if}
        <Card><CardHeader><h2>{stats.mediaCount === 1 ? 'Media file' : 'Media files'}</h2></CardHeader><CardContent><span data-testid="dashboard-metric-value">{stats.mediaCount}</span></CardContent></Card>
        <Card><CardHeader><h2>{stats.userCount === 1 ? 'User' : 'Users'}</h2></CardHeader><CardContent><span data-testid="dashboard-metric-value">{stats.userCount}</span></CardContent></Card>
      </div>
    {/if}
    <div class="details">
      <Card><CardHeader><h2>Content</h2></CardHeader><CardContent>
        {#if loading}<p aria-busy="true">Loading content…</p>{:else if !stats?.collections.length}<p class="muted">No collections configured</p>
        {:else}<ul>{#each stats.collections as collection (collection.slug)}<li><a class="row" href={href(`/content/${encodeURIComponent(collection.slug)}`)}><span>{manifest.collections[collection.slug]?.label ?? collection.label}</span><span class="counts">{#if collection.published > 0}<span class="badge"><span class="sr-only">Published</span>{collection.published}</span>{/if}{#if collection.draft > 0}<span class="badge"><span class="sr-only">Drafts</span>{collection.draft}</span>{/if}</span></a></li>{/each}</ul>{/if}
      </CardContent></Card>
      <Card><CardHeader><h2>Recent Activity</h2></CardHeader><CardContent>
        {#if loading}<p aria-busy="true">Loading recent activity…</p>{:else if !stats?.recentItems.length}<p class="muted">No recent activity</p>
        {:else}<ul>{#each stats.recentItems as item (`${item.collection}-${item.id}`)}<li><a class="row" href={href(`/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.id)}`)}><span class="activity-title"><span class="status-dot" role="img" aria-label={Object.hasOwn(statusLabels, item.status) ? statusLabels[item.status] : `Status: ${item.status}`}></span><span>{item.title || item.slug || 'Untitled'}</span><small class="collection-label muted">{item.collectionLabel}</small></span><time data-testid="activity-time" datetime={item.updatedAt}>{formatRelativeTime(item.updatedAt, locale)}</time></a></li>{/each}</ul>{/if}
      </CardContent></Card>
    </div>
  {/if}
</div>

<style>
  .dashboard { display: grid; gap: 24px; }
  .dashboard-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { font-size: 28px; margin: 0; letter-spacing: -.02em; }
  h2 { font-size: 15px; line-height: 1.4; margin: 0; font-weight: 600; }
  p { font-size: 14px; line-height: 1.6; text-wrap: pretty; }
  .quick-actions, .counts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .metrics { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
  .details { display: grid; gap: 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  :global(.dashboard [data-slot=card]) { border: 1px solid var(--border, #d6d6d6); border-radius: 9px; background: var(--card, white); color: var(--card-foreground, #171717); }
  :global(.dashboard [data-slot=card-header]) { padding: 14px 16px; background: var(--muted, #f4f4f4); border-bottom: 1px solid var(--border, #d6d6d6); border-radius: 9px 9px 0 0; }
  :global(.dashboard [data-slot=card-content]) { padding: 16px; }
  [data-testid=dashboard-metric-value] { font-size: 30px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .notice { background: var(--muted, #f4f4f4); border: 1px solid var(--border, #d6d6d6); border-radius: 9px; padding: 16px; }
  .notice h2 { font-size: 16px; }
  ul { padding: 0; margin: 0; list-style: none; }
  li + li { margin-top: 8px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 6px; padding: 10px 0; text-decoration: none; }
  .row:hover { background: var(--muted, #f4f4f4); }
  .activity-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .activity-title > span:not(.status-dot) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status-dot { flex: 0 0 10px; width: 10px; height: 10px; border-radius: 50%; background: var(--muted-foreground, #606060); }
  .badge { background: var(--muted, #f4f4f4); border: 1px solid var(--border, #d6d6d6); border-radius: 999px; padding: 2px 8px; font-size: 12px; font-variant-numeric: tabular-nums; }
  time { font-size: 12px; white-space: nowrap; color: var(--muted-foreground, #606060); }
  .button, button { display: inline-flex; border: 1px solid var(--border, #d6d6d6); border-radius: 6px; background: var(--background, white); padding: 8px 12px; font: inherit; font-size: 13px; color: inherit; text-decoration: none; cursor: pointer; }
  button:disabled { opacity: .65; cursor: wait; }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--ring, #707070); outline-offset: 3px; }
  .muted { color: var(--muted-foreground, #606060); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .skeleton-line { display: block; width: 70%; height: 15px; border-radius: 5px; background: var(--muted, #ededed); margin: 12px 0; }
  .short { width: 30%; height: 30px; }
  @media (max-width: 760px) { .details { grid-template-columns: 1fr; } .collection-label { display: none; } }
</style>
