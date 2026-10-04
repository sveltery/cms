<script lang="ts">
  import { base } from '$app/paths';
  import { publicEntryHref } from '$lib/public-site/href.ts';
  import PublicShell from '$lib/public-site/PublicShell.svelte';
  let { data }: { data: import('./$types').PageData } = $props();
</script>
<svelte:head><title>Sveltery</title></svelte:head>
<PublicShell>
  <h1>Latest posts</h1>
  {#if data.posts.length === 0}<p>No published posts yet.</p>{/if}
  <ul>{#each data.posts as entry (entry.id)}<li><h2><a href={publicEntryHref(entry, 'posts', base)}>{entry.title}</a></h2>{#if typeof entry.data.excerpt === 'string'}<p>{entry.data.excerpt}</p>{/if}</li>{/each}</ul>
  {#if data.pages.length > 0}<nav aria-label="Pages"><ul>{#each data.pages as entry (entry.id)}<li><a href={publicEntryHref(entry, 'pages', base)}>{entry.title}</a></li>{/each}</ul></nav>{/if}
</PublicShell>
<style>ul { list-style: none; padding: 0; } li { padding-block: 1rem; } p { line-height: 1.6; }</style>
