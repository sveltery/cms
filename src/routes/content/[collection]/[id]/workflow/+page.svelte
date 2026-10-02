<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
  import { getLifecycleContent, listContentRevisions, publishContent, unpublishContent, discardContentDraft, restoreContentRevision } from '$lib/lifecycle.remote';
  import type { PageData } from './$types';
  let {data}:{data:PageData}=$props();
  const collection=$derived(page.params.collection??'');
  const id=$derived(page.params.id??'');
  const locale=$derived(page.url.searchParams.get('locale')??'en');
  async function loadContent(collection:string,id:string,locale:string) {
    try{return {item:await getLifecycleContent({collection,id,locale}),revisions:await listContentRevisions({collection,id,locale})};}
    catch{return null;}
  }
  const content=$derived(await loadContent(collection,id,locale));
  const canPublish=$derived(Boolean(content&&(data.workflow.publishAny||(data.workflow.publishOwn&&content.item.authorId===data.workflow.principalId))));
  const canEdit=$derived(Boolean(content&&(data.workflow.editAny||(data.workflow.editOwn&&content.item.authorId===data.workflow.principalId))));
  const formKey=$derived(JSON.stringify([collection,id,content?.item.locale]));
  const publishForm=$derived(publishContent.for(formKey));
  const unpublishForm=$derived(unpublishContent.for(formKey));
  const discardForm=$derived(discardContentDraft.for(formKey));
</script>

<svelte:head><title>Publishing and history · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')}>
  <a href={resolve('/content/[collection]',{collection})}>Collection</a>
  <h1>Publishing and history</h1>
  {#if content}
    <p>Status: {content.item.status}</p>
    {#if content.item.draftRevisionId}<p>Unpublished changes are ready to review.</p>{/if}
    <form {...publishForm}>
      <input type="hidden" name="collection" value={collection} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={content.item.locale} />
      <input type="hidden" name="_rev" value={content.item._rev} />
      <button disabled={!canPublish}>Publish now</button>
      {#each publishForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
    </form>
    {#if content.item.status==='published'}
      <form {...unpublishForm}>
        <input type="hidden" name="collection" value={collection} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="locale" value={content.item.locale} />
        <input type="hidden" name="_rev" value={content.item._rev} />
        <button disabled={!canPublish}>Unpublish</button>
        {#each unpublishForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
      </form>
    {/if}
    {#if content.item.draftRevisionId}
      <form {...discardForm}>
        <input type="hidden" name="collection" value={collection} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="locale" value={content.item.locale} />
        <input type="hidden" name="_rev" value={content.item._rev} />
        <button disabled={!canEdit}>Discard draft</button>
        {#each discardForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
      </form>
    {/if}
    <h2>Revision history</h2>
    <ul>
      {#each content.revisions as revision (revision.id)}
        {@const restoreForm=restoreContentRevision.for(JSON.stringify([collection,id,content.item.locale,revision.id]))}
        <li>
          <time datetime={revision.createdAt}>{revision.createdAt}</time>
          {#if revision.id===content.item.liveRevisionId}<span>Live version</span>{/if}
          {#if revision.id===content.item.draftRevisionId}<span>Current draft</span>{/if}
          <form {...restoreForm}>
            <input type="hidden" name="collection" value={collection} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="locale" value={content.item.locale} />
            <input type="hidden" name="_rev" value={content.item._rev} />
            <input type="hidden" name="revisionId" value={revision.id} />
            <button disabled={!canEdit}>Restore as draft</button>
            {#each restoreForm.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
          </form>
        </li>
      {:else}<li>No saved revisions.</li>{/each}
    </ul>
  {:else}<p role="status">Content is unavailable until authentication and storage are configured.</p>{/if}
</WorkspaceShell>
