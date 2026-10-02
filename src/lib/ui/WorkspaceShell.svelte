<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, homeHref = '/' }: { children: Snippet; homeHref?: string } = $props();
</script>

<div class="workspace">
  <aside>
    <a class="brand" href={homeHref}>Sveltery <span>CMS</span></a>
    <nav aria-label="Workspace"><a href={homeHref} aria-current="page">Content</a></nav>
    <small>Foundation preview</small>
  </aside>
  <main>{@render children()}</main>
</div>

<style>
  :global(body) { margin: 0; font-family: system-ui, sans-serif; background: #f5f6f8; color: #202735; }
  :global(*) { box-sizing: border-box; }
  :global(a) { color: inherit; }
  .workspace { min-height: 100vh; display: grid; grid-template-columns: 230px 1fr; }
  aside { padding: 28px 20px; background: #fff; border-right: 1px solid #dfe3e9; display: flex; flex-direction: column; gap: 36px; }
  .brand { font-weight: 750; font-size: 20px; text-decoration: none; }
  .brand span { font-size: 12px; color: #526079; }
  nav a { display: block; padding: 12px; background: #edf1ff; border-radius: 8px; text-decoration: none; }
  small { margin-top: auto; color: #526079; }
  main { width: min(100%, 1000px); padding: 48px; }
  @media (max-width: 700px) { .workspace { grid-template-columns: 1fr; } aside { border-right: 0; gap: 16px; } small { display: none; } main { padding: 24px; } }
</style>
