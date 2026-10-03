<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { getWorkspaceNavigation } from '$lib/workspace.remote';
  import { collectionNavigation, isItemActive, parseFolderState, type WorkspaceNavigation } from './nav/navigation';
  import { formatAdminVersion } from './nav/admin-version';
  import { Card } from './vendor/sveltery/card/index';
  import './vendor/sveltery/themes-native.css';
  let { children, homeHref = '/', schemaHref, activePage = 'content', currentPath, navigation, additionalNavigation, mediaHref, blocksHref, usersHref, version, footerLabel = 'Sveltery CMS' }: {
    children: Snippet; homeHref?: string; schemaHref?: string;
    activePage?: 'content' | 'schema' | 'settings' | 'dashboard' | 'media' | 'blocks' | 'users';
    currentPath?: string; navigation?: WorkspaceNavigation;
    /** Owned features mount real links/palette without advertising absent routes. */
    additionalNavigation?: Snippet;
    mediaHref?: string; blocksHref?: string; usersHref?: string;
    version?: string; footerLabel?: string | false;
  } = $props();
  const navigationQuery = $derived(navigation ? undefined : getWorkspaceNavigation());
  const loadedNavigation = $derived(navigationQuery ? await navigationQuery.then(value => value,
    (): WorkspaceNavigation => ({ authenticated: false, permissions: [], collections: {}, unavailable: true })) : undefined);
  let navigationOpen = $state(false);
  let folders = $state<Record<string, boolean>>({});
  const navigationData = $derived<WorkspaceNavigation>(navigation ?? navigationQuery?.current ?? loadedNavigation ?? { authenticated: false, permissions: [], collections: {} });
  const prefix = $derived(homeHref.endsWith('/') ? homeHref : `${homeHref}/`);
  const schemaLink = $derived(schemaHref ?? `${prefix}schema`);
  const path = $derived(currentPath ?? page.url.pathname);
  const entries = $derived(collectionNavigation(navigationData, homeHref));
  const showSchema = $derived(navigationData.permissions.includes('schema:manage'));
  // Kit resolves links relative to the rendered route; source matching consumes paths.
  function destinationPath(href: string) {
    return new URL(href, new URL(path, page.url)).pathname;
  }
  const homeActive = $derived(activePage === 'content' && destinationPath(homeHref).replace(/\/$/, '') === path.replace(/\/$/, ''));
  function saveFolder(label: string, open: boolean) {
    folders = { ...folders, [label]: open };
    try { localStorage.setItem('emdash-sidebar-folders', JSON.stringify(folders)); } catch { /* Optional display preference. */ }
  }
  onMount(() => {
    try { folders = parseFolderState(localStorage.getItem('emdash-sidebar-folders')); } catch { /* Storage denial retains route defaults. */ }
  });
</script>

<a class="skip-link" href="#workspace-main">Skip to content</a>
<div class="workspace">
  <header class="mobile-header">
    <a class="brand" href={homeHref}>Sveltery <span>CMS</span></a>
    <button type="button" aria-controls="workspace-sidebar" aria-expanded={navigationOpen} onclick={() => navigationOpen = !navigationOpen}>Toggle navigation</button>
  </header>
  <aside id="workspace-sidebar" class:mobile-open={navigationOpen}>
    <a class="brand desktop-brand" href={homeHref}>Sveltery <span>CMS</span></a>
    <nav aria-label="Workspace">
      <a href={homeHref} aria-current={homeActive ? 'page' : undefined}>Content</a>
      {#if entries.length}
        <h2>Collections</h2>
        {#each entries as entry}
          {#if entry.kind === 'item'}
            <a href={entry.item.href} aria-current={isItemActive(destinationPath(entry.item.href), path) ? 'page' : undefined}>{entry.item.label}</a>
          {:else}
            {@const folderOpen = folders[entry.label] ?? entry.items.some(item => isItemActive(destinationPath(item.href), path))}
            <details open={folderOpen}>
              <summary onclick={event => { event.preventDefault(); saveFolder(entry.label, !folderOpen); }}>{entry.label}</summary>
              <div class="folder-members">
                {#each entry.items as item (item.href)}
                  <a href={item.href} aria-current={isItemActive(destinationPath(item.href), path) ? 'page' : undefined}>{item.label}</a>
                {/each}
              </div>
            </details>
          {/if}
        {/each}
      {/if}
      {#if mediaHref}<a href={mediaHref} aria-current={activePage === 'media' ? 'page' : undefined}>Media</a>{/if}
      {#if blocksHref}<a href={blocksHref} aria-current={activePage === 'blocks' ? 'page' : undefined}>Block types</a>{/if}
      {#if usersHref}<a href={usersHref} aria-current={activePage === 'users' ? 'page' : undefined}>Users</a>{/if}
      {#if showSchema}
        <h2>Administration</h2>
        <a href={schemaLink} aria-current={activePage === 'schema' ? 'page' : undefined}>Schema</a>
      {/if}
      {@render additionalNavigation?.()}
    </nav>
    <a class="account-link" href={`${prefix}login`}>{navigationData.authenticated ? 'Your account' : navigationData.unavailable ? 'Account' : 'Sign in'}</a>
    <small>{formatAdminVersion(version, undefined, footerLabel)}</small>
  </aside>
  <main id="workspace-main" tabindex="-1"><Card class="workspace-surface">{@render children()}</Card></main>
</div>

<style>
  :global(body) { margin: 0; font-family: system-ui, sans-serif; background: var(--background); color: var(--foreground); }
  :global(*) { box-sizing: border-box; }
  :global(a) { color: inherit; }
  .workspace { min-height: 100svh; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
  .skip-link { position: fixed; top: 8px; left: 8px; padding: 12px; background: var(--background); z-index: 100; transform: translateY(-150%); border: 2px solid var(--ring); border-radius: 6px; }
  .skip-link:focus { transform: none; }
  aside { padding: 28px 18px; background: var(--sidebar); color: var(--sidebar-foreground); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; gap: 28px; min-width: 0; }
  .brand { font-weight: 750; font-size: 20px; text-decoration: none; }
  .brand span { font-size: 12px; color: var(--muted-foreground); }
  nav h2 { margin: 24px 12px 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-foreground); }
  nav a, summary { display: block; padding: 11px 12px; border-radius: 7px; text-decoration: none; overflow-wrap: anywhere; font-size: 14px; }
  summary { cursor: pointer; list-style: revert; display: list-item; margin-left: 16px; }
  .folder-members { padding-left: 16px; }
  nav a:hover, summary:hover { background: var(--sidebar-accent); }
  nav a[aria-current="page"] { background: var(--sidebar-accent); font-weight: 650; }
  .account-link { margin-top: auto; font-size: 13px; padding: 12px; border-top: 1px solid var(--sidebar-border); }
  small { color: var(--muted-foreground); font-size: 11px; padding: 0 12px; }
  main { min-width: 0; padding: 40px; }
  :global(.workspace-surface) { display: flex; flex-direction: column; gap: 16px; min-width: 0; max-width: 1120px; margin: 0 auto; padding: 32px; background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); border-radius: 12px; }
  .mobile-header { display: none; }
  button { font: inherit; color: inherit; border: 1px solid var(--border); background: var(--background); padding: 10px 12px; border-radius: 6px; cursor: pointer; }
  a:focus-visible, summary:focus-visible, button:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
  @media (max-width: 760px) {
    .workspace { grid-template-columns: minmax(0, 1fr); }
    .mobile-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); background: var(--background); }
    aside { display: none; border-right: 0; border-bottom: 1px solid var(--border); padding: 16px; gap: 16px; }
    aside.mobile-open { display: flex; }
    .desktop-brand { display: none; }
    main { padding: 16px; }
    :global(.workspace-surface) { padding: 20px; }
  }
</style>
