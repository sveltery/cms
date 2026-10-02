<script lang="ts">
  import RestoreDraft from './RestoreDraft.svelte';
  let { content, collection, collectionHref, restoreCapability, loading, loadFailed, onLoadMore }: {
    content: { label: string; items: { id: string; title: string | null; slug: string | null; locale: string; deletedAt: string; authorId: string | null; _rev: string; queryArgs: { collection: string; limit: number; cursor?: string; locale?: string } }[]; nextCursor?: string } | null;
    collection: string;
    collectionHref: string;
    loading: boolean;
    loadFailed: boolean;
    onLoadMore: () => Promise<void>;
    restoreCapability: { any: boolean; own: boolean; actorId: string | null };
  } = $props();
</script>

<a href={collectionHref}>Collection drafts</a>
<h1>{content?.label ?? 'Collection'} trash</h1>
{#if content}
  <p>Showing {content.items.length} deleted drafts across all locales.</p>
  <noscript><p>Enable JavaScript to load more deleted drafts.</p></noscript>
  <div class="table-scroll">
    <table aria-label="Trashed drafts">
      <thead><tr><th scope="col">Title</th><th scope="col">Locale</th><th scope="col">Deleted (UTC)</th><th scope="col">Actions</th></tr></thead>
      <tbody>
        {#each content.items as item (JSON.stringify([collection, item.id, item.locale]))}
          <tr>
            <td>{item.title || item.slug || item.id}</td>
            <td>{item.locale}</td>
            <td><time datetime={item.deletedAt}>{item.deletedAt.slice(0, 10)}</time></td>
            <td><RestoreDraft {collection} {item} queryArgs={item.queryArgs} disabled={!(restoreCapability.any ||
              (restoreCapability.own && restoreCapability.actorId === item.authorId))} /></td>
          </tr>
        {:else}
          <tr><td colspan="4"><span role="status">Trash is empty</span></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if content.nextCursor}
    <button type="button" onclick={onLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load More'}</button>
  {:else if content.items.length > 0}
    <p role="status">No more deleted drafts.</p>
  {/if}
  {#if loadFailed}<p role="alert">Failed to load more. Try again.</p>{/if}
  {#if !restoreCapability.any && !restoreCapability.own}<p>Restoring is unavailable for this session or configuration.</p>{/if}
{:else}
  <p role="status">Trash is unavailable.</p>
{/if}

<style>
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  th, td { padding: 12px; border-bottom: 1px solid #dfe3e9; text-align: start; overflow-wrap: anywhere; }
  th { background: #edf1ff; }
</style>
