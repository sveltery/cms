<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
  const locale = $derived(page.url.searchParams.get('locale'));
  function scopedHref(path: string) {
    return locale ? `${path}?${new URLSearchParams({ locale })}` : path;
  }
</script>
<div class="public-site">
  <header><a class="brand" href={scopedHref(`${base}/site`)}>Sveltery</a><nav aria-label="Site navigation"><a href={scopedHref(`${base}/site`)}>Home</a><a href={scopedHref(`${base}/posts`)}>Posts</a></nav></header>
  <main>{@render children()}</main>
  <footer><a href="{base}/">Manage content</a></footer>
</div>
<style>
  .public-site { background: #fbfcfe; min-height: 100vh; color: #182537; font-family: system-ui, sans-serif; }
  header { max-width: 960px; margin: auto; padding: 1.5rem; display: flex; justify-content: space-between; border-bottom: 1px solid #dce3ed; }
  .brand { font-weight: 750; font-size: 1.3rem; }
  a { color: #23497c; text-decoration-thickness: 1px; text-underline-offset: .2em; }
  nav { display: flex; gap: 1.5rem; }
  main { max-width: 760px; padding: 3rem 1.5rem; margin: auto; }
  footer { max-width: 960px; margin: auto; padding: 2rem 1.5rem; border-top: 1px solid #dce3ed; }
</style>
