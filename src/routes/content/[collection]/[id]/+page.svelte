<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import EditScalarContent from '$lib/ui/EditScalarContent.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  import { previewFields } from '$lib/ui/preview-fields';
  import { getEditorManifest, deleteContent } from '$lib/content.remote';
  import { getLifecycleContent } from '$lib/lifecycle.remote';
  import { saveEditorContent } from '$lib/editor.remote';
  async function loadContent(collection: string, id: string, locale: string) {
    return Promise.all([getEditorManifest(), getLifecycleContent({ collection, id, locale })]).then(
      ([manifest, item]) => {
        const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
        return definition ? { definition, item } : null;
      }, () => null
    );
  }
  const locale = $derived(page.url.searchParams.get('locale') ?? 'en');
  const content = $derived(await loadContent(page.params.collection ?? '', page.params.id ?? '', locale));
</script>

<svelte:head><title>{content?.item.slug ?? 'Draft'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/content/[collection]', { collection: page.params.collection ?? '' })}>Collection</a>
  <h1>Draft</h1>
  {#if content}
    {const fields = $derived(previewFields(content.definition.fields))}
    {#if data.mutationsEnabled}
      {#key JSON.stringify([page.params.collection, content.item.id, content.item.locale])}
        <EditScalarContent collection={page.params.collection ?? ''} definition={content.definition} item={content.item}
          disabled={!(data.editAny || (data.editOwn && data.principalId === content.item.authorId))} />
      {/key}
    {:else}<form {...saveEditorContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="locale" value={content.item.locale} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <DraftPreview {fields} values={content.item.data} />
    </form>{/if}
    <form {...deleteContent}>
      <input type="hidden" name="collection" value={page.params.collection} />
      <input type="hidden" name="id" value={content.item.id} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <button disabled>Move to trash</button>
    </form>
  {:else}
    <p role="status">Content is unavailable until authentication and storage are configured.</p>
  {/if}
</WorkspaceShell>
