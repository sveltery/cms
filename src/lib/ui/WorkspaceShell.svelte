<script lang="ts">
  import type { Snippet } from 'svelte';
  import WelcomeModal from './WelcomeModal.svelte';
  let { children, homeHref = '/', schemaHref, activePage = 'content' }: {
    children: Snippet; homeHref?: string; schemaHref?: string; activePage?: 'content' | 'schema' | 'settings' | 'dashboard' | 'media' | 'blocks'
  } = $props();
  const schemaLink = $derived(schemaHref ?? `${homeHref.endsWith('/') ? homeHref : `${homeHref}/`}schema`);
</script>

<div class="workspace">
  <aside>
    <a class="brand" href={homeHref}>Sveltery <span>CMS</span></a>
    <nav aria-label="Workspace">
      <a href={`${homeHref.endsWith('/') ? homeHref : `${homeHref}/`}dashboard`} aria-current={activePage === 'dashboard' ? 'page' : undefined}>Dashboard</a>
      <a href={homeHref} aria-current={activePage === 'content' ? 'page' : undefined}>Content</a>
      <a href={`${homeHref.endsWith('/') ? homeHref : `${homeHref}/`}media`} aria-current={activePage === 'media' ? 'page' : undefined}>Media</a>
      <a href={schemaLink} aria-current={activePage === 'schema' ? 'page' : undefined}>Schema</a>
      <a href={`${homeHref.endsWith('/') ? homeHref : `${homeHref}/`}blocks`} aria-current={activePage === 'blocks' ? 'page' : undefined}>Block types</a>
      <a href={`${homeHref.endsWith('/') ? homeHref : `${homeHref}/`}settings`} aria-current={activePage === 'settings' ? 'page' : undefined}>Settings</a>
    </nav>
    <small>Foundation preview</small>
  </aside>
  <main>{@render children()}</main>
</div>
<WelcomeModal/>

<style>
  :global(body) { margin: 0; font-family: system-ui, sans-serif; background: #f5f6f8; color: #202735; }
  :global(*) { box-sizing: border-box; }
  :global(a) { color: inherit; }
  .workspace { min-height: 100vh; display: grid; grid-template-columns: 230px 1fr; }
  aside { padding: 28px 20px; background: #fff; border-right: 1px solid #dfe3e9; display: flex; flex-direction: column; gap: 36px; }
  .brand { font-weight: 750; font-size: 20px; text-decoration: none; }
  .brand span { font-size: 12px; color: #526079; }
  nav a { display: block; padding: 12px; border-radius: 8px; text-decoration: none; }
  nav a[aria-current="page"] { background: #edf1ff; }
  small { margin-top: auto; color: #526079; }
  main { width: min(100%, 1000px); padding: 48px; }
  @media (max-width: 700px) { .workspace { grid-template-columns: 1fr; } aside { border-right: 0; gap: 16px; } small { display: none; } main { padding: 24px; } }
</style>
