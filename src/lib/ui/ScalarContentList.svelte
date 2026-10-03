<script lang="ts">
  import { resolve } from '$app/paths';
  import { getEditorManifest } from '$lib/content.remote';
  import { listEditorContent } from '$lib/editor.remote';
  let { collection, locale, canCreate }: { collection: string; locale: string; canCreate: boolean } = $props();
  let cursor = $state<string | undefined>();
  async function load(collection: string, locale: string, cursor?: string) {
    try {
      const [manifest, entries] = await Promise.all([getEditorManifest(), listEditorContent({ collection, locale, ...(cursor ? { cursor } : {}) })]);
      const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
      return definition ? { definition, entries } : null;
    } catch { return null; }
  }
  const content = $derived(await load(collection, locale, cursor));
</script>
<svelte:head><title>{content?.definition.label ?? 'Content'} · Sveltery CMS</title></svelte:head>
<h1>{content?.definition.label ?? 'Content'}</h1>
{#if content}
  {#if canCreate}<a href={`${resolve('/content/[collection]/new', { collection })}?locale=${encodeURIComponent(locale)}`}>Add New</a>{/if}
  <div role="list" aria-label="Content drafts">
    <table aria-label="Content">
      <thead><tr><th>Title</th><th>Status</th><th>Locale</th></tr></thead>
      <tbody>
        {#each content.entries.items as item (item.id)}
          <tr><td><span role="listitem"><a href={`${resolve('/content/[collection]/[id]', { collection, id: item.id })}${item.locale === 'en' ? '' : `?locale=${encodeURIComponent(item.locale)}`}`}>{String(item.data[content.definition.titleField ?? 'title'] ?? item.slug ?? item.id)}</a></span></td>
            <td><span class="inline-flex">{item.status}</span></td><td>{item.locale}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if content.entries.items.length === 0}<p role="status">{cursor ? 'No more content.' : 'No content in this collection.'}</p>
  {:else if !content.entries.nextCursor}<p role="status">No more content.</p>{/if}
  {#if cursor || content.entries.nextCursor}
    <nav aria-label="Content pages">
      {#if cursor}<button type="button" onclick={() => { cursor = undefined; }}>First page</button>{/if}
      {#if content.entries.nextCursor}<button type="button" onclick={() => { cursor = content?.entries.nextCursor; }}>Next content</button>{/if}
    </nav>
  {/if}
{:else}<p role="status">Content is unavailable until authentication and storage are configured.</p>{/if}
<style>
  table { width: 100%; border-collapse: collapse; margin-block: 20px; background: white; }
  th, td { padding: 14px; text-align: start; border-bottom: 1px solid #d9e0eb; }
  .inline-flex { display: inline-flex; padding: 4px 8px; border-radius: 6px; background: #edf1ff; }
  nav { display: flex; gap: 12px; }
</style>
