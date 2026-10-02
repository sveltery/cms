<script lang="ts">
  import { restoreContent, listTrashedContent } from '$lib/content.remote';

  let { collection, item, disabled, queryArgs }: {
    collection: string;
    item: { id: string; locale: string; _rev: string; title: string | null; slug: string | null };
    disabled: boolean;
    queryArgs: { collection: string; locale?: string; limit?: number; cursor?: string };
  } = $props();
  const restoreForm = $derived(restoreContent.for(JSON.stringify([collection, item.id, item.locale])));
  let failed = $state(false);
  let submitting = false;
</script>

<form {...restoreForm.enhance(async form => {
  // One row's submission must not disable or overwrite another row's form.
  if (disabled || submitting || restoreForm.result) return;
  submitting = true;
  failed = false;
  try { await form.submit().updates(listTrashedContent(queryArgs)); }
  catch { failed = true; }
  finally { submitting = false; }
})} aria-label={`Restore ${item.title || item.slug || item.id} (${item.locale})`}>
  <input {...restoreForm.fields.collection.as('hidden', collection)} />
  <input {...restoreForm.fields.id.as('hidden', item.id)} />
  <input {...restoreForm.fields.locale.as('hidden', item.locale)} />
  <input {...restoreForm.fields._rev.as('hidden', item._rev)} />
  <button type="submit" disabled={disabled || restoreForm.pending > 0 || Boolean(restoreForm.result)}
    aria-label={`Restore ${item.title || item.slug || item.id} (${item.locale})`}>
    {restoreForm.pending > 0 ? 'Restoring…' : 'Restore'}
  </button>
  {#if !failed && restoreForm.pending === 0 && restoreForm.fields.allIssues()?.length}
    <ul aria-label="Restore validation errors" role="alert">
      {#each restoreForm.fields.allIssues() ?? [] as issue}<li>{issue.message}</li>{/each}
    </ul>
  {/if}
  {#if failed}<p role="alert">Failed to restore. Reload trash and try again.</p>{/if}
  {#if restoreForm.result}<p role="status">Draft restored.</p>{/if}
</form>

<style>
  button { padding: 8px 14px; }
  p, ul { margin-block: 8px; }
</style>
