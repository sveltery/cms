<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import EditorForm from '$lib/entry-locks/EntryLockEditor.svelte';
  import DraftPreview from '$lib/ui/DraftPreview.svelte';
  import { previewFields } from '$lib/ui/preview-fields';
  import { getEditorManifest, getContent, updateContent, deleteContent } from '$lib/content.remote';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const collection = $derived(page.params.collection ?? '');
  const id = $derived(page.params.id ?? '');
  const locale = $derived(page.url.searchParams.get('locale') ?? 'en');
  async function loadContent(collection: string, id: string, locale: string) {
    try {
      const [manifest, item] = await Promise.all([getEditorManifest(), getContent({ collection, id, locale })]);
      const definition = Object.hasOwn(manifest.collections, collection) ? manifest.collections[collection] : undefined;
      return definition ? { definition, item } : null;
    } catch { return null; }
  }
  const content = $derived(await loadContent(collection, id, locale));
  const canWrite = $derived(Boolean(content && (data.editorCapability.editAny || (data.editorCapability.editOwn && data.editorCapability.principalId === content.item.authorId))));
  const canTrash = $derived(Boolean(content && (data.editorCapability.deleteAny || (data.editorCapability.deleteOwn && data.editorCapability.principalId === content.item.authorId))));
</script>

<svelte:head><title>{content?.item.slug ?? 'Draft'} · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/content/[collection]', { collection })}>Collection</a>
  <h1>Draft</h1>
  {#if content}
    {#if canWrite || canTrash}
      {#key JSON.stringify([collection, id, locale])}
        <EditorForm {collection} definition={content.definition} entry={content.item} {canWrite} {canTrash} />
      {/key}
    {:else}
      {const fields = $derived(previewFields(content.definition.fields))}
      <form {...updateContent}>
        <input type="hidden" name="collection" value={collection} />
        <input type="hidden" name="id" value={content.item.id} />
        <input type="hidden" name="_rev" value={content.item._rev} />
        <DraftPreview {fields} values={content.item.data} />
      </form>
      <form {...deleteContent}>
        <input type="hidden" name="collection" value={collection} />
        <input type="hidden" name="id" value={content.item.id} />
        <input type="hidden" name="_rev" value={content.item._rev} />
        <button disabled>Move to trash</button>
      </form>
    {/if}
  {:else}<p role="status">Content is unavailable until authentication and storage are configured.</p>{/if}
</WorkspaceShell>
