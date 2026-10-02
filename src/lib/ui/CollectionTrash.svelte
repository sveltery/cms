<script lang="ts">
  let { content, collectionHref }: {
    content: { label: string; items: { id: string; title: string | null; slug: string | null; locale: string; deletedAt: string }[] } | null;
    collectionHref: string;
  } = $props();
</script>

<a href={collectionHref}>Collection drafts</a>
<h1>{content?.label ?? 'Collection'} trash</h1>
{#if content}
  <p>Showing up to 50 most recently deleted drafts across all locales.</p>
  <div class="table-scroll">
    <table aria-label="Trashed drafts">
      <thead><tr><th scope="col">Title</th><th scope="col">Locale</th><th scope="col">Deleted (UTC)</th></tr></thead>
      <tbody>
        {#each content.items as item (item.id)}
          <tr>
            <td>{item.title || item.slug || item.id}</td>
            <td>{item.locale}</td>
            <td><time datetime={item.deletedAt}>{item.deletedAt.slice(0, 10)}</time></td>
          </tr>
        {:else}
          <tr><td colspan="3"><span role="status">Trash is empty</span></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p role="status">Trash is unavailable.</p>
{/if}

<style>
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  th, td { padding: 12px; border-bottom: 1px solid #dfe3e9; text-align: start; overflow-wrap: anywhere; }
  th { background: #edf1ff; }
</style>
