<script lang="ts">
  import RestoreDraft from './RestoreDraft.svelte';
  let { content, collection, collectionHref, restoreCapability }: {
    content: { label: string; items: { id: string; title: string | null; slug: string | null; locale: string; deletedAt: string; authorId: string | null; _rev: string }[] } | null;
    collection: string;
    collectionHref: string;
    restoreCapability: { any: boolean; own: boolean; actorId: string | null };
  } = $props();
</script>

<a href={collectionHref}>Collection drafts</a>
<h1>{content?.label ?? 'Collection'} trash</h1>
{#if content}
  <p>Showing up to 50 most recently deleted drafts across all locales.</p>
  <div class="table-scroll">
    <table aria-label="Trashed drafts">
      <thead><tr><th scope="col">Title</th><th scope="col">Locale</th><th scope="col">Deleted (UTC)</th><th scope="col">Actions</th></tr></thead>
      <tbody>
        {#each content.items as item (JSON.stringify([collection, item.id, item.locale]))}
          <tr>
            <td>{item.title || item.slug || item.id}</td>
            <td>{item.locale}</td>
            <td><time datetime={item.deletedAt}>{item.deletedAt.slice(0, 10)}</time></td>
            <td><RestoreDraft {collection} {item} disabled={!(restoreCapability.any ||
              (restoreCapability.own && restoreCapability.actorId === item.authorId))} /></td>
          </tr>
        {:else}
          <tr><td colspan="4"><span role="status">Trash is empty</span></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
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
