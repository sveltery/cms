<script lang="ts">
  import { base } from '$app/paths';
  import PublicShell from '$lib/public-site/PublicShell.svelte';
  let { data }: { data: import('./$types').PageData } = $props();
  function entryHref(entry: { id: string; slug: string | null; locale: string | null }, type: 'posts' | 'pages') {
    const path = `${base}/${type}/${encodeURIComponent(entry.slug || entry.id)}`;
    return entry.locale ? `${path}?${new URLSearchParams({ locale: entry.locale })}` : path;
  }
</script>
<svelte:head><title>Posts · Sveltery</title></svelte:head>
<PublicShell>
  <h1>Posts</h1>
  {#if data.entries.length === 0}<p>No published posts yet.</p>{/if}
  <ul>{#each data.entries as entry (entry.id)}<li><article><h2><a href={entryHref(entry, 'posts')}>{entry.title}</a></h2>{#if typeof entry.data.excerpt === 'string'}<p>{entry.data.excerpt}</p>{/if}</article></li>{/each}</ul>
</PublicShell>
<style>ul { list-style: none; padding: 0; } li { padding-block: 1.5rem; border-bottom: 1px solid #dce3ed; } h2 { margin-top: 0; } p { line-height: 1.6; }</style>
