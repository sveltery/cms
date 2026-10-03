<script lang="ts">
  import { resolve } from '$app/paths';
  import { getEditorManifest, listContent } from '../content.remote';
  import type { EditorCapability } from '../server/content/editor-display';
  import EditorForm from './EditorForm.svelte';
  let { collection, locale = 'en', capability }: { collection: string; locale?: string; capability: EditorCapability } = $props();
  let cursor = $state<string | undefined>();
  async function loadContent(collection: string, locale: string, cursor?: string) {
    try {
      const [manifest, drafts] = await Promise.all([getEditorManifest(), listContent({ collection, locale, ...(cursor ? { cursor } : {}) })]);
      const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
      return definition ? { definition, drafts } : null;
    } catch { return null; }
  }
  const content = $derived(await loadContent(collection, locale, cursor));
</script>

<svelte:head><title>{content?.definition.label ?? 'Content'} · Sveltery CMS</title></svelte:head>
<h1>{content?.definition.label ?? 'Content'}</h1>
{#if content}
  <ul aria-label="Content drafts">
    {#each content.drafts.items as item (item.id)}
      <li><a href={`${resolve('/content/[collection]/[id]', { collection: item.type, id: item.id })}?locale=${encodeURIComponent(item.locale)}`}>{item.title ?? item.slug ?? item.id}</a> <span>{item.status}</span></li>
    {/each}
  </ul>
  {#if content.drafts.items.length === 0}<p role="status">{cursor ? 'No more drafts.' : 'No drafts in this collection.'}</p>
  {:else if !content.drafts.nextCursor}<p role="status">No more drafts.</p>{/if}
  {#if cursor || content.drafts.nextCursor}
    <nav aria-label="Draft pages">
      {#if cursor}<button type="button" onclick={() => { cursor = undefined; }}>First page</button>{/if}
      {#if content.drafts.nextCursor}<button type="button" onclick={() => { cursor = content?.drafts.nextCursor; }}>Next drafts</button>{/if}
    </nav>
  {/if}
  <h2>New {content.definition.labelSingular}</h2>
  <EditorForm {collection} definition={content.definition} canWrite={capability.create} isNew
    entry={{ id: '', type: collection, locale, _rev: '', status: 'draft', slug: null, data: {} }} />
{:else}<p role="status">Content is unavailable until authentication and storage are configured.</p>{/if}
